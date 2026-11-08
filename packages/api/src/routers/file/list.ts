import { db, files } from "@fileee/db";
import { and, asc, eq, gt, isNull, ne } from "drizzle-orm";
import * as z from "zod";
import { authed, requireStorage } from "../../lib/orpc.ts";
import { withThumbnailUrls } from "../../lib/previews.ts";

const PAGE = 50;

/** The folder's unique names make the name itself a stable cursor. */
export const list = authed
  .input(z.object({ storageId: z.string(), folderId: z.string(), cursor: z.string().optional() }))
  .use(requireStorage)
  .handler(async ({ input, context: { storage } }) => {
    const rows = await db
      .select()
      .from(files)
      .where(
        and(
          eq(files.storageId, input.storageId),
          eq(files.folderId, input.folderId),
          ne(files.status, "pending"),
          isNull(files.trashedAt),
          input.cursor ? gt(files.name, input.cursor) : undefined,
        ),
      )
      .orderBy(asc(files.name))
      .limit(PAGE + 1);

    return {
      items: await withThumbnailUrls(storage, rows.slice(0, PAGE)),
      nextCursor: rows.length > PAGE ? rows[PAGE - 1]!.name : undefined,
    };
  });
