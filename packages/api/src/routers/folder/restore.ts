import { ORPCError } from "@orpc/server";
import * as z from "zod";
import { authed, requireFolder } from "../../lib/orpc.ts";
import { restoreFolder } from "../../lib/trash.ts";

export const restore = authed
  .input(z.object({ folderId: z.string() }))
  .use(requireFolder)
  .handler(({ context: { folder } }) => {
    if (!folder.trashedAt)
      throw new ORPCError("CONFLICT", { message: "This folder isn't in trash." });

    return restoreFolder(folder);
  });
