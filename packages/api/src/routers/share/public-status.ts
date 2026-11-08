import { db, publicFiles } from "@fileee/db";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import * as z from "zod";
import { authed, requireFile } from "../../lib/orpc.ts";
import { sameEtag } from "../../lib/public.ts";

export const publicStatus = authed
  .input(z.object({ fileId: z.string() }))
  .use(requireFile)
  .handler(async ({ context: { file, storage } }) => {
    const [copy] = await db
      .select()
      .from(publicFiles)
      .where(
        and(
          eq(publicFiles.fileId, file.id),
          isNull(publicFiles.unpublishedAt),
          isNotNull(publicFiles.copiedAt),
        ),
      );

    return {
      available: storage.cdnBaseUrl !== null,
      blockedBy: storage.publicCheckError,
      copy: copy
        ? {
            url: copy.url,
            publishedAt: copy.copiedAt!,
            outOfDate: file.status === "missing" || !sameEtag(copy.sourceEtag, file.etag),
          }
        : null,
    };
  });
