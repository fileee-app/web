import { db, files, folders, uploads } from "@fileee/db";
import { and, eq } from "drizzle-orm";
import { withFreeName } from "./names.ts";

/** Size and ETag come from HeadObject, never the browser. Names are only claimed here, since pending files don't hold one. */
export const markReady = (
  file: typeof files.$inferSelect,
  head: { size: number; etag: string | null },
) =>
  withFreeName(file.name, async (name) => {
    await db.transaction(async (tx) => {
      // A folder can be trashed mid-upload; the file then goes to trash with it.
      const [folder] = await tx.select().from(folders).where(eq(folders.id, file.folderId));

      await tx
        .update(files)
        .set({
          name,
          size: head.size,
          etag: head.etag,
          status: "ready",
          trashedAt: folder?.trashedAt ?? null,
          modifiedAt: new Date(),
        })
        .where(and(eq(files.id, file.id), eq(files.status, "pending")));

      await tx.delete(uploads).where(eq(uploads.fileId, file.id));
    });

    return { ...file, ...head, name, status: "ready" as const };
  });
