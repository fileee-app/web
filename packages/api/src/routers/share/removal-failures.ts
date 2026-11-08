import { db, publicFiles, users } from "@fileee/db";
import { and, eq, isNotNull, or, sql } from "drizzle-orm";
import { authed } from "../../lib/orpc.ts";

/** Copies that are still public because deleting them failed. Admins also answer for removed users' copies. */
export const removalFailures = authed.handler(async ({ context: { user } }) => {
  const rows = await db
    .select({
      id: publicFiles.id,
      url: publicFiles.url,
      error: publicFiles.deleteError,
      since: publicFiles.unpublishedAt,
    })
    .from(publicFiles)
    .where(
      and(
        isNotNull(publicFiles.deleteError),
        or(
          eq(publicFiles.userId, user.id),
          user.role === "admin"
            ? sql`${publicFiles.userId} NOT IN (SELECT ${users.id} FROM ${users})`
            : undefined,
        ),
      ),
    )
    .limit(100);

  return rows;
});
