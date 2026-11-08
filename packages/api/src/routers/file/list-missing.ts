import { db, files } from "@fileee/db";
import { and, asc, eq, gt, isNull } from "drizzle-orm";
import * as z from "zod";
import { authed, requireStorage } from "../../lib/orpc.ts";

const PAGE = 50;

/** Across all folders, so the key is the cursor: names aren't unique here. */
export const listMissing = authed
  .input(z.object({ storageId: z.string(), cursor: z.string().optional() }))
  .use(requireStorage)
  .handler(async ({ input }) => {
    const rows = await db
      .select()
      .from(files)
      .where(
        and(
          eq(files.storageId, input.storageId),
          eq(files.status, "missing"),
          isNull(files.trashedAt),
          input.cursor ? gt(files.objectKey, input.cursor) : undefined,
        ),
      )
      .orderBy(asc(files.objectKey))
      .limit(PAGE + 1);

    return {
      items: rows.slice(0, PAGE),
      nextCursor: rows.length > PAGE ? rows[PAGE - 1]!.objectKey : undefined,
    };
  });
