import { db, files, uploads } from "@fileee/db";
import {
  createMultipart,
  partSizeFor,
  PART_URL_TTL,
  safeFileName,
  signPut,
  usesMultipart,
  withPrefix,
} from "@fileee/storage";
import * as z from "zod";
import { authed, requireStorage } from "../../lib/orpc.ts";
import { connect } from "../../lib/storage.ts";
import { itemNameSchema } from "../../schemas.ts";
import { findFolder } from "../folder/lookup.ts";

const MULTIPART_TTL = 7 * 86_400_000;
const MAX_SIZE = 5 * 1024 ** 4; // S3's object size limit

export const start = authed
  .input(
    z.object({
      storageId: z.string(),
      folderId: z.string(),
      name: itemNameSchema,
      size: z.number().int().min(0).max(MAX_SIZE),
      mimeType: z.string().max(255),
    }),
  )
  .use(requireStorage)
  .handler(async ({ input, context: { storage, user } }) => {
    const folder = await findFolder(storage.id, input.folderId);
    const { client } = await connect(storage);
    const id = crypto.randomUUID();
    const objectKey = withPrefix(storage.prefix, `${id}/${safeFileName(input.name)}`);
    const multipart = usesMultipart(input.size);
    const s3UploadId = multipart ? await createMultipart(client, storage.bucket, objectKey) : null;
    const partSize = multipart ? partSizeFor(input.size) : null;

    await db.transaction(async (tx) => {
      await tx.insert(files).values({
        id,
        storageId: storage.id,
        folderId: folder.id,
        uploaderId: user.id,
        name: input.name,
        objectKey,
        size: input.size, // replaced with HeadObject's value when ready
        mimeType: input.mimeType || null,
        status: "pending",
      });

      await tx.insert(uploads).values({
        fileId: id,
        s3UploadId,
        partSize,
        expiresAt: new Date(
          Date.now() + (multipart ? MULTIPART_TTL : PART_URL_TTL * 1000 + 60_000),
        ),
      });
    });

    return multipart
      ? { fileId: id, kind: "multipart" as const, partSize: partSize! }
      : {
          fileId: id,
          kind: "single" as const,
          url: await signPut(client, storage.bucket, objectKey),
        };
  });
