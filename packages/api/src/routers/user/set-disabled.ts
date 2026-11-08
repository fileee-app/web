import { db, sessions, storages, users } from "@fileee/db";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { runJobs } from "../../lib/jobs.ts";
import { admin } from "../../lib/orpc.ts";
import { retireCopies } from "../../lib/public.ts";
import { assertNotLastAdmin } from "./guards.ts";

export const setDisabled = admin
  .input(z.object({ userId: z.string(), disabled: z.boolean() }))
  .handler(async ({ input }) => {
    await db.transaction(async (tx) => {
      if (input.disabled) await assertNotLastAdmin(tx, input.userId);

      await tx
        .update(users)
        .set({ disabledAt: input.disabled ? new Date() : null })
        .where(eq(users.id, input.userId));

      if (!input.disabled) return;

      await tx.delete(sessions).where(eq(sessions.userId, input.userId));

      // Share links stop by themselves while the owner is disabled, but the CDN knows nothing of that.
      const owned = await tx.select().from(storages).where(eq(storages.userId, input.userId));

      for (const storage of owned) await retireCopies(tx, storage.id);
    });

    void runJobs();

    return { ok: true };
  });
