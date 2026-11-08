import type { RetiredConnection, storages } from "@fileee/db";
import { createClient, decryptCredentials, validateEndpoint } from "@fileee/storage";
import { ORPCError } from "@orpc/server";

type StorageRow = typeof storages.$inferSelect;

export function assertValidEndpoint(endpoint: string) {
  const problem = endpoint ? validateEndpoint(endpoint) : null;

  if (problem) throw new ORPCError("BAD_REQUEST", { message: problem });
}

export async function connect(storage: RetiredConnection) {
  // Again here, because an IP address skips the DNS check and ALLOW_PRIVATE_ENDPOINTS may have changed since it was saved.
  assertValidEndpoint(storage.endpoint ?? "");

  const config = {
    ...storage,
    ...(await decryptCredentials(storage.encryptedCredentials, storage.keyVersion)),
  };

  return { client: createClient(config), config };
}

/** Null when they were saved under another ENCRYPTION_KEY, so the owner can still see the storage and re-enter them. */
export async function readCredentials(storage: StorageRow) {
  try {
    return await decryptCredentials(storage.encryptedCredentials, storage.keyVersion);
  } catch {
    return null;
  }
}

/** What the API may say about a storage. Never add credentials here. */
export const toPublicStorage = async (storage: StorageRow) => {
  const credentials = await readCredentials(storage);

  return {
    id: storage.id,
    name: storage.name,
    provider: storage.provider,
    endpoint: storage.endpoint,
    region: storage.region,
    bucket: storage.bucket,
    prefix: storage.prefix,
    forcePathStyle: storage.forcePathStyle,
    status: storage.status,
    lastCheckedAt: storage.lastCheckedAt,
    cdnBaseUrl: storage.cdnBaseUrl,
    publicBucket: storage.publicBucket,
    publicPrefix: storage.publicPrefix,
    publicCheckError: storage.publicCheckError,
    publicCheckedAt: storage.publicCheckedAt,
    accessKeyHint: credentials?.accessKeyId.slice(-4) ?? null,
  };
};
