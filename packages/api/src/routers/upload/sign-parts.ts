import { signPart } from "@fileee/storage";
import { ORPCError } from "@orpc/server";
import * as z from "zod";
import { authed, requireFile } from "../../lib/orpc.ts";
import { connect } from "../../lib/storage.ts";
import { findUpload } from "./lookup.ts";

export const signParts = authed
  .input(
    z.object({
      fileId: z.string(),
      partNumbers: z.array(z.number().int().min(1).max(10_000)).min(1).max(100),
    }),
  )
  .use(requireFile)
  .handler(async ({ input, context: { file, storage } }) => {
    const upload = await findUpload(file.id);

    if (!upload.s3UploadId)
      throw new ORPCError("BAD_REQUEST", { message: "Not a multipart upload." });

    const { client } = await connect(storage);

    return Promise.all(
      input.partNumbers.map(async (partNumber) => ({
        partNumber,
        url: await signPart(client, storage.bucket, file.objectKey, upload.s3UploadId!, partNumber),
      })),
    );
  });
