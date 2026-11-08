import { db, users } from "@fileee/db";
import { publicUser } from "../../auth/session.ts";
import { admin } from "../../lib/orpc.ts";

export const list = admin.handler(async () =>
  (await db.select().from(users).orderBy(users.createdAt)).map(publicUser),
);
