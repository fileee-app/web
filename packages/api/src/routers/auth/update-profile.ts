import { db, users } from "@fileee/db";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { authed } from "../../lib/orpc.ts";
import { nameSchema } from "../../schemas.ts";

export const updateProfile = authed
  .input(z.object({ name: nameSchema }))
  .handler(async ({ input, context }) => {
    await db.update(users).set({ name: input.name }).where(eq(users.id, context.user.id));

    return { ok: true };
  });
