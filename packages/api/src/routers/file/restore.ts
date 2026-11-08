import { ORPCError } from "@orpc/server";
import * as z from "zod";
import { authed, requireFile } from "../../lib/orpc.ts";
import { restoreFile } from "../../lib/trash.ts";

export const restore = authed
  .input(z.object({ fileId: z.string() }))
  .use(requireFile)
  .handler(({ context: { file } }) => {
    if (!file.trashedAt) throw new ORPCError("CONFLICT", { message: "This file isn't in trash." });

    return restoreFile(file);
  });
