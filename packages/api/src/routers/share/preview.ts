import { signView } from "@fileee/storage";
import * as z from "zod";
import { previewOf } from "../../lib/mime.ts";
import { pub } from "../../lib/orpc.ts";
import { passwordAttempt, signSharedFile, tokenSchema } from "../../lib/shares.ts";

/** Like `file.previewUrl`, for a file a share link reaches. Not counted as a download. */
export const preview = pub
  .input(z.object({ token: tokenSchema, password: passwordAttempt, fileId: z.string().max(64) }))
  .handler(async ({ input }) => {
    const { url } = await signSharedFile(input, async (client, bucket, file) => {
      const { kind, contentType } = previewOf(file.name);

      return {
        kind,
        url:
          kind === "none"
            ? null
            : await signView(client, bucket, file.objectKey, file.name, contentType),
      };
    });

    return url;
  });
