import { db, storages } from "@fileee/db";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { runJobs } from "../../lib/jobs.ts";
import { authed, requireStorage } from "../../lib/orpc.ts";
import { detachCopies } from "../../lib/public.ts";

/** Forgets the connection and its index. The bucket's objects are the user's, so they stay, except public copies, which a job deletes. */
export const remove = authed
  .input(z.object({ storageId: z.string() }))
  .use(requireStorage)
  .handler(async ({ input, context: { storage } }) => {
    await db.transaction(async (tx) => {
      await detachCopies(tx, storage);
      await tx.delete(storages).where(eq(storages.id, input.storageId));
    });

    void runJobs();

    return { ok: true };
  });
