import { db, publicFiles, storages } from "@fileee/db";
import { encryptCredentials } from "@fileee/storage";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { authed, requireStorage } from "../../lib/orpc.ts";
import { assertValidEndpoint, readCredentials, toPublicStorage } from "../../lib/storage.ts";
import { storageUpdateInput } from "../../schemas.ts";

export const update = authed
  .input(storageUpdateInput.and(z.object({ storageId: z.string() })))
  .use(requireStorage)
  .handler(async ({ input, context }) => {
    const { storageId, accessKeyId, secretAccessKey, endpoint, ...values } = input;

    assertValidEndpoint(endpoint);

    const moved =
      (endpoint || null) !== context.storage.endpoint ||
      values.bucket !== context.storage.bucket ||
      values.prefix !== context.storage.prefix;

    if (moved) {
      // The safety check and every public copy's location depend on these. Copies waiting to be deleted do too.
      const [copy] = await db
        .select({ id: publicFiles.id })
        .from(publicFiles)
        .where(eq(publicFiles.storageId, storageId))
        .limit(1);

      if (context.storage.cdnBaseUrl || copy) {
        throw new ORPCError("CONFLICT", {
          message:
            "Turn off public access and let its copies be deleted before moving this storage.",
        });
      }
    }

    const current = accessKeyId && secretAccessKey ? null : await readCredentials(context.storage);
    const newAccessKeyId = accessKeyId || current?.accessKeyId;
    const newSecretAccessKey = secretAccessKey || current?.secretAccessKey;

    if (!newAccessKeyId || !newSecretAccessKey) {
      throw new ORPCError("CONFLICT", {
        message: "The saved credentials can't be read. Enter the access key ID and secret again.",
      });
    }

    const [row] = await db
      .update(storages)
      .set({
        ...values,
        endpoint: endpoint || null,
        status: "unchecked",
        ...(await encryptCredentials({
          accessKeyId: newAccessKeyId,
          secretAccessKey: newSecretAccessKey,
        })),
      })
      .where(eq(storages.id, storageId))
      .returning();

    return toPublicStorage(row!);
  });
