import { db, jobs, publicFiles, storages } from "@fileee/db";
import { checkPublicAccess, DELETE_BATCH, deleteObjects } from "@fileee/storage";
import { and, eq, inArray, isNotNull, isNull, sql, type SQL } from "drizzle-orm";
import { connect } from "./storage.ts";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Storage = typeof storages.$inferSelect;

/** Providers differ on quoting ETags. */
export const sameEtag = (a: string | null, b: string | null) =>
  a?.replaceAll('"', "") === b?.replaceAll('"', "");

export const enqueueDeletion = (tx: Tx, storageId: string) =>
  tx.insert(jobs).values({ type: "unpublish", payload: { storageId }, runAt: new Date() });

/** Inside the transaction that causes it, so the job can't be lost. Call runJobs after it commits. */
export async function retireCopies(tx: Tx, storageId: string, where?: SQL) {
  const retired = await tx
    .update(publicFiles)
    .set({ unpublishedAt: new Date() })
    .where(and(eq(publicFiles.storageId, storageId), isNull(publicFiles.unpublishedAt), where))
    .returning({ id: publicFiles.id });

  if (retired.length) await enqueueDeletion(tx, storageId);
}

export const connectionOf = ({
  endpoint,
  region,
  bucket,
  prefix,
  forcePathStyle,
  encryptedCredentials,
  keyVersion,
}: Storage) => ({
  endpoint,
  region,
  bucket,
  prefix,
  forcePathStyle,
  encryptedCredentials,
  keyVersion,
});

/** Call before deleting a storage: the job keeps what it needs to reach the bucket. */
export async function detachCopies(tx: Tx, storage: Storage) {
  const rows = await tx
    .update(publicFiles)
    .set({
      unpublishedAt: sql`coalesce(${publicFiles.unpublishedAt}, ${new Date()})`,
      retiredConnection: connectionOf(storage),
    })
    .where(eq(publicFiles.storageId, storage.id))
    .returning({ id: publicFiles.id });

  if (rows.length) await enqueueDeletion(tx, storage.id);
}

/** A failure stays on the row, where the owner sees it, and the job retries. Object first, row second. */
export async function deleteRetiredCopies(storageId: string, heartbeat: () => Promise<unknown>) {
  const [storage] = await db.select().from(storages).where(eq(storages.id, storageId));

  for (;;) {
    const batch = await db
      .select()
      .from(publicFiles)
      .where(and(eq(publicFiles.storageId, storageId), isNotNull(publicFiles.unpublishedAt)))
      .limit(DELETE_BATCH);

    if (batch.length === 0) return;

    for (const bucket of new Set(batch.map((row) => row.bucket))) {
      const rows = batch.filter((row) => row.bucket === bucket);
      const connection = storage ?? rows[0]!.retiredConnection;

      const failure = async (ids: string[], message: string) => {
        await db
          .update(publicFiles)
          .set({ deleteError: message })
          .where(inArray(publicFiles.id, ids));

        return new Error(`Couldn't delete ${ids.length} public copies from ${bucket}: ${message}`);
      };

      let failed: string[];

      try {
        if (!connection) throw new Error("The storage's connection is gone.");

        const { client } = await connect(connection);

        failed = await deleteObjects(
          client,
          bucket,
          rows.map((row) => row.publicKey),
        );
      } catch (error) {
        const e = error as { name?: string; message?: string };

        throw await failure(
          rows.map((row) => row.id),
          `${e.name}: ${e.message}`,
        );
      }

      const done = rows.filter((row) => !failed.includes(row.publicKey)).map((row) => row.id);

      if (done.length) await db.delete(publicFiles).where(inArray(publicFiles.id, done));

      if (failed.length) {
        throw await failure(
          rows.filter((row) => failed.includes(row.publicKey)).map((row) => row.id),
          "The provider refused to delete it.",
        );
      }
    }

    await heartbeat();
  }
}

/** The public location as the check needs it, or null when public access is off. */
export const publicLocationOf = (storage: Storage) =>
  storage.cdnBaseUrl
    ? {
        cdnBaseUrl: storage.cdnBaseUrl,
        bucket: storage.publicBucket ?? storage.bucket,
        prefix: storage.publicPrefix ?? "",
      }
    : null;

/** With each sync. A failure blocks publishing and warns the owner, and live copies stay as they are. */
export async function recheckPublicAccess(storage: Storage) {
  const location = publicLocationOf(storage);

  if (!location) return;

  let error: string | null;

  try {
    ({ error } = await checkPublicAccess((await connect(storage)).client, storage, location));
  } catch (e) {
    error = `The safety check couldn't run: ${(e as Error).message}`;
  }

  await db
    .update(storages)
    .set({ publicCheckError: error, publicCheckedAt: new Date() })
    // Not if the setting changed during the check: this result is about the old one.
    .where(and(eq(storages.id, storage.id), eq(storages.cdnBaseUrl, location.cdnBaseUrl)));
}
