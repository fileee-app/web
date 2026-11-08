// docker compose exec fileee pnpm admin:reset-password <email>
import { randomBytes } from "node:crypto";
import { db, sessions, users } from "@fileee/db";
import { eq } from "drizzle-orm";
import { hashPassword } from "../auth/password.ts";

const email = process.argv[2]?.trim().toLowerCase();

if (!email) {
  console.error("Usage: pnpm admin:reset-password <email>");
  process.exit(1);
}

const [user] = await db.select().from(users).where(eq(users.email, email));

if (!user) {
  console.error(`No user with email ${email}`);
  process.exit(1);
}

const password = randomBytes(18).toString("base64url");
const passwordHash = await hashPassword(password);

await db.transaction(async (tx) => {
  await tx.update(users).set({ passwordHash, disabledAt: null }).where(eq(users.id, user.id));
  await tx.delete(sessions).where(eq(sessions.userId, user.id));
});

console.log(`New password for ${email}: ${password}`);
