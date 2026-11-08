import { db, folders, storages } from "@fileee/db";
import { encryptCredentials } from "@fileee/storage";
import { authed } from "../../lib/orpc.ts";
import { assertValidEndpoint, toPublicStorage } from "../../lib/storage.ts";
import { startSync } from "../../lib/sync.ts";
import { storageInput } from "../../schemas.ts";

export const create = authed.input(storageInput).handler(async ({ input, context }) => {
  const { accessKeyId, secretAccessKey, endpoint, ...values } = input;

  assertValidEndpoint(endpoint);

  const credentials = await encryptCredentials({ accessKeyId, secretAccessKey });

  const storage = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(storages)
      .values({
        ...values,
        endpoint: endpoint || null,
        userId: context.user.id,
        ...credentials,
      })
      .returning();

    await tx.insert(folders).values({ storageId: row!.id, parentId: null, name: "" });

    return row!;
  });

  await startSync(storage.id, "connect");

  return toPublicStorage(storage);
});
