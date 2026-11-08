import { db, folders } from "@fileee/db";
import { and, eq, isNull } from "drizzle-orm";

/** Reuses folders that already exist and creates the rest, returning the deepest one's ID. */
export async function ensureFolders(storageId: string, rootId: string, segments: string[]) {
  let parentId = rootId;

  for (const name of segments) {
    // Inserting first means parallel callers end up sharing the folder.
    await db.insert(folders).values({ storageId, parentId, name }).onConflictDoNothing();

    const [folder] = await db
      .select({ id: folders.id })
      .from(folders)
      .where(
        and(eq(folders.parentId, parentId), eq(folders.name, name), isNull(folders.trashedAt)),
      );

    parentId = folder!.id;
  }

  return parentId;
}
