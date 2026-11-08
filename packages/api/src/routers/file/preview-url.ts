import { signView } from "@fileee/storage";
import * as z from "zod";
import { previewOf } from "../../lib/mime.ts";
import { authed, requireFile } from "../../lib/orpc.ts";
import { assertInBucket } from "../../lib/previews.ts";
import { connect } from "../../lib/storage.ts";

export const previewUrl = authed
  .input(z.object({ fileId: z.string() }))
  .use(requireFile)
  .handler(async ({ context: { file, storage } }) => {
    const { client } = await connect(storage);

    await assertInBucket(client, file, storage);

    const { kind, contentType } = previewOf(file.name);

    return {
      kind,
      url:
        kind === "none"
          ? null
          : await signView(client, storage.bucket, file.objectKey, file.name, contentType),
    };
  });
