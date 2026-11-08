import { db, users } from "@fileee/db";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { dummyHash, hashPassword, needsRehash, verifyPassword } from "../../auth/password.ts";
import { clearRateLimit, enforceRateLimit } from "../../auth/rate-limit.ts";
import { publicUser, startSession } from "../../auth/session.ts";
import { pub } from "../../lib/orpc.ts";
import { loginInput } from "../../schemas.ts";

export const login = pub.input(loginInput).handler(async ({ input, context }) => {
  const pairKey = `email-ip:${input.email}:${context.clientIp}`;

  // Narrowest last but the email cap: one address can add only 10 to it, so a stranger can't lock someone out alone.
  await enforceRateLimit([
    ...(context.clientIp ? [[`ip:${context.clientIp}`, 50] as [string, number]] : []),
    [pairKey, 10],
    [`email:${input.email}`, 100],
  ]);

  const [user] = await db.select().from(users).where(eq(users.email, input.email));
  const valid = await verifyPassword(input.password, user?.passwordHash ?? (await dummyHash()));

  if (!user || !valid || user.disabledAt) {
    throw new ORPCError("UNAUTHORIZED", { message: "Wrong email or password." });
  }

  if (needsRehash(user.passwordHash)) {
    const passwordHash = await hashPassword(input.password);

    await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));
  }

  await clearRateLimit(pairKey);
  await startSession(user.id, context.resHeaders);

  return publicUser(user);
});
