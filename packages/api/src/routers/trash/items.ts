import { db, files, folders, storages } from "@fileee/db";
import {
  aliasedTable,
  and,
  desc,
  eq,
  isNotNull,
  isNull,
  ne,
  notExists,
  notInArray,
  or,
} from "drizzle-orm";

const parent = aliasedTable(folders, "parent");
const LIMIT = 500;

/** Only what was trashed directly: an item stamped like its parent went in with it, and comes back with it. */
export async function trashItems(userId: string) {
  const [trashedFiles, trashedFolders] = await Promise.all([
    db
      .select({
        id: files.id,
        name: files.name,
        size: files.size,
        mimeType: files.mimeType,
        trashedAt: files.trashedAt,
        storageId: files.storageId,
        storageName: storages.name,
      })
      .from(files)
      .innerJoin(storages, eq(files.storageId, storages.id))
      .leftJoin(parent, eq(files.folderId, parent.id))
      .where(
        and(
          eq(storages.userId, userId),
          isNotNull(files.trashedAt),
          notInArray(files.status, ["pending", "purging"]),
          or(isNull(parent.trashedAt), ne(parent.trashedAt, files.trashedAt)),
        ),
      )
      .orderBy(desc(files.trashedAt))
      .limit(LIMIT), // shortcut: shows the newest 500 of each kind, paginate if trash gets larger than that
    db
      .select({
        id: folders.id,
        name: folders.name,
        trashedAt: folders.trashedAt,
        storageId: folders.storageId,
        storageName: storages.name,
      })
      .from(folders)
      .innerJoin(storages, eq(folders.storageId, storages.id))
      .where(
        and(
          eq(storages.userId, userId),
          isNotNull(folders.trashedAt),
          isNull(folders.purgingAt),
          notExists(
            db
              .select({ id: parent.id })
              .from(parent)
              .where(and(eq(parent.id, folders.parentId), eq(parent.trashedAt, folders.trashedAt))),
          ),
        ),
      )
      .orderBy(desc(folders.trashedAt))
      .limit(LIMIT),
  ]);

  return { files: trashedFiles, folders: trashedFolders };
}
