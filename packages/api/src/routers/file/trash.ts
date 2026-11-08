import { ORPCError } from "@orpc/server";
import * as z from "zod";
import { authed, requireFile } from "../../lib/orpc.ts";
import { trashFile } from "../../lib/trash.ts";

export const trash = authed
  .input(z.object({ fileId: z.string() }))
  .use(requireFile)
  .handler(async ({ context: { file } }) => {
    if (file.status === "pending")
      throw new ORPCError("CONFLICT", { message: "This file is still uploading." });

    if (!file.trashedAt) await trashFile(file);

    return { ok: true };
  });
