import { ORPCError } from "@orpc/server";
import * as z from "zod";
import { authed, requireFolder } from "../../lib/orpc.ts";
import { trashFolder } from "../../lib/trash.ts";

export const trash = authed
  .input(z.object({ folderId: z.string() }))
  .use(requireFolder)
  .handler(async ({ context: { folder } }) => {
    if (!folder.parentId)
      throw new ORPCError("CONFLICT", { message: "The root can't be trashed." });

    if (!folder.trashedAt) await trashFolder(folder);

    return { ok: true };
  });
