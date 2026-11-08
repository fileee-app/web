import { signPut } from "@fileee/storage";
import { ORPCError } from "@orpc/server";
import * as z from "zod";
import { hasThumbnail, previewOf } from "../../lib/mime.ts";
import { authed, requireFile } from "../../lib/orpc.ts";
import { thumbnailKeyOf } from "../../lib/previews.ts";
import { connect } from "../../lib/storage.ts";

/** Tells the browser how to process a file, and where a thumbnail goes if it can have one. */
export const signThumbnail = authed
  .input(z.object({ fileId: z.string() }))
  .use(requireFile)
  .handler(async ({ context: { file, storage } }) => {
    if (file.status !== "ready") {
      throw new ORPCError("CONFLICT", { message: "This file isn't available." });
    }

    const { kind } = previewOf(file.name);

    return {
      kind,
      size: file.size,
      url: hasThumbnail(kind)
        ? await signPut(
            (await connect(storage)).client,
            storage.bucket,
            thumbnailKeyOf(storage, file.id),
          )
        : null,
    };
  });
