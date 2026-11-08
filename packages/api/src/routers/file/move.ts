import { db, files } from "@fileee/db";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { withFreeName } from "../../lib/names.ts";
import { authed, requireFile } from "../../lib/orpc.ts";
import { findFolder } from "../folder/lookup.ts";

export const move = authed
  .input(z.object({ fileId: z.string(), folderId: z.string() }))
  .use(requireFile)
  .handler(async ({ input, context: { file } }) => {
    if (file.status === "pending" || file.trashedAt) {
      throw new ORPCError("CONFLICT", { message: "This file can't be moved right now." });
    }

    const folder = await findFolder(file.storageId, input.folderId);

    if (file.folderId === folder.id) return file;

    return withFreeName(file.name, async (name) => {
      await db.update(files).set({ name, folderId: folder.id }).where(eq(files.id, file.id));

      return { ...file, name, folderId: folder.id };
    });
  });
