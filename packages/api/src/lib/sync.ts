import { db, files, folders, jobs, publicFiles, storages, syncRuns } from "@fileee/db";
import { listPage, listPrefix, PRIVATE_PROBE_PREFIX } from "@fileee/storage";
import { and, desc, eq, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { isUniqueViolation } from "./db-errors.ts";
import { ensureFolders } from "./folders.ts";
import { guessMimeType } from "./mime.ts";
import { withFreeName } from "./names.ts";
import { recheckPublicAccess, sameEtag } from "./public.ts";
import { connect } from "./storage.ts";

const DAY = 86_400_000;
const MAX_RUN = 6 * 3_600_000;
const ID_LAYOUT = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/([^/]+)$/;

type Storage = typeof storages.$inferSelect;
type Run = typeof syncRuns.$inferSelect;
type Trigger = Run["trigger"];

interface Listed {
  key: string;
  size: number;
  etag: string | null;
  lastModified: Date;
}

/** Queues a run, or returns the one already queued or running: the database allows only one. */
export async function startSync(storageId: string, trigger: Trigger, kick: () => void = kickJobs) {
  try {
    const run = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(syncRuns)
        .values({ storageId, trigger, status: "queued", startedAt: new Date() })
        .returning();

      await tx.insert(jobs).values({
        type: "sync",
        payload: { storageId, runId: created!.id },
        runAt: new Date(),
      });

      return created!;
    });

    kick();

    return run;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;

    const [active] = await db
      .select()
      .from(syncRuns)
      .where(
        and(eq(syncRuns.storageId, storageId), inArray(syncRuns.status, ["queued", "running"])),
      );

    if (active) return active;

    throw error;
  }
}

// Set by jobs.ts, which imports this file.
let kickJobs: () => void = () => {};

export const setSyncKick = (kick: () => void) => {
  kickJobs = kick;
};

/** Daily by default. Queues every storage whose latest run started over a day ago, or that has none. */
export async function scheduleSyncs(now = new Date()) {
  const all = await db.select({ id: storages.id }).from(storages);

  for (const { id } of all) {
    const [latest] = await db
      .select({ startedAt: syncRuns.startedAt })
      .from(syncRuns)
      .where(eq(syncRuns.storageId, id))
      .orderBy(desc(syncRuns.startedAt))
      .limit(1);

    if (!latest || now.getTime() - latest.startedAt.getTime() >= DAY)
      await startSync(id, "schedule");
  }
}

/** Where a key lands in the tree. The key's `/`s become folders, but only here, at first import. */
function placement(relative: string) {
  const recovered = relative.match(ID_LAYOUT);

  if (recovered) return { id: recovered[1]!, dirs: ["Recovered"], name: recovered[2]! };

  // "." and ".." aren't usable names, and empty segments come from `a//b`.
  const parts = relative
    .split("/")
    .filter(Boolean)
    .map((part) => (part === "." || part === ".." ? "_" : part));

  return { id: crypto.randomUUID(), dirs: parts.slice(0, -1), name: parts.at(-1)! };
}

async function rootOf(storageId: string) {
  const [root] = await db
    .select({ id: folders.id })
    .from(folders)
    .where(and(eq(folders.storageId, storageId), isNull(folders.parentId)));

  return root!.id;
}

/** One page, all in one transaction with the saved position, so a restart can't double-count or skip it. */
async function applyPage(storage: Storage, run: Run, objects: Listed[], next: string | undefined) {
  const prefix = listPrefix(storage.prefix);
  const now = new Date();

  const known = new Map(
    (objects.length
      ? await db
          .select()
          .from(files)
          .where(
            and(
              eq(files.storageId, storage.id),
              inArray(
                files.objectKey,
                objects.map((o) => o.key),
              ),
            ),
          )
      : []
    ).map((file) => [file.objectKey, file]),
  );

  // Folders go first and outside the transaction: they're idempotent, and it keeps the write lock short.
  const root = await rootOf(storage.id);
  const folderIds = new Map<string, string>();

  const folderFor = async (dirs: string[]) => {
    const path = dirs.join("/");
    let id = folderIds.get(path);

    if (!id) {
      id = await ensureFolders(storage.id, root, dirs);
      folderIds.set(path, id);
    }

    return id;
  };

  // A custom public prefix can sit under the private one. The rows also cover copies still being deleted after it changed.
  const publicPrefix =
    storage.cdnBaseUrl && !storage.publicBucket ? listPrefix(storage.publicPrefix ?? "") : null;

  const publicKeys = new Set(
    (objects.length
      ? await db
          .select({ key: publicFiles.publicKey })
          .from(publicFiles)
          .where(
            and(
              eq(publicFiles.storageId, storage.id),
              eq(publicFiles.bucket, storage.bucket),
              inArray(
                publicFiles.publicKey,
                objects.map((o) => o.key),
              ),
            ),
          )
      : []
    ).map((row) => row.key),
  );

  const imports: { object: Listed; id: string; name: string; folderId: string }[] = [];

  for (const object of objects) {
    const relative = object.key.slice(prefix.length);

    if (!relative || relative.startsWith(".fileee/") || known.has(object.key)) continue;
    if (relative.startsWith(PRIVATE_PROBE_PREFIX) || publicKeys.has(object.key)) continue;
    if (publicPrefix && object.key.startsWith(publicPrefix)) continue;
    if (object.lastModified > run.startedAt) continue; // too new to judge; the next run sees it

    if (relative.endsWith("/")) {
      if (object.size === 0) await folderFor(relative.split("/").filter(Boolean));

      continue;
    }

    const { id, dirs, name } = placement(relative);

    imports.push({ object, id, name, folderId: await folderFor(dirs) });
  }

  const usedIds = new Set(
    imports.length
      ? (
          await db
            .select({ id: files.id })
            .from(files)
            .where(
              inArray(
                files.id,
                imports.map((i) => i.id),
              ),
            )
        ).map((row) => row.id)
      : [],
  );

  await db.transaction(async (tx) => {
    let added = 0;
    let updated = 0;
    const seen: string[] = [];

    for (const object of objects) {
      const file = known.get(object.key);

      if (!file) continue;
      // Active uploads and pending deletes aren't this sync's business.
      if (file.status === "pending" || file.status === "purging") continue;

      const unchanged = object.size === file.size && sameEtag(object.etag, file.etag);

      if (file.status === "ready" && (unchanged || object.lastModified > run.startedAt)) {
        seen.push(file.id);

        continue;
      }

      const change = { size: object.size, etag: object.etag, lastSeenAt: now };

      // New bytes: what the browser extracted described the old ones.
      if (!unchanged) {
        Object.assign(change, {
          modifiedAt: object.lastModified,
          thumbnailKey: null,
          metadata: null,
          sha256: null,
        });
      }

      if (file.status === "missing") {
        // Back again: the name may have been taken meanwhile. Nothing else the user set changes.
        await withFreeName(file.name, (name) =>
          // A savepoint per try: a failed statement would otherwise abort the whole transaction.
          tx.transaction((savepoint) =>
            savepoint
              .update(files)
              .set({ ...change, name, status: "ready" })
              .where(eq(files.id, file.id)),
          ),
        );
      } else {
        await tx.update(files).set(change).where(eq(files.id, file.id));
      }

      updated++;
    }

    if (seen.length) await tx.update(files).set({ lastSeenAt: now }).where(inArray(files.id, seen));

    for (const { object, id, name, folderId } of imports) {
      await withFreeName(name, (candidate) =>
        tx.transaction((savepoint) =>
          savepoint.insert(files).values({
            id: usedIds.has(id) ? crypto.randomUUID() : id,
            storageId: storage.id,
            folderId,
            name: candidate,
            objectKey: object.key,
            size: object.size,
            etag: object.etag,
            mimeType: guessMimeType(name),
            status: "ready",
            modifiedAt: object.lastModified,
            lastSeenAt: now,
          }),
        ),
      );

      added++;
    }

    await tx
      .update(syncRuns)
      .set({
        continuationToken: next ?? null,
        listed: sql`${syncRuns.listed} + ${objects.length}`,
        added: sql`${syncRuns.added} + ${added}`,
        updated: sql`${syncRuns.updated} + ${updated}`,
      })
      .where(eq(syncRuns.id, run.id));
  });
}

/**
 * Only called after a complete listing, so an expired credential or a failure part-way marks nothing.
 * Files that became ready after the run started may not have been listed, so they're left out. Rows are never deleted.
 */
async function finish(storage: Storage, run: Run) {
  await db.transaction(async (tx) => {
    const marked = await tx
      .update(files)
      .set({ status: "missing" })
      .where(
        and(
          eq(files.storageId, storage.id),
          eq(files.status, "ready"),
          or(isNull(files.lastSeenAt), lt(files.lastSeenAt, run.startedAt)),
          lt(files.modifiedAt, run.startedAt),
        ),
      )
      .returning({ id: files.id });

    await tx
      .update(syncRuns)
      .set({ status: "complete", finishedAt: new Date(), markedMissing: marked.length })
      .where(eq(syncRuns.id, run.id));
  });
}

/** Failures end the run with its error; nothing retries until the next schedule or "Sync now". */
export async function runSync(runId: string, heartbeat: () => Promise<unknown>) {
  const [row] = await db.select().from(syncRuns).where(eq(syncRuns.id, runId));

  if (!row || (row.status !== "queued" && row.status !== "running")) return;

  const [storage] = await db.select().from(storages).where(eq(storages.id, row.storageId));

  if (!storage) return;

  // A resumed run keeps its original start, so the missing check still covers the whole listing.
  const run =
    row.status === "queued"
      ? (
          await db
            .update(syncRuns)
            .set({ status: "running", startedAt: new Date() })
            .where(eq(syncRuns.id, runId))
            .returning()
        )[0]!
      : row;

  try {
    await recheckPublicAccess(storage);

    const { client } = await connect(storage);
    let token = run.continuationToken ?? undefined;

    do {
      // The endpoint is user-supplied, so it could otherwise list forever.
      if (Date.now() - run.startedAt.getTime() > MAX_RUN) {
        throw new Error("This sync ran for over 6 hours and was stopped.");
      }

      const page = await listPage(client, storage.bucket, storage.prefix, token);

      await applyPage(storage, run, page.objects, page.next);
      token = page.next;
      await heartbeat();
    } while (token);

    await finish(storage, run);
  } catch (error) {
    const e = error as { name?: string; message?: string };

    await db
      .update(syncRuns)
      .set({
        status: "failed",
        finishedAt: new Date(),
        error:
          e.name && e.name !== "Error" ? `${e.name}: ${e.message}` : (e.message ?? "Unknown error"),
      })
      .where(eq(syncRuns.id, runId));
  }
}

export const latestRun = async (storageId: string) =>
  (
    await db
      .select()
      .from(syncRuns)
      .where(and(eq(syncRuns.storageId, storageId), gte(syncRuns.startedAt, new Date(0))))
      .orderBy(desc(syncRuns.startedAt))
      .limit(1)
  )[0];
