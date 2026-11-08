import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  ListPartsCommand,
  PutObjectCommand,
  UploadPartCommand,
  UploadPartCopyCommand,
  type Part,
  type S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const MiB = 1024 * 1024;

export const MIN_PART_SIZE = 16 * MiB;
export const MAX_PARTS = 10_000;
export const VIEW_URL_TTL = 15 * 60;
export const PART_URL_TTL = 60 * 60;

/** Parts of at least 16 MiB, scaled so a file never needs more than 10,000. */
export const partSizeFor = (fileSize: number) =>
  Math.max(MIN_PART_SIZE, Math.ceil(fileSize / MAX_PARTS / MiB) * MiB);

export const usesMultipart = (fileSize: number) => fileSize >= MIN_PART_SIZE;

/** Strips path separators and control characters from names used in keys and headers. */
export const safeFileName = (name: string) =>
  // oxlint-disable-next-line no-control-regex
  name.replace(/[/\\\u0000-\u001f\u007f]/g, "_").trim() || "file";

export const attachmentDisposition = (name: string) => {
  const ascii = safeFileName(name)
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["%;]/g, "_");

  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safeFileName(name))}`;
};

export const signPut = (client: S3Client, Bucket: string, Key: string) =>
  getSignedUrl(client, new PutObjectCommand({ Bucket, Key }), { expiresIn: PART_URL_TTL });

export const signPart = (
  client: S3Client,
  Bucket: string,
  Key: string,
  UploadId: string,
  PartNumber: number,
) =>
  getSignedUrl(client, new UploadPartCommand({ Bucket, Key, UploadId, PartNumber }), {
    expiresIn: PART_URL_TTL,
  });

export const signDownload = (client: S3Client, Bucket: string, Key: string, name: string) =>
  getSignedUrl(
    client,
    new GetObjectCommand({ Bucket, Key, ResponseContentDisposition: attachmentDisposition(name) }),
    { expiresIn: VIEW_URL_TTL },
  );

/**
 * For <img>, <video>, <audio> and fetch, which all ignore the disposition. It's still `attachment`
 * so that opening the URL directly downloads the file instead of rendering it as a page.
 */
export const signView = (
  client: S3Client,
  Bucket: string,
  Key: string,
  name: string,
  contentType: string,
  signingDate?: Date,
) =>
  getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket,
      Key,
      ResponseContentType: contentType,
      ResponseContentDisposition: attachmentDisposition(name),
    }),
    { expiresIn: VIEW_URL_TTL, signingDate },
  );

export const createMultipart = async (client: S3Client, Bucket: string, Key: string) => {
  const { UploadId } = await client.send(new CreateMultipartUploadCommand({ Bucket, Key }));

  if (!UploadId) throw new Error("Provider returned no upload ID");

  return UploadId;
};

export async function listAllParts(
  client: S3Client,
  Bucket: string,
  Key: string,
  UploadId: string,
) {
  const parts: Part[] = [];
  let PartNumberMarker: string | undefined;

  do {
    const page = await client.send(
      new ListPartsCommand({ Bucket, Key, UploadId, PartNumberMarker }),
    );

    parts.push(...(page.Parts ?? []));
    PartNumberMarker = page.IsTruncated ? page.NextPartNumberMarker : undefined;
  } while (PartNumberMarker);

  return parts;
}

export const completeMultipart = (
  client: S3Client,
  Bucket: string,
  Key: string,
  UploadId: string,
  parts: Part[],
) =>
  client.send(
    new CompleteMultipartUploadCommand({
      Bucket,
      Key,
      UploadId,
      MultipartUpload: { Parts: parts.map(({ ETag, PartNumber }) => ({ ETag, PartNumber })) },
    }),
  );

export const abortMultipart = (client: S3Client, Bucket: string, Key: string, UploadId: string) =>
  client.send(new AbortMultipartUploadCommand({ Bucket, Key, UploadId }));

export const deleteObject = (client: S3Client, Bucket: string, Key: string) =>
  client.send(new DeleteObjectCommand({ Bucket, Key }));

/** The prefix as a listing needs it: with its slash, so `docs` doesn't also match `docs2/`. */
export const listPrefix = (prefix: string) => (prefix ? `${prefix.replace(/\/+$/, "")}/` : "");

export async function listPage(
  client: S3Client,
  Bucket: string,
  prefix: string,
  ContinuationToken: string | undefined,
  MaxKeys = 1000,
) {
  const page = await client.send(
    new ListObjectsV2Command({ Bucket, Prefix: listPrefix(prefix), ContinuationToken, MaxKeys }),
  );

  return {
    objects: (page.Contents ?? []).map((o) => ({
      key: o.Key!,
      size: o.Size ?? 0,
      etag: o.ETag ?? null,
      lastModified: o.LastModified ?? new Date(0),
    })),
    next: page.IsTruncated ? page.NextContinuationToken : undefined,
  };
}

export const DELETE_BATCH = 1000; // S3's limit per request

/** Returns the keys that failed. Deleting a key that's already gone counts as success, as S3 does. */
export async function deleteObjects(client: S3Client, Bucket: string, keys: string[]) {
  const { Errors } = await client.send(
    new DeleteObjectsCommand({
      Bucket,
      Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
    }),
  );

  return (Errors ?? []).map((e) => e.Key!);
}

/** Returns null only when the object really doesn't exist; other failures throw. */
export async function headObject(client: S3Client, Bucket: string, Key: string) {
  try {
    const head = await client.send(new HeadObjectCommand({ Bucket, Key }));

    return { size: head.ContentLength ?? 0, etag: head.ETag ?? null };
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;

    if (status === 404) return null;

    throw error;
  }
}

const GiB = 1024 * MiB;
const MAX_COPY_OBJECT = 5 * GiB; // S3's limit for one CopyObject
const COPY_WORKERS = 8;

interface ObjectRef {
  Bucket: string;
  Key: string;
}

export interface CopyHeaders {
  ContentType: string;
  ContentDisposition?: string;
  CacheControl: string;
}

const copySource = ({ Bucket, Key }: ObjectRef) =>
  `${Bucket}/${Key.split("/").map(encodeURIComponent).join("/")}`;

/** Server-side, part by part. No bytes pass through the app. */
export async function copyInParts(
  client: S3Client,
  source: ObjectRef,
  target: ObjectRef & CopyHeaders,
  size: number,
  partSize = Math.max(GiB, Math.ceil(size / MAX_PARTS)),
) {
  const { Bucket, Key } = target;
  const { UploadId } = await client.send(new CreateMultipartUploadCommand(target));

  if (!UploadId) throw new Error("Provider returned no upload ID");

  try {
    const count = Math.ceil(size / partSize);
    const parts: Part[] = [];
    let next = 0;

    const worker = async () => {
      while (next < count) {
        const index = next++;
        const start = index * partSize;

        const { CopyPartResult } = await client.send(
          new UploadPartCopyCommand({
            Bucket,
            Key,
            UploadId,
            PartNumber: index + 1,
            CopySource: copySource(source),
            CopySourceRange: `bytes=${start}-${Math.min(start + partSize, size) - 1}`,
          }),
        );

        parts[index] = { ETag: CopyPartResult?.ETag, PartNumber: index + 1 };
      }
    };

    await Promise.all(Array.from({ length: COPY_WORKERS }, worker));
    await completeMultipart(client, Bucket, Key, UploadId, parts);
  } catch (error) {
    await abortMultipart(client, Bucket, Key, UploadId).catch(() => {});

    throw error;
  }
}

/** Replaces the source's headers rather than carrying over what a browser reported at upload. */
export async function copyObject(
  client: S3Client,
  source: ObjectRef,
  target: ObjectRef & CopyHeaders,
  size: number,
) {
  if (size > MAX_COPY_OBJECT) return copyInParts(client, source, target, size);

  await client.send(
    new CopyObjectCommand({
      ...target,
      CopySource: copySource(source),
      MetadataDirective: "REPLACE",
    }),
  );
}
