import { db, folders } from "@fileee/db";
import { ORPCError } from "@orpc/server";
import { and, eq, sql } from "drizzle-orm";
import * as z from "zod";
import { withFreeName } from "../../lib/names.ts";
import { authed, requireFolder } from "../../lib/orpc.ts";
import { subtree } from "../../lib/trash.ts";
import { findFolder } from "./lookup.ts";

/** A single-row update, however large the folder: the tree lives only in the database. */
export const move = authed
  .input(z.object({ folderId: z.string(), parentId: z.string() }))
  .use(requireFolder)
  .handler(async ({ input, context: { folder } }) => {
    if (!folder.parentId || folder.trashedAt) {
      throw new ORPCError("CONFLICT", { message: "This folder can't be moved." });
    }

    // Check and write in one transaction: transactions take turns, so two opposite moves can't both pass and make a loop.
    return withFreeName(folder.name, (name) =>
      db.transaction(async (tx) => {
        // Scoped to the folder's storage, so this also refuses another storage's folder.
        const { id: parentId } = await findFolder(folder.storageId, input.parentId, tx);

        const [inside] = await tx
          .select({ id: folders.id })
          .from(folders)
          .where(and(eq(folders.id, parentId), sql`${folders.id} IN ${subtree(folder.id, null)}`));

        if (inside) {
          throw new ORPCError("CONFLICT", { message: "A folder can't move into itself." });
        }

        if (folder.parentId === parentId) return folder;

        await tx.update(folders).set({ name, parentId }).where(eq(folders.id, folder.id));

        return { ...folder, name, parentId };
      }),
    );
  });
