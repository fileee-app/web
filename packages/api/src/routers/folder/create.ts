import { db, folders } from "@fileee/db";
import * as z from "zod";
import { withFreeName } from "../../lib/names.ts";
import { authed, requireStorage } from "../../lib/orpc.ts";
import { itemNameSchema } from "../../schemas.ts";
import { findFolder } from "./lookup.ts";

export const create = authed
  .input(z.object({ storageId: z.string(), parentId: z.string(), name: itemNameSchema }))
  .use(requireStorage)
  .handler(async ({ input }) => {
    const parent = await findFolder(input.storageId, input.parentId);

    return withFreeName(input.name, async (name) => {
      const [folder] = await db
        .insert(folders)
        .values({ storageId: input.storageId, parentId: parent.id, name })
        .returning();

      return folder!;
    });
  });
