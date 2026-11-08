import { db, sessions, users } from "@fileee/db";
import { ORPCError } from "@orpc/server";
import { and, eq, ne } from "drizzle-orm";
import { hashPassword, verifyPassword } from "../../auth/password.ts";
import { enforceRateLimit } from "../../auth/rate-limit.ts";
import { authed } from "../../lib/orpc.ts";
import { changePasswordInput } from "../../schemas.ts";

export const changePassword = authed
  .input(changePasswordInput)
  .handler(async ({ input, context }) => {
    await enforceRateLimit([[`password:${context.user.id}`, 10]]);

    if (!(await verifyPassword(input.currentPassword, context.user.passwordHash))) {
      throw new ORPCError("FORBIDDEN", { message: "Your current password is wrong." });
    }

    const passwordHash = await hashPassword(input.newPassword);

    await db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash }).where(eq(users.id, context.user.id));

      await tx
        .delete(sessions)
        .where(and(eq(sessions.userId, context.user.id), ne(sessions.id, context.session.id)));
    });

    return { ok: true };
  });
