import { db, files } from "@fileee/db";
import { abortMultipart, deleteObject } from "@fileee/storage";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { authed, requireFile } from "../../lib/orpc.ts";
import { connect } from "../../lib/storage.ts";
import { findUpload } from "./lookup.ts";

export const abort = authed
  .input(z.object({ fileId: z.string() }))
  .use(requireFile)
  .handler(async ({ context: { file, storage } }) => {
    if (file.status !== "pending")
      throw new ORPCError("CONFLICT", { message: "This upload already finished." });

    const upload = await findUpload(file.id);
    const { client } = await connect(storage);

    // The object goes first: if this fails the row stays, and the cleanup job still knows about it.
    if (upload.s3UploadId)
      await abortMultipart(client, storage.bucket, file.objectKey, upload.s3UploadId);
    else await deleteObject(client, storage.bucket, file.objectKey);

    await db.delete(files).where(eq(files.id, file.id));

    return { ok: true };
  });
