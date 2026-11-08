import { db, files } from "@fileee/db";
import { headObject } from "@fileee/storage";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { authed, requireFile } from "../../lib/orpc.ts";
import { thumbnailKeyOf } from "../../lib/previews.ts";
import { fileMetadataSchema } from "../../schemas.ts";
import { connect } from "../../lib/storage.ts";

export const saveExtracted = authed
  .input(
    z.object({
      fileId: z.string(),
      metadata: fileMetadataSchema.optional(),
      thumbnail: z.boolean(),
      sha256: z
        .string()
        .regex(/^[0-9a-f]{64}$/)
        .optional(),
    }),
  )
  .use(requireFile)
  .handler(async ({ input, context: { file, storage } }) => {
    const change: Partial<typeof files.$inferInsert> = {};

    if (input.metadata) change.metadata = input.metadata;
    if (input.sha256) change.sha256 = input.sha256;

    if (input.thumbnail) {
      // The key is ours and the object must really be there, so a list never shows a broken image.
      const key = thumbnailKeyOf(storage, file.id);

      if (!(await headObject((await connect(storage)).client, storage.bucket, key))) {
        throw new ORPCError("CONFLICT", { message: "The thumbnail didn't reach the bucket." });
      }

      change.thumbnailKey = key;
    }

    if (Object.keys(change).length) {
      await db.update(files).set(change).where(eq(files.id, file.id));
    }

    return { ok: true };
  });
