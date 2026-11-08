// Runs against MinIO: docker compose -f docker-compose.dev.yml up -d, then S3_TEST_ENDPOINT=http://localhost:9000 pnpm test
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { db, files, folders, jobs, syncRuns } from "@fileee/db";
import { createClient } from "@fileee/storage";
import { and, desc, eq, isNull } from "drizzle-orm";
import { beforeAll, describe, expect, test, vi } from "vitest";
import { runJobs } from "../../lib/jobs.ts";
import { guessMimeType } from "../../lib/mime.ts";
import { scheduleSyncs } from "../../lib/sync.ts";
import { ADMIN, setupTestApp } from "../../test-utils.ts";

// Small pages, and a way to fail part-way through a listing.
const control = vi.hoisted(() => ({ failOnPage: 0, pages: 0 }));

vi.mock("@fileee/storage", async (original) => {
  const actual = await original<typeof import("@fileee/storage")>();

  return {
    ...actual,
    listPage: (...args: Parameters<typeof actual.listPage>) => {
      control.pages++;

      if (control.failOnPage && control.pages >= control.failOnPage) {
        return Promise.reject(new Error("The connection dropped"));
      }

      const [client, bucket, prefix, token] = args;

      return actual.listPage(client, bucket, prefix, token, 2);
    },
  };
});

const endpoint = process.env.S3_TEST_ENDPOINT;
const { browser } = await setupTestApp();
const alice = browser();
const bob = browser();

test("the MIME type is a guess from the extension", () => {
  expect(guessMimeType("a.JPG")).toBe("image/jpeg");
  expect(guessMimeType("archive.tar.gz")).toBe("application/gzip");
  expect(guessMimeType("README")).toBeNull();
  expect(guessMimeType(".env")).toBeNull();
});

describe.skipIf(!endpoint)("sync from bucket against MinIO", () => {
  const s3 = createClient({
    endpoint: endpoint ?? null,
    region: "us-east-1",
    bucket: "fileee",
    prefix: "",
    forcePathStyle: true,
    accessKeyId: "minioadmin",
    secretAccessKey: "minioadmin",
  });

  /** Each test gets its own storage, on its own prefix. */
  async function setup() {
    const prefix = `sync-${crypto.randomUUID()}`;

    const storage = await alice.storage.create({
      name: prefix,
      provider: "minio",
      endpoint: endpoint!,
      region: "us-east-1",
      bucket: "fileee",
      prefix,
      forcePathStyle: true,
      accessKeyId: "minioadmin",
      secretAccessKey: "minioadmin",
    });

    await runJobs(); // the first sync, of an empty prefix

    const put = (key: string, body = "hello") =>
      s3.send(new PutObjectCommand({ Bucket: "fileee", Key: `${prefix}/${key}`, Body: body }));

    const remove = (key: string) =>
      s3.send(new DeleteObjectCommand({ Bucket: "fileee", Key: `${prefix}/${key}` }));

    const sync = async () => {
      control.pages = 0;
      await alice.storage.sync({ storageId: storage.id });
      await runJobs();

      return (await alice.storage.syncStatus({ storageId: storage.id })).run!;
    };

    const rows = () => db.select().from(files).where(eq(files.storageId, storage.id));

    const byKey = async (key: string) =>
      (await rows()).find((f) => f.objectKey === `${prefix}/${key}`);

    return { storageId: storage.id, prefix, put, remove, sync, rows, byKey };
  }

  beforeAll(async () => {
    await alice.setup.complete(ADMIN);

    await alice.user.create({
      name: "Bob",
      email: "bob@example.com",
      password: "a long enough password",
      role: "user",
    });

    await bob.auth.login({ email: "bob@example.com", password: "a long enough password" });
  });

  test("connecting runs a first sync, and it imports existing files with their folders", async () => {
    const prefix = `sync-${crypto.randomUUID()}`;
    const key = (k: string) => `${prefix}/${k}`;

    for (const k of ["top.txt", "docs/a.pdf", "docs/deep/b.png", "docs/deep/c"]) {
      await s3.send(new PutObjectCommand({ Bucket: "fileee", Key: key(k), Body: "hello" }));
    }

    await s3.send(new PutObjectCommand({ Bucket: "fileee", Key: key("empty/"), Body: "" }));

    await s3.send(
      new PutObjectCommand({ Bucket: "fileee", Key: key(".fileee/thumbs/x.webp"), Body: "x" }),
    );

    // A sibling that merely shares the prefix's characters must not be listed.
    await s3.send(
      new PutObjectCommand({ Bucket: "fileee", Key: `${prefix}-sibling/no.txt`, Body: "x" }),
    );

    await new Promise((resolve) => setTimeout(resolve, 1100)); // LastModified has one-second precision

    const storage = await alice.storage.create({
      name: prefix,
      provider: "minio",
      endpoint: endpoint!,
      region: "us-east-1",
      bucket: "fileee",
      prefix,
      forcePathStyle: true,
      accessKeyId: "minioadmin",
      secretAccessKey: "minioadmin",
    });

    await runJobs();

    const { run } = await alice.storage.syncStatus({ storageId: storage.id });

    expect(run).toMatchObject({
      status: "complete",
      trigger: "connect",
      added: 4,
      markedMissing: 0,
    });

    expect(run).not.toHaveProperty("continuationToken");
    expect(run!.listed).toBe(6);

    const root = await alice.folder.get({ storageId: storage.id });

    expect(root.children.map((f) => f.name)).toEqual(["docs", "empty"]);

    const listed = await alice.file.list({ storageId: storage.id, folderId: root.folder.id });

    expect(listed.items.map((f) => f.name)).toEqual(["top.txt"]);
    expect(listed.items[0]).toMatchObject({ size: 5, status: "ready", mimeType: "text/plain" });
    expect(listed.items[0]!.etag).toBeTruthy();

    const docs = await alice.folder.get({ storageId: storage.id, folderId: root.children[0]!.id });

    const pdf = (await alice.file.list({ storageId: storage.id, folderId: docs.folder.id }))
      .items[0]!;

    expect(pdf).toMatchObject({ name: "a.pdf", mimeType: "application/pdf" });

    const { url } = await alice.file.downloadUrl({ fileId: pdf.id });

    expect(await (await fetch(url)).text()).toBe("hello");
  });

  test("every row of the plan's table", async () => {
    const s = await setup();

    await s.put("same.txt");
    await s.put("changes.txt");
    await s.put("goes.txt");
    await s.put("returns.txt");
    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect(await s.sync()).toMatchObject({ added: 4, updated: 0, markedMissing: 0 });

    const before = await s.byKey("same.txt");

    await s.put("changes.txt", "different content");
    await s.remove("goes.txt");
    await s.remove("returns.txt");
    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect(await s.sync()).toMatchObject({ added: 0, updated: 1, markedMissing: 2 });

    const same = await s.byKey("same.txt");

    expect(same!.lastSeenAt!.getTime()).toBeGreaterThan(before!.lastSeenAt!.getTime());
    expect(same!.modifiedAt).toEqual(before!.modifiedAt);
    expect(await s.byKey("changes.txt")).toMatchObject({ size: 17, status: "ready" });
    expect(await s.byKey("goes.txt")).toMatchObject({ status: "missing", name: "goes.txt" });

    await expect(
      alice.file.downloadUrl({ fileId: (await s.byKey("goes.txt"))!.id }),
    ).rejects.toThrow("no longer in the bucket");

    expect(
      (await alice.file.listMissing({ storageId: s.storageId })).items.map((f) => f.name),
    ).toEqual(["goes.txt", "returns.txt"]);

    expect((await alice.storage.syncStatus({ storageId: s.storageId })).missing).toBe(2);

    // Its name is taken while it's gone, so it comes back renamed.
    const root = (await alice.folder.get({ storageId: s.storageId })).folder.id;

    await db.insert(files).values({
      storageId: s.storageId,
      folderId: root,
      name: "returns.txt",
      objectKey: `${s.prefix}/other`,
      size: 5,
      status: "ready",
      lastSeenAt: new Date(),
    });

    await s.put("other");
    await s.put("returns.txt");
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await s.sync();

    expect(await s.byKey("returns.txt")).toMatchObject({
      status: "ready",
      name: "returns (1).txt",
    });

    expect(await s.byKey("goes.txt")).toMatchObject({ status: "missing" });
  });

  test("what the user did in the app survives a re-sync, and folders aren't re-derived", async () => {
    const s = await setup();

    await s.put("docs/a.txt");
    await s.put("docs/b.txt");
    await s.put("docs/c.txt");
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await s.sync();

    const root = (await alice.folder.get({ storageId: s.storageId })).folder.id;

    const [a, b, c] = [
      await s.byKey("docs/a.txt"),
      await s.byKey("docs/b.txt"),
      await s.byKey("docs/c.txt"),
    ];

    await alice.file.rename({ fileId: a!.id, name: "renamed.txt" });
    await alice.file.move({ fileId: a!.id, folderId: root });
    await alice.file.star({ fileId: b!.id, starred: true });
    await alice.file.trash({ fileId: c!.id });

    await s.sync();

    expect(await s.byKey("docs/a.txt")).toMatchObject({
      name: "renamed.txt",
      folderId: root,
      status: "ready",
    });

    expect(await s.byKey("docs/b.txt")).toMatchObject({ starred: true, status: "ready" });

    const trashed = await s.byKey("docs/c.txt");

    expect(trashed!.trashedAt).not.toBeNull();
    expect(trashed!.status).toBe("ready");

    const docs = await db
      .select()
      .from(folders)
      .where(and(eq(folders.storageId, s.storageId), eq(folders.name, "docs")));

    expect(docs).toHaveLength(1);
  });

  test("the app's own layout with no row is restored into Recovered, with its original ID", async () => {
    const s = await setup();
    const id = crypto.randomUUID();

    await s.put(`${id}/report.pdf`);
    await s.put(`${crypto.randomUUID()}/report.pdf`);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await s.sync();

    const file = await s.byKey(`${id}/report.pdf`);

    expect(file!.id).toBe(id);

    const root = await alice.folder.get({ storageId: s.storageId });

    expect(root.children.map((f) => f.name)).toEqual(["Recovered"]);

    const names = (
      await alice.file.list({ storageId: s.storageId, folderId: root.children[0]!.id })
    ).items.map((f) => f.name);

    expect(names.toSorted()).toEqual(["report (1).pdf", "report.pdf"]);
  });

  test("a failure part-way marks nothing missing, and a restart resumes where it left off", async () => {
    const s = await setup();

    for (const k of ["a", "b", "c", "d", "e"]) await s.put(`${k}.txt`);

    await new Promise((resolve) => setTimeout(resolve, 1100));
    await s.sync();
    await s.remove("e.txt"); // would be marked missing by a complete listing

    control.pages = 0;
    control.failOnPage = 2;

    const failed = await s.sync();

    control.failOnPage = 0;

    expect(failed).toMatchObject({
      status: "failed",
      error: "The connection dropped",
      markedMissing: 0,
      listed: 2,
    });

    expect(await s.byKey("e.txt")).toMatchObject({ status: "ready" });
    expect(await db.select().from(jobs)).toEqual([]);

    // As if the process had died: the run still says running, and its job's lease has expired.
    const [run] = await db
      .select()
      .from(syncRuns)
      .where(eq(syncRuns.storageId, s.storageId))
      .orderBy(desc(syncRuns.startedAt))
      .limit(1);

    const token = (await db.select().from(syncRuns).where(eq(syncRuns.id, run!.id)))[0]!
      .continuationToken;

    expect(token).toBeTruthy();

    await db
      .update(syncRuns)
      .set({ status: "running", error: null, finishedAt: null })
      .where(eq(syncRuns.id, run!.id));

    await db.insert(jobs).values({
      type: "sync",
      payload: { storageId: s.storageId, runId: run!.id },
      status: "running",
      runAt: new Date(0),
      leaseUntil: new Date(0),
    });

    await runJobs();

    const resumed = (await alice.storage.syncStatus({ storageId: s.storageId })).run!;

    expect(resumed).toMatchObject({ status: "complete", listed: 4, markedMissing: 1 });
    expect(await s.byKey("e.txt")).toMatchObject({ status: "missing" });
  });

  test("a bad credential fails the run with its error and marks nothing", async () => {
    const s = await setup();

    await s.put("a.txt");
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await s.sync();

    await alice.storage.update({
      name: s.prefix,
      provider: "minio",
      endpoint: endpoint!,
      region: "us-east-1",
      bucket: "fileee",
      prefix: s.prefix,
      forcePathStyle: true,
      accessKeyId: "",
      secretAccessKey: "wrong",
      storageId: s.storageId,
    });

    const run = await s.sync();

    expect(run.status).toBe("failed");
    expect(run.error).toContain("SignatureDoesNotMatch");
    expect(await s.byKey("a.txt")).toMatchObject({ status: "ready" });
  });

  test("active uploads and objects newer than the run are left alone", async () => {
    const s = await setup();
    const root = (await alice.folder.get({ storageId: s.storageId })).folder.id;

    // Bytes arrived, but the browser hasn't called complete yet.
    const started = await alice.upload.start({
      storageId: s.storageId,
      folderId: root,
      name: "up.txt",
      size: 5,
      mimeType: "",
    });

    if (started.kind !== "single") throw new Error("expected single");

    await fetch(started.url, { method: "PUT", body: "hello" });
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await s.sync();
    expect(await s.rows()).toHaveLength(1);

    expect((await db.select().from(files).where(eq(files.id, started.fileId)))[0]!.status).toBe(
      "pending",
    );

    await alice.upload.complete({ fileId: started.fileId });

    // A run that began an hour ago: this object is newer, so it isn't imported, and an overwritten one isn't called missing.
    await s.put("new.txt");

    const kept = (await db.select().from(files).where(eq(files.id, started.fileId)))[0]!;

    await s.put(kept.objectKey.slice(s.prefix.length + 1), "overwritten");

    await db
      .update(files)
      .set({ modifiedAt: new Date(0), lastSeenAt: new Date(0) })
      .where(eq(files.id, kept.id));

    const [run] = await db
      .insert(syncRuns)
      .values({
        storageId: s.storageId,
        trigger: "manual",
        status: "running",
        startedAt: new Date(Date.now() - 3_600_000),
      })
      .returning();

    await db.insert(jobs).values({
      type: "sync",
      payload: { storageId: s.storageId, runId: run!.id },
      runAt: new Date(0),
    });

    await runJobs();
    expect(await s.byKey("new.txt")).toBeUndefined();

    expect((await db.select().from(files).where(eq(files.id, kept.id)))[0]).toMatchObject({
      status: "ready",
      size: 5,
    });
  });

  test("uploaded files aren't called missing by a sync already under way", async () => {
    const s = await setup();
    const root = (await alice.folder.get({ storageId: s.storageId })).folder.id;

    const [run] = await db
      .insert(syncRuns)
      .values({
        storageId: s.storageId,
        trigger: "manual",
        status: "running",
        startedAt: new Date(Date.now() - 60_000),
      })
      .returning();

    // Became ready after the run started, with no object for the listing to see.
    await db.insert(files).values({
      storageId: s.storageId,
      folderId: root,
      name: "fresh.txt",
      objectKey: `${s.prefix}/fresh`,
      size: 1,
      status: "ready",
    });

    await db.insert(jobs).values({
      type: "sync",
      payload: { storageId: s.storageId, runId: run!.id },
      runAt: new Date(0),
    });

    await runJobs();
    expect(await s.byKey("fresh")).toMatchObject({ status: "ready" });
  });

  test("one run at a time per storage", async () => {
    const s = await setup();

    const [a, b] = await Promise.all([
      alice.storage.sync({ storageId: s.storageId }),
      alice.storage.sync({ storageId: s.storageId }),
    ]);

    expect(a.id).toBe(b.id);
    await runJobs();
  });

  test("the daily schedule queues only storages not synced in the last day", async () => {
    const s = await setup();
    const count = () => db.select().from(syncRuns).where(eq(syncRuns.storageId, s.storageId));
    const before = (await count()).length;

    await scheduleSyncs();
    expect(await count()).toHaveLength(before);
    await scheduleSyncs(new Date(Date.now() + 25 * 3_600_000));

    const after = await count();

    expect(after).toHaveLength(before + 1);
    expect(after.filter((r) => r.trigger === "schedule")).toHaveLength(1);
    await runJobs();
  });

  test("purge and sync don't overlap on one storage", async () => {
    const s = await setup();

    await s.put("a.txt");
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await s.sync();

    const file = await s.byKey("a.txt");

    await alice.file.trash({ fileId: file!.id });

    const purge = alice.file.purge({ fileId: file!.id });
    const syncing = alice.storage.sync({ storageId: s.storageId });

    await Promise.all([purge, syncing]);
    await runJobs();
    expect(await s.byKey("a.txt")).toBeUndefined();
    expect(await db.select().from(jobs)).toEqual([]);
  });

  test("an object deleted outside the app gives a clear error at download, and marks the row", async () => {
    const s = await setup();

    await s.put("gone.txt");
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await s.sync();

    const file = await s.byKey("gone.txt");

    await s.remove("gone.txt");

    await expect(alice.file.downloadUrl({ fileId: file!.id })).rejects.toThrow(
      "no longer in the bucket",
    );

    expect(await s.byKey("gone.txt")).toMatchObject({ status: "missing" });
  });

  test("another user can't sync or inspect this storage", async () => {
    const s = await setup();

    await expect(bob.storage.sync({ storageId: s.storageId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    await expect(bob.storage.syncStatus({ storageId: s.storageId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    await expect(bob.file.listMissing({ storageId: s.storageId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  test("a storage's root still has no parent after imports", async () => {
    const s = await setup();

    const roots = await db
      .select()
      .from(folders)
      .where(and(eq(folders.storageId, s.storageId), isNull(folders.parentId)));

    expect(roots).toHaveLength(1);
  });
});
