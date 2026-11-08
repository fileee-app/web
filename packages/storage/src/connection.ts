import {
  CopyObjectCommand,
  GetBucketCorsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutBucketCorsCommand,
  PutObjectCommand,
  UploadPartCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { withPrefix, type StorageConfig } from "./client.ts";
import {
  abortMultipart,
  completeMultipart,
  createMultipart,
  deleteObjects,
  headObject,
  listPage,
  listAllParts,
} from "./objects.ts";

export interface TestStep {
  step: string;
  ok: boolean;
  error?: string;
  fix?: string;
}

const FIXES: Record<string, string> = {
  list: "Check the bucket name, region and endpoint, and that the credential may list this bucket.",
  put: "Give the credential write access to this prefix.",
  get: "Give the credential read access to this prefix.",
  "ranged get":
    "This provider doesn't appear to support range requests, so video playback may fail.",
  multipart: "Allow multipart uploads for this credential; files of 16 MiB or more need them.",
  copy: "Allow copying objects for this credential; public links need it.",
  delete: "Give the credential delete access to this prefix.",
};

const message = (error: unknown) => {
  const e = error as { name?: string; message?: string };

  return e.name && e.name !== "Error" ? `${e.name}: ${e.message}` : (e.message ?? "Unknown error");
};

/** A real round trip under the prefix. Stops at the first failure, since later steps depend on earlier ones. */
export async function testConnection(client: S3Client, config: StorageConfig) {
  const { bucket: Bucket, prefix } = config;
  const base = withPrefix(prefix, `.fileee/probe-${crypto.randomUUID()}`);
  const keys = { put: `${base}/put`, copy: `${base}/copy`, multipart: `${base}/multipart` };
  const steps: TestStep[] = [];

  const run = async (step: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      steps.push({ step, ok: true });

      return true;
    } catch (error) {
      steps.push({ step, ok: false, error: message(error), fix: FIXES[step] });

      return false;
    }
  };

  const created: string[] = [];

  const passed =
    (await run("list", () =>
      client.send(new ListObjectsV2Command({ Bucket, Prefix: prefix, MaxKeys: 1 })),
    )) &&
    (await run("put", async () => {
      await client.send(
        new PutObjectCommand({ Bucket, Key: keys.put, Body: "fileee connection test" }),
      );

      created.push(keys.put);
    })) &&
    (await run("get", async () => {
      const res = await client.send(new GetObjectCommand({ Bucket, Key: keys.put }));

      if ((await res.Body?.transformToString()) !== "fileee connection test") {
        throw new Error("Read back different bytes than were written");
      }
    })) &&
    (await run("listing", async () => {
      const head = await headObject(client, Bucket, keys.put);
      const { objects } = await listPage(client, Bucket, `${base}/`, undefined);
      const listed = objects.find((o) => o.key === keys.put);

      if (!listed) throw new Error("A new object didn't appear in the listing");

      if (listed.etag?.replaceAll('"', "") !== head?.etag?.replaceAll('"', "")) {
        throw new Error("The listing's ETag differs from HeadObject's");
      }
    })) &&
    (await run("ranged get", async () => {
      const res = await client.send(
        new GetObjectCommand({ Bucket, Key: keys.put, Range: "bytes=0-5" }),
      );

      if ((await res.Body?.transformToString()) !== "fileee") throw new Error("Range was ignored");
    })) &&
    (await run("multipart", async () => {
      const uploadId = await createMultipart(client, Bucket, keys.multipart);

      try {
        await client.send(
          new UploadPartCommand({
            Bucket,
            Key: keys.multipart,
            UploadId: uploadId,
            PartNumber: 1,
            Body: "part",
          }),
        );

        const parts = await listAllParts(client, Bucket, keys.multipart, uploadId);

        await completeMultipart(client, Bucket, keys.multipart, uploadId, parts);
        created.push(keys.multipart);
      } catch (error) {
        await abortMultipart(client, Bucket, keys.multipart, uploadId).catch(() => {});

        throw error;
      }
    })) &&
    (await run("copy", async () => {
      await client.send(
        new CopyObjectCommand({
          Bucket,
          Key: keys.copy,
          CopySource: `${Bucket}/${keys.put.split("/").map(encodeURIComponent).join("/")}`,
        }),
      );

      created.push(keys.copy);
    }));

  // Always clean up, and report the first delete failure so probe objects aren't left unnoticed.
  if (created.length > 0) {
    await run("delete", async () => {
      const failed = await deleteObjects(client, Bucket, created);

      if (failed.length) throw new Error(`Couldn't delete ${failed.join(", ")}`);
    });
  }

  return { ok: passed && steps.every((s) => s.ok), steps };
}

export const corsRule = (appOrigin: string) => ({
  AllowedOrigins: [appOrigin],
  AllowedMethods: ["GET", "PUT", "HEAD"],
  AllowedHeaders: ["*"],
  // pdf.js needs the range headers to load big PDFs piece by piece.
  ExposeHeaders: ["ETag", "Accept-Ranges", "Content-Length", "Content-Range"],
  MaxAgeSeconds: 3600,
});

/** Everything fileee does in a bucket. The two CORS actions are only for applying the rule. */
export const bucketPolicy = (bucket: string) => ({
  Version: "2012-10-17",
  Statement: [
    {
      Effect: "Allow",
      Action: ["s3:ListBucket", "s3:GetBucketCORS", "s3:PutBucketCORS"],
      Resource: `arn:aws:s3:::${bucket}`,
    },
    {
      Effect: "Allow",
      Action: [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:AbortMultipartUpload",
        "s3:ListMultipartUploadParts",
      ],
      Resource: `arn:aws:s3:::${bucket}/*`,
    },
  ],
});

/** Adds our rule to the bucket's existing rules rather than replacing them. */
export async function applyCors(client: S3Client, Bucket: string, appOrigin: string) {
  const existing = await client
    .send(new GetBucketCorsCommand({ Bucket }))
    .then((res) => res.CORSRules ?? [])
    .catch((error) => {
      if (error?.name === "NoSuchCORSConfiguration") return [];

      throw error;
    });

  const others = existing.filter((rule) => !rule.AllowedOrigins?.includes(appOrigin));

  await client.send(
    new PutBucketCorsCommand({
      Bucket,
      CORSConfiguration: { CORSRules: [...others, corsRule(appOrigin)] },
    }),
  );
}

/** A URL the browser PUTs to, proving CORS works from the real origin. */
export const corsProbeUrl = (client: S3Client, Bucket: string, prefix: string) =>
  getSignedUrl(
    client,
    new PutObjectCommand({ Bucket, Key: withPrefix(prefix, ".fileee/cors-probe") }),
    {
      expiresIn: 300,
    },
  );
