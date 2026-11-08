// Runs against MinIO: docker compose -f docker-compose.dev.yml up -d, then S3_TEST_ENDPOINT=http://localhost:9000 pnpm test
import { db, files, uploads } from "@fileee/db";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";
import { cleanupExpiredUploads } from "../../lib/cleanup.ts";
import { ADMIN, setupTestApp } from "../../test-utils.ts";

const endpoint = process.env.S3_TEST_ENDPOINT;
const { browser } = await setupTestApp();
const alice = browser();
const bob = browser();

const connection = {
  name: "MinIO",
  provider: "minio" as const,
  endpoint: endpoint ?? "",
  region: "us-east-1",
  bucket: "fileee",
  prefix: `test-${crypto.randomUUID()}`,
  forcePathStyle: true,
  accessKeyId: "minioadmin",
  secretAccessKey: "minioadmin",
};

const put = async (url: string, body: string | Uint8Array) => {
  const res = await fetch(url, { method: "PUT", body });

  if (!res.ok) throw new Error(`PUT failed: ${res.status} ${await res.text()}`);
};

const rowFor = async (fileId: string) =>
  (await db.select().from(files).where(eq(files.id, fileId)))[0];

const expire = (fileId: string) =>
  db
    .update(uploads)
    .set({ expiresAt: new Date(0) })
    .where(eq(uploads.fileId, fileId));

describe.skipIf(!endpoint)("storage and uploads against MinIO", () => {
  let storageId: string;
  let rootId: string;

  const startSmall = (name: string, size = 5) =>
    alice.upload.start({ storageId, folderId: rootId, name, size, mimeType: "text/plain" });

  const uploadSmall = async (name: string, body = "hello") => {
    const started = await startSmall(name, body.length);

    if (started.kind !== "single") throw new Error("expected single");

    await put(started.url, body);

    return alice.upload.complete({ fileId: started.fileId });
  };

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

  test("the connection test passes every step and a bad secret names the failing step", async () => {
    const result = await alice.storage.test({ storageId });

    expect(result.steps.map((s) => s.step)).toEqual([
      "list",
      "put",
      "get",
      "listing",
      "ranged get",
      "multipart",
      "copy",
      "delete",
    ]);

    expect(result.ok).toBe(true);

    const bad = await alice.storage.create({
      ...connection,
      name: "Bad",
      secretAccessKey: "wrong",
    });

    const failed = await alice.storage.test({ storageId: bad.id });

    expect(failed.ok).toBe(false);
    expect(failed.steps[0]).toMatchObject({ step: "list", ok: false, fix: expect.any(String) });
    expect((await alice.storage.list()).find((s) => s.id === bad.id)?.status).toBe("error");
    await alice.storage.remove({ storageId: bad.id });
  });

  test("the API never returns secrets", async () => {
    const [storage] = await alice.storage.list();
    const json = JSON.stringify(storage);

    expect(json).not.toContain("minioadmin");
    expect(storage!.accessKeyHint).toBe("dmin");
    expect(json).not.toContain("encryptedCredentials");
  });

  test("single upload: hidden until complete, then size and ETag come from the bucket", async () => {
    const started = await startSmall("hi.txt", 999);

    expect((await alice.file.list({ storageId, folderId: rootId })).items).toEqual([]);

    if (started.kind !== "single") throw new Error("expected single");

    await put(started.url, "hello");

    const file = await alice.upload.complete({ fileId: started.fileId });

    expect(file).toMatchObject({ status: "ready", size: 5, name: "hi.txt" });
    expect(file.etag).toBeTruthy();

    const { url } = await alice.file.downloadUrl({ fileId: file.id });
    const res = await fetch(url);

    expect(await res.text()).toBe("hello");
    expect(res.headers.get("content-disposition")).toContain("hi.txt");
  });

  test("completing before the bytes arrive fails and keeps the file hidden", async () => {
    const started = await startSmall("never.txt");

    await expect(alice.upload.complete({ fileId: started.fileId })).rejects.toMatchObject({
      code: "CONFLICT",
    });

    expect((await rowFor(started.fileId))?.status).toBe("pending");
    await alice.upload.abort({ fileId: started.fileId });
    expect(await rowFor(started.fileId)).toBeUndefined();
  });

  test("name collisions are resolved when the file becomes ready", async () => {
    const a = await uploadSmall("dup.txt");
    const b = await uploadSmall("dup.txt");

    expect([a.name, b.name]).toEqual(["dup.txt", "dup (1).txt"]);
  });

  test("multipart: resumes from what the bucket has, and checks for missing parts", async () => {
    const partSize = 16 * 1024 * 1024;
    const size = partSize + 1024;

    const started = await alice.upload.start({
      storageId,
      folderId: rootId,
      name: "big.bin",
      size,
      mimeType: "",
    });

    if (started.kind !== "multipart") throw new Error("expected multipart");

    expect(started.partSize).toBe(partSize);

    const body = Buffer.alloc(size, 7);

    const sign = async (partNumber: number) =>
      (await alice.upload.signParts({ fileId: started.fileId, partNumbers: [partNumber] }))[0]!.url;

    await put(await sign(1), body.subarray(0, partSize));
    await expect(alice.upload.complete({ fileId: started.fileId })).rejects.toThrow("1 of 2 parts");

    expect(await alice.upload.resume({ fileId: started.fileId })).toMatchObject({
      kind: "multipart",
      uploadedParts: [1],
    });

    expect((await alice.upload.listPending()).map((p) => p.fileId)).toContain(started.fileId);

    await put(await sign(2), body.subarray(partSize));

    const file = await alice.upload.complete({ fileId: started.fileId });

    expect(file).toMatchObject({ status: "ready", size });

    expect(await alice.upload.complete({ fileId: started.fileId })).toMatchObject({
      status: "ready",
    });
  });

  test("cleanup: single with object becomes ready, single without is removed, multipart is aborted", async () => {
    const arrived = await startSmall("arrived.txt");

    if (arrived.kind !== "single") throw new Error("expected single");

    await put(arrived.url, "hello");

    const lost = await startSmall("lost.txt");

    const multi = await alice.upload.start({
      storageId,
      folderId: rootId,
      name: "m.bin",
      size: 32 * 1024 * 1024,
      mimeType: "",
    });

    const live = await startSmall("live.txt");

    await Promise.all([expire(arrived.fileId), expire(lost.fileId), expire(multi.fileId)]);

    await cleanupExpiredUploads();

    expect((await rowFor(arrived.fileId))?.status).toBe("ready");
    expect(await rowFor(lost.fileId)).toBeUndefined();
    expect(await rowFor(multi.fileId)).toBeUndefined();
    expect((await rowFor(live.fileId))?.status).toBe("pending");
    await alice.upload.abort({ fileId: live.fileId });
  });

  test("folders: tree lives in the database, collisions get a suffix, ensurePath reuses", async () => {
    const a = await alice.folder.create({ storageId, parentId: rootId, name: "docs" });
    const b = await alice.folder.create({ storageId, parentId: rootId, name: "docs" });

    expect(b.name).toBe("docs (1)");

    const { folderId } = await alice.folder.ensurePath({
      storageId,
      parentId: rootId,
      segments: ["docs", "x", "y"],
    });

    const again = await alice.folder.ensurePath({
      storageId,
      parentId: rootId,
      segments: ["docs", "x", "y"],
    });

    expect(again.folderId).toBe(folderId);

    const got = await alice.folder.get({ storageId, folderId });

    expect(got.path.map((f) => f.name)).toEqual(["docs", "x", "y"]);
    expect(got.path[0]!.id).toBe(a.id);
  });

  test("another user can't touch this user's storages or files", async () => {
    const file = await uploadSmall("private.txt");
    const pending = await startSmall("pending.txt");
    const notFound = { code: "NOT_FOUND" };

    await expect(bob.storage.test({ storageId })).rejects.toMatchObject(notFound);
    await expect(bob.storage.corsInfo({ storageId })).rejects.toMatchObject(notFound);
    await expect(bob.storage.remove({ storageId })).rejects.toMatchObject(notFound);
    await expect(bob.folder.get({ storageId })).rejects.toMatchObject(notFound);
    await expect(bob.file.list({ storageId, folderId: rootId })).rejects.toMatchObject(notFound);
    await expect(bob.file.downloadUrl({ fileId: file.id })).rejects.toMatchObject(notFound);

    await expect(
      bob.upload.start({ storageId, folderId: rootId, name: "x", size: 1, mimeType: "" }),
    ).rejects.toMatchObject(notFound);

    await expect(bob.upload.complete({ fileId: pending.fileId })).rejects.toMatchObject(notFound);
    await expect(bob.upload.abort({ fileId: pending.fileId })).rejects.toMatchObject(notFound);
    expect(await bob.storage.list()).toEqual([]);
    expect(await bob.file.recent()).toEqual([]);
    expect(await bob.upload.listPending()).toEqual([]);
    await alice.upload.abort({ fileId: pending.fileId });
  });

  test("a folder from another storage is refused", async () => {
    const other = await alice.storage.create({ ...connection, name: "Other" });

    await expect(
      alice.upload.start({
        storageId: other.id,
        folderId: rootId,
        name: "x",
        size: 1,
        mimeType: "",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await alice.storage.remove({ storageId: other.id });
  });

  test("removing a storage removes its index but cascades nothing else", async () => {
    const other = await alice.storage.create({ ...connection, name: "Gone" });
    const root = (await alice.folder.get({ storageId: other.id })).folder.id;

    const started = await alice.upload.start({
      storageId: other.id,
      folderId: root,
      name: "a.txt",
      size: 1,
      mimeType: "",
    });

    await alice.storage.remove({ storageId: other.id });
    expect(await rowFor(started.fileId)).toBeUndefined();
  });
});
