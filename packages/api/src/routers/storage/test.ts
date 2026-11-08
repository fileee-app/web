import { db, storages } from "@fileee/db";
import { testConnection } from "@fileee/storage";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { authed, requireStorage } from "../../lib/orpc.ts";
import { connect } from "../../lib/storage.ts";

export const test = authed
  .input(z.object({ storageId: z.string() }))
  .use(requireStorage)
  .handler(async ({ context }) => {
    const { client, config } = await connect(context.storage);
    const result = await testConnection(client, config);

    await db
      .update(storages)
      .set({ status: result.ok ? "ok" : "error", lastCheckedAt: new Date() })
      .where(eq(storages.id, context.storage.id));

    return result;
  });
