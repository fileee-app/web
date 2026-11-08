import { db, users } from "@fileee/db";
import { ORPCError } from "@orpc/server";
import { hashPassword } from "../../auth/password.ts";
import { publicUser } from "../../auth/session.ts";
import { isUniqueViolation } from "../../lib/db-errors.ts";
import { admin } from "../../lib/orpc.ts";
import { createUserInput } from "../../schemas.ts";

export const create = admin.input(createUserInput).handler(async ({ input }) => {
  const { password, ...values } = input;

  try {
    const [user] = await db
      .insert(users)
      .values({ ...values, passwordHash: await hashPassword(password) })
      .returning();

    return publicUser(user!);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ORPCError("CONFLICT", { message: "A user with this email already exists." });
    }

    throw error;
  }
});
