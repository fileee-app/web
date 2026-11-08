import { ORPCError } from "@orpc/server";
import * as z from "zod";
import { enqueuePurge } from "../../lib/jobs.ts";
import { authed, requireFolder } from "../../lib/orpc.ts";
import { markFolderForPurge } from "../../lib/trash.ts";

export const purge = authed
  .input(z.object({ folderId: z.string() }))
  .use(requireFolder)
  .handler(async ({ context: { folder } }) => {
    if (!folder.trashedAt) throw new ORPCError("CONFLICT", { message: "Move it to trash first." });

    await markFolderForPurge(folder);
    await enqueuePurge(folder.storageId);

    return { ok: true };
  });
