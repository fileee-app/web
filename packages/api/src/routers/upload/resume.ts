import { listAllParts, signPut } from "@fileee/storage";
import * as z from "zod";
import { authed, requireFile } from "../../lib/orpc.ts";
import { connect } from "../../lib/storage.ts";
import { findUpload } from "./lookup.ts";

/** What's left to do after a reload. S3 is asked what it has, so nothing depends on browser state. */
export const resume = authed
  .input(z.object({ fileId: z.string() }))
  .use(requireFile)
  .handler(async ({ context: { file, storage } }) => {
    const upload = await findUpload(file.id);
    const { client } = await connect(storage);

    if (!upload.s3UploadId) {
      return {
        fileId: file.id,
        kind: "single" as const,
        url: await signPut(client, storage.bucket, file.objectKey),
      };
    }

    const parts = await listAllParts(client, storage.bucket, file.objectKey, upload.s3UploadId);

    return {
      fileId: file.id,
      kind: "multipart" as const,
      partSize: upload.partSize!,
      uploadedParts: parts.map((p) => p.PartNumber!),
    };
  });
