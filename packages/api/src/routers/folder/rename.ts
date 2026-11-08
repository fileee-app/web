import { db, folders } from "@fileee/db";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { withFreeName } from "../../lib/names.ts";
import { authed, requireFolder } from "../../lib/orpc.ts";
import { itemNameSchema } from "../../schemas.ts";

export const rename = authed
  .input(z.object({ folderId: z.string(), name: itemNameSchema }))
  .use(requireFolder)
  .handler(({ input, context: { folder } }) => {
    if (!folder.parentId || folder.trashedAt) {
      throw new ORPCError("CONFLICT", { message: "This folder can't be renamed." });
    }

    return withFreeName(input.name, async (name) => {
      await db.update(folders).set({ name }).where(eq(folders.id, folder.id));

      return { ...folder, name };
    });
  });
