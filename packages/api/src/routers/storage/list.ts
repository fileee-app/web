import { db, storages } from "@fileee/db";
import { eq } from "drizzle-orm";
import { authed } from "../../lib/orpc.ts";
import { toPublicStorage } from "../../lib/storage.ts";

export const list = authed.handler(async ({ context }) =>
  Promise.all(
    (
      await db
        .select()
        .from(storages)
        .where(eq(storages.userId, context.user.id))
        .orderBy(storages.name)
    ).map(toPublicStorage),
  ),
);
