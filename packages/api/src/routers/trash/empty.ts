import { db, files, folders } from "@fileee/db";
import { inArray } from "drizzle-orm";
import { enqueuePurge } from "../../lib/jobs.ts";
import { authed } from "../../lib/orpc.ts";
import { markFileForPurge, markFolderForPurge } from "../../lib/trash.ts";
import { trashItems } from "./items.ts";

export const empty = authed.handler(async ({ context }) => {
  const touched = new Set<string>();

  // trashItems is scoped to this user, and marked items leave it, so this ends when trash is empty.
  for (;;) {
    const items = await trashItems(context.user.id);

    if (items.files.length === 0 && items.folders.length === 0) break;

    const folderRows = await db
      .select()
      .from(folders)
      .where(
        inArray(
          folders.id,
          items.folders.map((f) => f.id),
        ),
      );

    for (const folder of folderRows) {
      await markFolderForPurge(folder);
      touched.add(folder.storageId);
    }

    const fileRows = await db
      .select()
      .from(files)
      .where(
        inArray(
          files.id,
          items.files.map((f) => f.id),
        ),
      );

    for (const file of fileRows) {
      await markFileForPurge(file);
      touched.add(file.storageId);
    }
  }

  await Promise.all([...touched].map(enqueuePurge));

  return { ok: true };
});
