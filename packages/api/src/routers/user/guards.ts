import { db, users } from "@fileee/db";
import { ORPCError } from "@orpc/server";
import { and, count, eq, isNull, ne } from "drizzle-orm";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Call inside the transaction that disables or deletes the user, so two admins can't remove each other at once. */
export async function assertNotLastAdmin(tx: Tx, userId: string) {
  const [target] = await tx.select().from(users).where(eq(users.id, userId));

  if (!target) throw new ORPCError("NOT_FOUND", { message: "User not found." });
  if (target.role !== "admin" || target.disabledAt) return;

  const [others] = await tx
    .select({ n: count() })
    .from(users)
    .where(and(eq(users.role, "admin"), isNull(users.disabledAt), ne(users.id, userId)));

  if (!others?.n)
    throw new ORPCError("CONFLICT", { message: "The last active admin can't be removed." });
}
