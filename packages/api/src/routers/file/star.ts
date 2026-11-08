import { db, files } from "@fileee/db";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { authed, requireFile } from "../../lib/orpc.ts";

export const star = authed
  .input(z.object({ fileId: z.string(), starred: z.boolean() }))
  .use(requireFile)
  .handler(async ({ input, context: { file } }) => {
    await db.update(files).set({ starred: input.starred }).where(eq(files.id, file.id));

    return { ok: true };
  });
