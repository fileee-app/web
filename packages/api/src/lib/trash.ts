import { db, files, folders, publicFiles, shareLinks } from "@fileee/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import { runJobs } from "./jobs.ts";
import { withFreeName } from "./names.ts";
import { retireCopies } from "./public.ts";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Folder = typeof folders.$inferSelect;
type File = typeof files.$inferSelect;

/**
 * Trashing stamps a folder's whole subtree with one timestamp, so listings need no ancestor checks.
 * The stamp also tells what restoring brings back: items trashed earlier on their own have a different one and stay in trash.
 * UNION, not UNION ALL: a loop in the tree must end the walk rather than run forever.
 */
export const subtree = (folderId: string, childTrashedAt: Date | null) => sql`(
  WITH RECURSIVE sub(id) AS (
    SELECT ${folderId}::text
    UNION
    SELECT f.id FROM folder f JOIN sub ON f."parentId" = sub.id
    WHERE ${childTrashedAt === null ? sql`f."trashedAt" IS NULL` : sql`f."trashedAt" = ${childTrashedAt}`}
  )
  SELECT id FROM sub
)`;

export async function trashFolder(folder: Folder) {
  const now = new Date();

  await db.transaction(async (tx) => {
    const within = subtree(folder.id, null);

    // Restoring brings the items back but not their links, so trashing can't be undone into re-sharing.
    await tx.execute(
      sql`UPDATE share_link SET "revokedAt" = ${now}, "updatedAt" = ${now}
          WHERE "revokedAt" IS NULL AND ("folderId" IN ${within} OR "fileId" IN (SELECT id FROM file WHERE "folderId" IN ${within}))`,
    );

    // Restoring doesn't republish, so these copies go for good.
    await retireCopies(
      tx,
      folder.storageId,
      sql`${publicFiles.fileId} IN (SELECT id FROM file WHERE "folderId" IN ${within})`,
    );

    await tx.execute(
      sql`UPDATE file SET "trashedAt" = ${now}, "updatedAt" = ${now} WHERE "trashedAt" IS NULL AND "folderId" IN ${within}`,
    );

    await tx.execute(
      sql`UPDATE folder SET "trashedAt" = ${now}, "updatedAt" = ${now} WHERE id IN ${within}`,
    );
  });

  void runJobs();
}

export async function trashFile(file: File) {
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.update(files).set({ trashedAt: now }).where(eq(files.id, file.id));

    await tx
      .update(shareLinks)
      .set({ revokedAt: now })
      .where(and(eq(shareLinks.fileId, file.id), isNull(shareLinks.revokedAt)));

    await retireCopies(tx, file.storageId, eq(publicFiles.fileId, file.id));
  });

  void runJobs();
}

/** Back where it was, or to the root when that folder is gone or in trash itself. Names may have been taken meanwhile. */
async function restoreTarget(storageId: string, parentId: string | null) {
  const [parent] = await db
    .select({ id: folders.id })
    .from(folders)
    .where(
      and(
        eq(folders.storageId, storageId),
        parentId ? eq(folders.id, parentId) : isNull(folders.parentId),
        isNull(folders.trashedAt),
      ),
    );

  if (parent) return parent.id;

  const [root] = await db
    .select({ id: folders.id })
    .from(folders)
    .where(and(eq(folders.storageId, storageId), isNull(folders.parentId)));

  return root!.id;
}

export async function restoreFolder(folder: Folder) {
  const parentId = await restoreTarget(folder.storageId, folder.parentId);
  const stamp = folder.trashedAt!;
  const now = new Date();

  return withFreeName(folder.name, (name) =>
    db.transaction(async (tx) => {
      await tx
        .update(folders)
        .set({ name, parentId, trashedAt: null })
        .where(eq(folders.id, folder.id));

      const within = subtree(folder.id, stamp);

      await tx.execute(
        sql`UPDATE file SET "trashedAt" = NULL, "updatedAt" = ${now} WHERE "trashedAt" = ${stamp} AND "folderId" IN ${within}`,
      );

      await tx.execute(
        sql`UPDATE folder SET "trashedAt" = NULL, "updatedAt" = ${now} WHERE "trashedAt" = ${stamp} AND id IN ${within}`,
      );

      return { ...folder, name, parentId, trashedAt: null };
    }),
  );
}

export async function restoreFile(file: File) {
  const folderId = await restoreTarget(file.storageId, file.folderId);

  return withFreeName(file.name, async (name) => {
    await db.update(files).set({ name, folderId, trashedAt: null }).where(eq(files.id, file.id));

    return { ...file, name, folderId, trashedAt: null };
  });
}

async function rootOf(tx: Tx, storageId: string) {
  const [root] = await tx
    .select({ id: folders.id })
    .from(folders)
    .where(and(eq(folders.storageId, storageId), isNull(folders.parentId)));

  return root!.id;
}

/** Marks a trashed folder's subtree for the purge job. Marked rows vanish from every listing at once. */
export async function markFolderForPurge(folder: Folder) {
  const stamp = folder.trashedAt!;
  const now = new Date();

  await db.transaction(async (tx) => {
    const root = await rootOf(tx, folder.storageId);
    const within = subtree(folder.id, stamp);

    // Items trashed earlier on their own weren't part of this request, so they stay in trash, re-homed so the folder's deletion doesn't cascade to them.
    await tx.execute(
      sql`UPDATE file SET "folderId" = ${root} WHERE "trashedAt" IS DISTINCT FROM ${stamp} AND "folderId" IN ${within}`,
    );

    await tx.execute(
      sql`UPDATE folder SET "parentId" = ${root} WHERE "trashedAt" IS DISTINCT FROM ${stamp} AND "parentId" IN ${within}`,
    );

    await tx.execute(
      sql`UPDATE file SET status = 'purging', "updatedAt" = ${now} WHERE "folderId" IN ${within}`,
    );

    await tx.execute(
      sql`UPDATE folder SET "purgingAt" = ${now}, "updatedAt" = ${now} WHERE id IN ${within}`,
    );
  });
}

// In a transaction so it takes its turn with the purge job's check that nothing is left to delete.
export const markFileForPurge = (file: File) =>
  db.transaction((tx) => tx.update(files).set({ status: "purging" }).where(eq(files.id, file.id)));
