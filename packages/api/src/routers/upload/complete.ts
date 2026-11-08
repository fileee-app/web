import { completeMultipart, headObject, listAllParts } from "@fileee/storage";
import { ORPCError } from "@orpc/server";
import * as z from "zod";
import { authed, requireFile } from "../../lib/orpc.ts";
import { connect } from "../../lib/storage.ts";
import { markReady } from "../../lib/uploads.ts";
import { findUpload } from "./lookup.ts";

/** Safe to retry: an object already there means an earlier call finished the multipart step. */
export const complete = authed
  .input(z.object({ fileId: z.string() }))
  .use(requireFile)
  .handler(async ({ context: { file, storage } }) => {
    if (file.status === "ready") return file;

    if (file.status !== "pending")
      throw new ORPCError("CONFLICT", { message: "This upload is no longer active." });

    const upload = await findUpload(file.id);
    const { client } = await connect(storage);

    let head = await headObject(client, storage.bucket, file.objectKey);

    if (!head && upload.s3UploadId) {
      // Part ETags come from the provider, not the browser, so an interrupted browser can't complete with a wrong list.
      const parts = await listAllParts(client, storage.bucket, file.objectKey, upload.s3UploadId);
      const expected = Math.ceil(file.size / upload.partSize!);

      if (parts.length !== expected) {
        throw new ORPCError("CONFLICT", {
          message: `Only ${parts.length} of ${expected} parts arrived. Retry the upload.`,
        });
      }

      await completeMultipart(client, storage.bucket, file.objectKey, upload.s3UploadId, parts);
      head = await headObject(client, storage.bucket, file.objectKey);
    }

    if (!head) throw new ORPCError("CONFLICT", { message: "The file never reached the bucket." });

    return markReady(file, head);
  });
