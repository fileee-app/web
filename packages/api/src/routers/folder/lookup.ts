import { db, folders } from "@fileee/db";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull } from "drizzle-orm";

/** Scoped to the storage, which the caller's middleware has already checked belongs to the user. */
export async function findFolder(
  storageId: string,
  folderId: string | undefined,
  tx: Pick<typeof db, "select"> = db,
) {
  const [folder] = await tx
    .select()
    .from(folders)
    .where(
      and(
        eq(folders.storageId, storageId),
        folderId ? eq(folders.id, folderId) : isNull(folders.parentId),
        isNull(folders.trashedAt),
      ),
    );

  if (!folder) throw new ORPCError("NOT_FOUND", { message: "Folder not found." });

  return folder;
}
