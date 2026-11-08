import { db, folders } from "@fileee/db";
import { and, eq, isNull } from "drizzle-orm";
import * as z from "zod";
import { authed, requireStorage } from "../../lib/orpc.ts";
import { findFolder } from "./lookup.ts";

const MAX_DEPTH = 1000;

/** A folder (the storage's root when no ID is given), its path from the root, and its subfolders. */
export const get = authed
  .input(z.object({ storageId: z.string(), folderId: z.string().optional() }))
  .use(requireStorage)
  .handler(async ({ input }) => {
    const folder = await findFolder(input.storageId, input.folderId);
    const path = [folder];

    // Bounded so a damaged tree can only shorten a breadcrumb, never run this out of memory.
    while (path[0]!.parentId && path.length < MAX_DEPTH) {
      path.unshift(await findFolder(input.storageId, path[0]!.parentId));
    }

    const children = await db
      .select()
      .from(folders)
      .where(and(eq(folders.parentId, folder.id), isNull(folders.trashedAt)))
      .orderBy(folders.name);

    return { folder, path: path.slice(1), children };
  });
