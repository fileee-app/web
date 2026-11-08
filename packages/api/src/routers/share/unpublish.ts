import { db, publicFiles } from "@fileee/db";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { runJobs } from "../../lib/jobs.ts";
import { authed, requireFile } from "../../lib/orpc.ts";
import { retireCopies } from "../../lib/public.ts";

export const unpublish = authed
  .input(z.object({ fileId: z.string() }))
  .use(requireFile)
  .handler(async ({ context: { file } }) => {
    await db.transaction((tx) => retireCopies(tx, file.storageId, eq(publicFiles.fileId, file.id)));
    void runJobs();

    return { ok: true };
  });
