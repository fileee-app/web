import { db, storages, users } from "@fileee/db";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { runJobs } from "../../lib/jobs.ts";
import { admin } from "../../lib/orpc.ts";
import { detachCopies } from "../../lib/public.ts";
import { assertNotLastAdmin } from "./guards.ts";

export const remove = admin.input(z.object({ userId: z.string() })).handler(async ({ input }) => {
  await db.transaction(async (tx) => {
    await assertNotLastAdmin(tx, input.userId);

    const owned = await tx.select().from(storages).where(eq(storages.userId, input.userId));

    for (const storage of owned) await detachCopies(tx, storage);

    await tx.delete(users).where(eq(users.id, input.userId));
  });

  void runJobs();

  return { ok: true };
});
