import { db, files } from "@fileee/db";
import { and, asc, eq, gt, isNull, or } from "drizzle-orm";
import * as z from "zod";
import { hasThumbnail, previewOf } from "../../lib/mime.ts";
import { authed, requireStorage } from "../../lib/orpc.ts";

const PAGE = 200;

/** Files the browser hasn't finished processing. Pages can come back short: kinds depend on the name, not a column. */
export const backfillCandidates = authed
  .input(z.object({ storageId: z.string(), cursor: z.string().optional() }))
  .use(requireStorage)
  .handler(async ({ input }) => {
    const rows = await db
      .select({
        id: files.id,
        name: files.name,
        metadata: files.metadata,
        thumbnailKey: files.thumbnailKey,
      })
      .from(files)
      .where(
        and(
          eq(files.storageId, input.storageId),
          eq(files.status, "ready"),
          isNull(files.trashedAt),
          or(isNull(files.metadata), isNull(files.thumbnailKey)),
          input.cursor ? gt(files.id, input.cursor) : undefined,
        ),
      )
      .orderBy(asc(files.id))
      .limit(PAGE + 1);

    const page = rows.slice(0, PAGE);

    return {
      fileIds: page
        .filter(({ name, metadata, thumbnailKey }) => {
          const { kind } = previewOf(name);

          return kind !== "none" && (!metadata || (!thumbnailKey && hasThumbnail(kind)));
        })
        .map((row) => row.id),
      nextCursor: rows.length > PAGE ? page.at(-1)!.id : undefined,
    };
  });
