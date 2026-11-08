import { createHash, timingSafeEqual } from "node:crypto";
import { appSettings, db, users } from "@fileee/db";
import { ORPCError } from "@orpc/server";
import { hashPassword } from "../../auth/password.ts";
import { enforceRateLimit } from "../../auth/rate-limit.ts";
import { startSession } from "../../auth/session.ts";
import { isUniqueViolation } from "../../lib/db-errors.ts";
import { base, isSetupComplete } from "../../lib/orpc.ts";
import { setupInput } from "../../schemas.ts";

const sha256 = (value: string) => createHash("sha256").update(value).digest();
const alreadyDone = () => new ORPCError("CONFLICT", { message: "Setup is already complete." });

export const complete = base.input(setupInput).handler(async ({ input, context }) => {
  if (await isSetupComplete()) throw alreadyDone();

  const expected = process.env.SETUP_TOKEN;

  if (expected) {
    await enforceRateLimit([[`setup:${context.clientIp ?? "unknown"}`, 10]]);

    // Hashing first gives equal lengths for the constant-time compare.
    if (!timingSafeEqual(sha256(input.setupToken), sha256(expected))) {
      throw new ORPCError("FORBIDDEN", { message: "Wrong setup token." });
    }
  }

  const passwordHash = await hashPassword(input.password);

  try {
    // One transaction: the settings row's fixed primary key means exactly one request can win.
    await db.transaction(async (tx) => {
      const now = new Date();

      await tx
        .insert(appSettings)
        .values({ id: 1, appName: input.appName || null, setupCompletedAt: now });

      const [admin] = await tx
        .insert(users)
        .values({ email: input.email, name: input.name, passwordHash, role: "admin" })
        .returning();

      await startSession(admin!.id, context.resHeaders, tx);
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw alreadyDone();

    throw error;
  }

  return { ok: true };
});
