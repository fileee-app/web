import { ORPCError } from "@orpc/server";
import * as z from "zod";
import { enqueuePurge } from "../../lib/jobs.ts";
import { authed, requireFile } from "../../lib/orpc.ts";
import { markFileForPurge } from "../../lib/trash.ts";

export const purge = authed
  .input(z.object({ fileId: z.string() }))
  .use(requireFile)
  .handler(async ({ context: { file } }) => {
    if (!file.trashedAt) throw new ORPCError("CONFLICT", { message: "Move it to trash first." });

    await markFileForPurge(file);
    await enqueuePurge(file.storageId);

    return { ok: true };
  });
