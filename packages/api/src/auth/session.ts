import { createHash, randomBytes } from "node:crypto";
import { db, sessions, users } from "@fileee/db";
import { deleteCookie, getCookie, setCookie } from "@orpc/server/helpers";
import { eq } from "drizzle-orm";
import { isHttpsApp } from "../lib/http.ts";

const DAY = 86_400_000;
const IDLE = 30 * DAY;
const ABSOLUTE = 90 * DAY;

const cookieName = () => (isHttpsApp() ? "__Host-fileee_session" : "fileee_session");

const cookieOptions = () =>
  ({ httpOnly: true, sameSite: "lax", secure: isHttpsApp(), path: "/" }) as const;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** A new token at every login. Only its hash is stored, so a leaked database can't be used to sign in. */
export async function startSession(
  userId: string,
  resHeaders: Headers | undefined,
  tx: Pick<typeof db, "insert"> = db,
) {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();

  await tx.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(now + IDLE),
    absoluteExpiresAt: new Date(now + ABSOLUTE),
  });

  // Lasts to the absolute limit; the database decides when it really expires, so SSR needn't reissue it.
  setCookie(resHeaders, cookieName(), token, { ...cookieOptions(), maxAge: ABSOLUTE / 1000 });
}

export async function loadSession(reqHeaders: Headers | undefined) {
  const token = getCookie(reqHeaders, cookieName());

  if (!token) return null;

  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.tokenHash, hashToken(token)));

  if (!row) return null;

  const now = Date.now();
  const { session, user } = row;

  if (
    session.expiresAt.getTime() < now ||
    session.absoluteExpiresAt.getTime() < now ||
    user.disabledAt
  ) {
    await db.delete(sessions).where(eq(sessions.id, session.id));

    return null;
  }

  // At most one write a day per session.
  if (session.expiresAt.getTime() - now < IDLE - DAY) {
    const expiresAt = new Date(Math.min(now + IDLE, session.absoluteExpiresAt.getTime()));

    await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, session.id));
  }

  return { session, user };
}

export async function endSession(sessionId: string, resHeaders: Headers | undefined) {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
  deleteCookie(resHeaders, cookieName(), cookieOptions());
}

export const publicUser = (user: typeof users.$inferSelect) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  disabledAt: user.disabledAt,
  createdAt: user.createdAt,
});
