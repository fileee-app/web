import { db, loginAttempts } from "@fileee/db";
import { ORPCError } from "@orpc/server";
import { eq, lt, sql } from "drizzle-orm";

const WINDOW = 15 * 60 * 1000;

/** Counted before the password check, so parallel guesses can't all slip through while scrypt runs. */
async function hit(key: string, limit: number) {
  const now = new Date();
  const expired = lt(loginAttempts.windowStartedAt, new Date(now.getTime() - WINDOW));

  const [row] = await db
    .insert(loginAttempts)
    .values({ key, count: 1, windowStartedAt: now })
    .onConflictDoUpdate({
      target: loginAttempts.key,
      set: {
        count: sql`case when ${expired} then 1 else ${loginAttempts.count} + 1 end`,
        windowStartedAt: sql`case when ${expired} then ${now} else ${loginAttempts.windowStartedAt} end`,
      },
    })
    .returning();

  return row!.count <= limit;
}

/** In order, stopping at the first one over: a blocked attempt mustn't also count against the later keys. */
export async function enforceRateLimit(limits: [key: string, limit: number][]) {
  for (const [key, limit] of limits) {
    if (!(await hit(key, limit))) {
      throw new ORPCError("TOO_MANY_REQUESTS", {
        message: "Too many attempts. Try again in 15 minutes.",
      });
    }
  }
}

export const clearRateLimit = (key: string) =>
  db.delete(loginAttempts).where(eq(loginAttempts.key, key));
