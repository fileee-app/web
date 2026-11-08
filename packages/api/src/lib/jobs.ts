import { db, files, folders, jobs, storages, uploads } from "@fileee/db";
import { abortMultipart, DELETE_BATCH, deleteObjects } from "@fileee/storage";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { deleteRetiredCopies } from "./public.ts";
import { connect } from "./storage.ts";
import { runSync, setSyncKick } from "./sync.ts";

const WORKERS = 3;
const LEASE = 2 * 60 * 1000;
const MAX_BACKOFF = 60 * 60 * 1000;

type Job = typeof jobs.$inferSelect;

/** Object first, row second: a sync can't re-import a deleted file, and a failure leaves the row to retry. */
async function purgeStorage(storageId: string, heartbeat: () => Promise<unknown>) {
  const [storage] = await db.select().from(storages).where(eq(storages.id, storageId));

  if (!storage) return; // the storage was removed, and its rows with it

  const { client } = await connect(storage);

  for (;;) {
    const batch = await db
      .select({
        id: files.id,
        key: files.objectKey,
        thumbnailKey: files.thumbnailKey,
        s3UploadId: uploads.s3UploadId,
      })
      .from(files)
      .leftJoin(uploads, eq(uploads.fileId, files.id))
      .where(and(eq(files.storageId, storageId), eq(files.status, "purging")))
      .limit(DELETE_BATCH);

    if (batch.length === 0) break;

    for (const { key, s3UploadId } of batch) {
      if (!s3UploadId) continue;

      await abortMultipart(client, storage.bucket, key, s3UploadId).catch((error) => {
        if (error?.name !== "NoSuchUpload") throw error;
      });
    }

    const failed = new Set(
      await deleteObjects(
        client,
        storage.bucket,
        batch.flatMap((f) => (f.thumbnailKey ? [f.key, f.thumbnailKey] : [f.key])),
      ),
    );

    const done = batch
      .filter((f) => !failed.has(f.key) && !failed.has(f.thumbnailKey ?? ""))
      .map((f) => f.id);

    if (done.length) await db.delete(files).where(inArray(files.id, done));

    if (failed.size)
      throw new Error(`Couldn't delete ${failed.size} objects from ${storage.bucket}`);

    await heartbeat();
  }

  // A transaction takes its turn, so another purge can't mark files in these folders between the check and the delete, which would cascade to rows whose objects still exist.
  await db.transaction(async (tx) => {
    const [left] = await tx
      .select({ id: files.id })
      .from(files)
      .where(and(eq(files.storageId, storageId), eq(files.status, "purging")))
      .limit(1);

    if (left) throw new Error("More files were queued for deletion");

    await tx
      .delete(folders)
      .where(and(eq(folders.storageId, storageId), isNotNull(folders.purgingAt)));
  });
}

/**
 * Atomically takes the next due job whose storage isn't busy. In a transaction so workers take turns: as one statement under
 * READ COMMITTED, two could pick the same row, or two jobs for one storage.
 * A running job past its lease was cut off by a restart: it no longer counts as busy, and is taken again.
 * Deleting public copies doesn't wait for a long sync, because until it runs those files stay public.
 * Syncs never take the last worker, so stalled ones can't hold up deletions.
 */
async function claim() {
  const [job] = await db.transaction((tx) => {
    const now = new Date();

    return tx
      .update(jobs)
      .set({
        status: "running",
        attempts: sql`${jobs.attempts} + 1`,
        leaseUntil: new Date(now.getTime() + LEASE),
      })
      .where(
        eq(
          jobs.id,
          sql`(
            SELECT j.id FROM job j
            WHERE ((j.status = 'pending' AND j."runAt" <= ${now}) OR (j.status = 'running' AND j."leaseUntil" < ${now}))
              AND NOT EXISTS (
                SELECT 1 FROM job other
                WHERE other.id != j.id AND other.status = 'running' AND other."leaseUntil" >= ${now}
                  AND other.payload ->> 'storageId' = j.payload ->> 'storageId'
                  AND (other.type = 'unpublish') = (j.type = 'unpublish')
              )
              AND (j.type != 'sync' OR (
                SELECT count(*) FROM job busy
                WHERE busy.type = 'sync' AND busy.status = 'running' AND busy."leaseUntil" >= ${now}
              ) < ${WORKERS - 1})
            ORDER BY j."runAt"
            LIMIT 1
          )`,
        ),
      )
      .returning();
  });

  return job;
}

async function execute(job: Job) {
  const heartbeat = () =>
    db
      .update(jobs)
      .set({ leaseUntil: new Date(Date.now() + LEASE) })
      .where(eq(jobs.id, job.id));

  try {
    if (job.type === "sync") await runSync(job.payload.runId!, heartbeat);
    else if (job.type === "unpublish") await deleteRetiredCopies(job.payload.storageId, heartbeat);
    else await purgeStorage(job.payload.storageId, heartbeat);

    await db.delete(jobs).where(eq(jobs.id, job.id));
  } catch (error) {
    console.error(`Job ${job.id} failed (attempt ${job.attempts})`, error);

    const delay = Math.min(60_000 * 2 ** (job.attempts - 1), MAX_BACKOFF);

    await db
      .update(jobs)
      .set({ status: "pending", runAt: new Date(Date.now() + delay) })
      .where(eq(jobs.id, job.id));

    setTimeout(() => void runJobs(), delay).unref();
  }
}

const workers = new Set<Promise<void>>();
let wakes = 0;

async function worker() {
  let seen;

  do {
    seen = wakes;

    for (let job = await claim(); job; job = await claim()) await execute(job);
  } while (seen !== wakes);
}

/**
 * Tops up the workers on every call, so one busy with a long sync doesn't delay new jobs.
 * A call during a drain makes the others look again, so a new job is never missed.
 */
export function runJobs() {
  wakes++;

  while (workers.size < WORKERS) {
    const running: Promise<void> = worker()
      .catch((error) => console.error("Job runner failed", error))
      .finally(() => workers.delete(running));

    workers.add(running);
  }

  return Promise.all(workers).then(() => {});
}

setSyncKick(() => void runJobs());

export async function enqueuePurge(storageId: string) {
  await db.insert(jobs).values({ type: "purge", payload: { storageId }, runAt: new Date() });
  void runJobs();
}
