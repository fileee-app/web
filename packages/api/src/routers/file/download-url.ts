import { signDownload } from "@fileee/storage";
import * as z from "zod";
import { authed, requireFile } from "../../lib/orpc.ts";
import { assertInBucket } from "../../lib/previews.ts";
import { connect } from "../../lib/storage.ts";

export const downloadUrl = authed
  .input(z.object({ fileId: z.string() }))
  .use(requireFile)
  .handler(async ({ context: { file, storage } }) => {
    const { client } = await connect(storage);

    await assertInBucket(client, file, storage);

    return { url: await signDownload(client, storage.bucket, file.objectKey, file.name) };
  });
