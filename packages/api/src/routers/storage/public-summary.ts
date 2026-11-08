import { db, files, publicFiles } from "@fileee/db";
import { and, eq, isNull } from "drizzle-orm";
import * as z from "zod";
import { authed, requireStorage } from "../../lib/orpc.ts";
import { sameEtag } from "../../lib/public.ts";

/** What's published from this storage, for its settings. */
export const publicSummary = authed
  .input(z.object({ storageId: z.string() }))
  .use(requireStorage)
  .handler(async ({ input }) => {
    const rows = await db
      .select({
        fileId: files.id,
        name: files.name,
        etag: files.etag,
        status: files.status,
        sourceEtag: publicFiles.sourceEtag,
      })
      .from(publicFiles)
      .innerJoin(files, eq(publicFiles.fileId, files.id))
      .where(and(eq(publicFiles.storageId, input.storageId), isNull(publicFiles.unpublishedAt)));

    return {
      live: rows.length,
      outOfDate: rows
        .filter((row) => row.status === "missing" || !sameEtag(row.sourceEtag, row.etag))
        .map(({ fileId, name }) => ({ fileId, name })),
    };
  });
