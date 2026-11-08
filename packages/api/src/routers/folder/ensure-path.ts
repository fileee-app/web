import * as z from "zod";
import { ensureFolders } from "../../lib/folders.ts";
import { authed, requireStorage } from "../../lib/orpc.ts";
import { itemNameSchema } from "../../schemas.ts";
import { findFolder } from "./lookup.ts";

/** For folder uploads: reuses folders that already exist and creates the rest, returning the deepest one's ID. */
export const ensurePath = authed
  .input(
    z.object({
      storageId: z.string(),
      parentId: z.string(),
      segments: z.array(itemNameSchema).min(1).max(100),
    }),
  )
  .use(requireStorage)
  .handler(async ({ input }) => {
    const parent = await findFolder(input.storageId, input.parentId);

    return { folderId: await ensureFolders(input.storageId, parent.id, input.segments) };
  });
