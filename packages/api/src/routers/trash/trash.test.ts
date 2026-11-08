// The purge tests run against MinIO: docker compose -f docker-compose.dev.yml up -d, then S3_TEST_ENDPOINT=http://localhost:9000 pnpm test
import { db, files, folders, jobs } from "@fileee/db";
import { createClient, headObject } from "@fileee/storage";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";
import { runJobs } from "../../lib/jobs.ts";
import { ADMIN, setupTestApp } from "../../test-utils.ts";

const endpoint = process.env.S3_TEST_ENDPOINT;
const { browser } = await setupTestApp();
const alice = browser();
const bob = browser();
let storageId: string;
let rootId: string;

const connection = {
  name: "Test",
  provider: "minio" as const,
  endpoint: endpoint ?? "http://localhost:9",
  region: "us-east-1",
  bucket: "fileee",
  prefix: `trash-${crypto.randomUUID()}`,
  forcePathStyle: true,
  accessKeyId: "minioadmin",
  secretAccessKey: "minioadmin",
};

/** A ready file row with no object behind it, for tests that don't touch the bucket. */
async function addFile(folderId: string, name: string) {
  const id = crypto.randomUUID();

  await db.insert(files).values({
    id,
    storageId,
    folderId,
    name,
    objectKey: `${connection.prefix}/${id}/${name}`,
    size: 1,
    status: "ready",
  });

  return id;
}

const newFolder = (parentId: string, name: string) =>
  alice.folder.create({ storageId, parentId, name });

const namesIn = async (folderId: string) =>
  (await alice.file.list({ storageId, folderId })).items.map((f) => f.name);

const subfolders = async (folderId: string) =>
  (await alice.folder.get({ storageId, folderId })).children.map((f) => f.name);

beforeAll(async () => {
  await alice.setup.complete(ADMIN);

  await alice.user.create({
    name: "Bob",
    email: "bob@example.com",
    password: "a long enough password",
    role: "user",
  });

  await bob.auth.login({ email: "bob@example.com", password: "a long enough password" });
  storageId = (await alice.storage.create(connection)).id;
  rootId = (await alice.folder.get({ storageId })).folder.id;
});

test("rename keeps the object key, and collisions get a suffix", async () => {
  const folder = await newFolder(rootId, "rename");
  const a = await addFile(folder.id, "a.txt");

  await addFile(folder.id, "taken.txt");

  const [before] = await db.select().from(files).where(eq(files.id, a));
  const renamed = await alice.file.rename({ fileId: a, name: "taken.txt" });

  expect(renamed.name).toBe("taken (1).txt");
  expect(renamed.objectKey).toBe(before!.objectKey);

  await expect(alice.file.rename({ fileId: a, name: "bad/name" })).rejects.toThrow(
    "Input validation failed",
  );
});

test("moving a folder of 10,000 files is one row update", async () => {
  const big = await newFolder(rootId, "big");
  const target = await newFolder(rootId, "target");

  const rows = Array.from({ length: 10_000 }, (_, i) => {
    const id = crypto.randomUUID();

    return {
      id,
      storageId,
      folderId: big.id,
      name: `f${i}.txt`,
      objectKey: `${connection.prefix}/${id}`,
      size: 1,
      status: "ready" as const,
    };
  });

  for (let i = 0; i < rows.length; i += 1000)
    await db.insert(files).values(rows.slice(i, i + 1000));

  const started = performance.now();

  await alice.folder.move({ folderId: big.id, parentId: target.id });
  expect(performance.now() - started).toBeLessThan(500);
  expect(await subfolders(target.id)).toEqual(["big"]);
  expect((await alice.file.list({ storageId, folderId: big.id })).items).toHaveLength(50);
  await alice.folder.trash({ folderId: target.id });
});

test("opposite moves at the same time can't make a loop", async () => {
  const [a, b] = [await newFolder(rootId, "race-a"), await newFolder(rootId, "race-b")];

  const results = await Promise.allSettled([
    alice.folder.move({ folderId: a.id, parentId: b.id }),
    alice.folder.move({ folderId: b.id, parentId: a.id }),
  ]);

  expect(results.map((r) => r.status).toSorted()).toEqual(["fulfilled", "rejected"]);
});

test("a folder can't move into itself or its descendants, and the root can't move", async () => {
  const a = await newFolder(rootId, "cycle");
  const b = await newFolder(a.id, "child");
  const c = await newFolder(b.id, "grandchild");

  await expect(alice.folder.move({ folderId: a.id, parentId: a.id })).rejects.toMatchObject({
    code: "CONFLICT",
  });

  await expect(alice.folder.move({ folderId: a.id, parentId: c.id })).rejects.toMatchObject({
    code: "CONFLICT",
  });

  await expect(alice.folder.move({ folderId: rootId, parentId: a.id })).rejects.toMatchObject({
    code: "CONFLICT",
  });

  await expect(alice.folder.trash({ folderId: rootId })).rejects.toMatchObject({
    code: "CONFLICT",
  });

  await expect(alice.folder.rename({ folderId: rootId, name: "x" })).rejects.toMatchObject({
    code: "CONFLICT",
  });
});

test("moving into a folder from another storage is refused", async () => {
  const other = await alice.storage.create({ ...connection, name: "Other" });
  const otherRoot = (await alice.folder.get({ storageId: other.id })).folder.id;
  const f = await addFile(rootId, "stay.txt");

  await expect(alice.file.move({ fileId: f, folderId: otherRoot })).rejects.toMatchObject({
    code: "NOT_FOUND",
  });

  await alice.storage.remove({ storageId: other.id });
});

test("trash hides a subtree from every view, lists only the top item, and restore brings it back", async () => {
  const top = await newFolder(rootId, "project");
  const sub = await newFolder(top.id, "src");
  const inner = await addFile(sub.id, "inner.txt");

  await alice.file.star({ fileId: inner, starred: true });
  expect((await alice.file.starred()).map((f) => f.id)).toContain(inner);

  await alice.folder.trash({ folderId: top.id });

  expect(await subfolders(rootId)).not.toContain("project");
  expect((await alice.file.recent()).map((f) => f.id)).not.toContain(inner);
  expect((await alice.file.starred()).map((f) => f.id)).not.toContain(inner);

  await expect(alice.folder.get({ storageId, folderId: sub.id })).rejects.toMatchObject({
    code: "NOT_FOUND",
  });

  await expect(alice.file.downloadUrl({ fileId: inner })).rejects.toMatchObject({
    code: "CONFLICT",
  });

  await expect(alice.file.rename({ fileId: inner, name: "x" })).rejects.toMatchObject({
    code: "CONFLICT",
  });

  const listed = await alice.trash.list();

  expect(listed.folders.map((f) => f.name)).toContain("project");
  expect(listed.folders.map((f) => f.name)).not.toContain("src");
  expect(listed.files.map((f) => f.id)).not.toContain(inner);

  await alice.folder.restore({ folderId: top.id });
  expect(await namesIn(sub.id)).toEqual(["inner.txt"]);
  expect((await alice.file.starred()).map((f) => f.id)).toContain(inner);
});

test("an item trashed earlier stays in trash when its folder is restored", async () => {
  const top = await newFolder(rootId, "earlier");
  const early = await addFile(top.id, "early.txt");
  const late = await addFile(top.id, "late.txt");

  await alice.file.trash({ fileId: early });
  await new Promise((resolve) => setTimeout(resolve, 2)); // distinct timestamps
  await alice.folder.trash({ folderId: top.id });
  await alice.folder.restore({ folderId: top.id });
  expect(await namesIn(top.id)).toEqual(["late.txt"]);
  expect((await alice.trash.list()).files.map((f) => f.id)).toContain(early);
  expect(late).toBeTruthy();
});

test("restore resolves name collisions, and falls back to the root when the parent is in trash", async () => {
  const dir = await newFolder(rootId, "collide");
  const a = await addFile(dir.id, "same.txt");

  await alice.file.trash({ fileId: a });
  await addFile(dir.id, "same.txt");
  expect((await alice.file.restore({ fileId: a })).name).toBe("same (1).txt");

  const b = await addFile(dir.id, "orphan.txt");

  await alice.file.trash({ fileId: b });
  await new Promise((resolve) => setTimeout(resolve, 2));
  await alice.folder.trash({ folderId: dir.id });
  expect((await alice.file.restore({ fileId: b })).folderId).toBe(rootId);
});

test("permanent delete needs trash first", async () => {
  const f = await addFile(rootId, "live.txt");

  await expect(alice.file.purge({ fileId: f })).rejects.toMatchObject({ code: "CONFLICT" });

  const d = await newFolder(rootId, "live-dir");

  await expect(alice.folder.purge({ folderId: d.id })).rejects.toMatchObject({ code: "CONFLICT" });
});

test("another user can't touch this user's items", async () => {
  const f = await addFile(rootId, "mine.txt");
  const d = await newFolder(rootId, "mine");
  const notFound = { code: "NOT_FOUND" };

  await expect(bob.file.rename({ fileId: f, name: "x" })).rejects.toMatchObject(notFound);
  await expect(bob.file.move({ fileId: f, folderId: rootId })).rejects.toMatchObject(notFound);
  await expect(bob.file.star({ fileId: f, starred: true })).rejects.toMatchObject(notFound);
  await expect(bob.file.trash({ fileId: f })).rejects.toMatchObject(notFound);
  await expect(bob.file.restore({ fileId: f })).rejects.toMatchObject(notFound);
  await expect(bob.file.purge({ fileId: f })).rejects.toMatchObject(notFound);
  await expect(bob.folder.rename({ folderId: d.id, name: "x" })).rejects.toMatchObject(notFound);

  await expect(bob.folder.move({ folderId: d.id, parentId: rootId })).rejects.toMatchObject(
    notFound,
  );

  await expect(bob.folder.trash({ folderId: d.id })).rejects.toMatchObject(notFound);
  await expect(bob.folder.restore({ folderId: d.id })).rejects.toMatchObject(notFound);
  await expect(bob.folder.purge({ folderId: d.id })).rejects.toMatchObject(notFound);
  expect(await bob.trash.list()).toEqual({ files: [], folders: [] });
  expect(await bob.file.starred()).toEqual([]);
});

const put = async (url: string, body: string) => {
  const res = await fetch(url, { method: "PUT", body });

  if (!res.ok) throw new Error(`PUT failed: ${res.status}`);
};

describe.skipIf(!endpoint)("permanent delete against MinIO", () => {
  const s3 = createClient({ ...connection, endpoint: endpoint ?? null });

  const upload = async (folderId: string, name: string) => {
    const started = await alice.upload.start({ storageId, folderId, name, size: 5, mimeType: "" });

    if (started.kind !== "single") throw new Error("expected single");

    await put(started.url, "hello");

    return alice.upload.complete({ fileId: started.fileId });
  };

  const exists = (key: string) => headObject(s3, connection.bucket, key);

  test("a purged folder leaves no objects or rows, but spares what was trashed earlier", async () => {
    const top = await newFolder(rootId, "purge-me");
    const sub = await newFolder(top.id, "sub");
    const a = await upload(top.id, "a.txt");
    const b = await upload(sub.id, "b.txt");
    const spared = await upload(sub.id, "spared.txt");

    await alice.file.trash({ fileId: spared.id });
    await new Promise((resolve) => setTimeout(resolve, 2));
    await alice.folder.trash({ folderId: top.id });

    await alice.folder.purge({ folderId: top.id });
    expect((await alice.trash.list()).folders.map((f) => f.id)).not.toContain(top.id);
    await runJobs();

    expect(await exists(a.objectKey)).toBeNull();
    expect(await exists(b.objectKey)).toBeNull();
    expect(await db.select().from(folders).where(eq(folders.id, top.id))).toEqual([]);
    expect(await db.select().from(files).where(eq(files.id, a.id))).toEqual([]);
    expect(await exists(spared.objectKey)).not.toBeNull();
    expect((await alice.file.restore({ fileId: spared.id })).folderId).toBe(rootId);
    expect(await db.select().from(jobs)).toEqual([]);
  });

  test("a pending multipart upload in a purged folder is aborted, and can't complete afterwards", async () => {
    const top = await newFolder(rootId, "purge-pending");

    const started = await alice.upload.start({
      storageId,
      folderId: top.id,
      name: "m.bin",
      size: 32 * 1024 * 1024,
      mimeType: "",
    });

    await alice.folder.trash({ folderId: top.id });
    await alice.folder.purge({ folderId: top.id });

    await expect(alice.upload.complete({ fileId: started.fileId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    await runJobs();
    expect(await db.select().from(files).where(eq(files.id, started.fileId))).toEqual([]);
    expect(await db.select().from(jobs)).toEqual([]);
  });

  test("an upload finishing after its folder was trashed goes to trash too", async () => {
    const top = await newFolder(rootId, "trashed-mid-upload");

    const started = await alice.upload.start({
      storageId,
      folderId: top.id,
      name: "late.txt",
      size: 5,
      mimeType: "",
    });

    if (started.kind !== "single") throw new Error("expected single");

    await put(started.url, "hello");
    await alice.folder.trash({ folderId: top.id });

    const file = await alice.upload.complete({ fileId: started.fileId });

    expect((await alice.file.recent()).map((f) => f.id)).not.toContain(file.id);
    await alice.folder.restore({ folderId: top.id });
    expect(await namesIn(top.id)).toEqual(["late.txt"]);
  });

  test("empty trash removes everything; a failed job retries and keeps the rows until it succeeds", async () => {
    const f = await upload(rootId, "empty-me.txt");

    await alice.file.trash({ fileId: f.id });

    // A bad secret makes the provider refuse the delete.
    await alice.storage.update({
      ...connection,
      storageId,
      accessKeyId: "",
      secretAccessKey: "wrong",
    });

    await alice.trash.empty();
    await runJobs();

    const [job] = await db.select().from(jobs);

    expect(job).toMatchObject({ status: "pending", attempts: 1 });
    expect(job!.runAt.getTime()).toBeGreaterThan(Date.now());
    expect(await exists(f.objectKey)).not.toBeNull();
    expect((await db.select().from(files).where(eq(files.id, f.id)))[0]?.status).toBe("purging");
    expect((await alice.trash.list()).files.map((x) => x.id)).not.toContain(f.id);

    await alice.storage.update({
      ...connection,
      storageId,
      accessKeyId: "",
      secretAccessKey: "minioadmin",
    });

    await db.update(jobs).set({ runAt: new Date(0) });
    await runJobs();
    expect(await exists(f.objectKey)).toBeNull();
    expect(await db.select().from(jobs)).toEqual([]);
    expect(await alice.trash.list()).toEqual({ files: [], folders: [] });
  });
});
