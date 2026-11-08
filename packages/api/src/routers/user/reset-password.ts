import { db, sessions, users } from "@fileee/db";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { hashPassword } from "../../auth/password.ts";
import { admin } from "../../lib/orpc.ts";
import { passwordSchema } from "../../schemas.ts";

export const resetPassword = admin
  .input(z.object({ userId: z.string(), password: passwordSchema }))
  .handler(async ({ input }) => {
    const passwordHash = await hashPassword(input.password);

    await db.transaction(async (tx) => {
      const updated = await tx
        .update(users)
        .set({ passwordHash })
        .where(eq(users.id, input.userId))
        .returning({ id: users.id });

      if (updated.length === 0) throw new ORPCError("NOT_FOUND", { message: "User not found." });

      await tx.delete(sessions).where(eq(sessions.userId, input.userId));
    });

    return { ok: true };
  });
