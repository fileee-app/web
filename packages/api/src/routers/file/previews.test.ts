// The MinIO part runs against: docker compose -f docker-compose.dev.yml up -d, then S3_TEST_ENDPOINT=http://localhost:9000 pnpm test
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { db, files } from "@fileee/db";
import { createClient, headObject } from "@fileee/storage";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, test, vi } from "vitest";
import { runJobs } from "../../lib/jobs.ts";
import { previewOf } from "../../lib/mime.ts";
import { ADMIN, setupTestApp } from "../../test-utils.ts";

const endpoint = process.env.S3_TEST_ENDPOINT;
const { browser } = await setupTestApp();
const alice = browser();
const bob = browser();

const row = async (fileId: string) =>
  (await db.select().from(files).where(eq(files.id, fileId)))[0]!;

const putThumbnail = async (fileId: string) => {
  const { url } = await alice.file.signThumbnail({ fileId });

  await fetch(url!, { method: "PUT", body: "webp bytes" });
};

test("what a file may render as comes from its name, and HTML is only ever text", () => {
  expect(previewOf("page.html")).toEqual({ kind: "text", contentType: "text/plain" });
  expect(previewOf("page.HTM")).toEqual({ kind: "text", contentType: "text/plain" });
  expect(previewOf("a.svg")).toEqual({ kind: "image", contentType: "image/svg+xml" });
  expect(previewOf("clip.webm").kind).toBe("video");
  expect(previewOf("song.mp3").kind).toBe("audio");
  expect(previewOf("doc.pdf").kind).toBe("pdf");
  expect(previewOf("main.ts").kind).toBe("text");
  expect(previewOf("sheet.xlsx").kind).toBe("none");
  expect(previewOf("noextension").kind).toBe("none");
});

describe.skipIf(!endpoint)("previews against MinIO", () => {
  const prefix = `previews-${crypto.randomUUID()}`;

  const s3 = createClient({
    endpoint: endpoint ?? null,
    region: "us-east-1",
    bucket: "fileee",
    prefix: "",
    forcePathStyle: true,
    accessKeyId: "minioadmin",
    secretAccessKey: "minioadmin",
  });

  let storageId: string;
  let rootId: string;

  /** Through the real upload flow, with the content type a browser would send. */
  const upload = async (name: string, body: string, mimeType = "") => {
    const started = await alice.upload.start({
      storageId,
      folderId: rootId,
      name,
      size: body.length,
      mimeType,
    });

    if (started.kind !== "single") throw new Error("expected single");

    await fetch(started.url, {
      method: "PUT",
      body,
      headers: mimeType ? { "Content-Type": mimeType } : {},
    });

    await alice.upload.complete({ fileId: started.fileId });

    return started.fileId;
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

    storageId = (
      await alice.storage.create({
        name: "MinIO",
        provider: "minio",
        endpoint: endpoint!,
        region: "us-east-1",
        bucket: "fileee",
        prefix,
        forcePathStyle: true,
        accessKeyId: "minioadmin",
        secretAccessKey: "minioadmin",
      })
    ).id;

    await runJobs();
    rootId = (await alice.folder.get({ storageId })).folder.id;
  });

  test.each([
    ["evil.html", "<script>alert(1)</script>", "text/html", "text", "text/plain"],
    // The browser's type is a hint: claiming to be an image changes nothing.
    ["evil2.html", "<script>alert(1)</script>", "image/png", "text", "text/plain"],
    ["evil3.svg", "<svg onload='alert(1)'/>", "image/svg+xml", "image", "image/svg+xml"],
    // And claiming to be HTML doesn't make an image name render as a page.
    ["photo.png", "<script>alert(1)</script>", "text/html", "image", "image/png"],
  ])(
    "%s can't render as a page from its URL, whatever the upload claimed",
    async (name, body, mimeType, kind, contentType) => {
      const fileId = await upload(name, body, mimeType);
      const preview = await alice.file.previewUrl({ fileId });

      expect(preview.kind).toBe(kind);
      expect(new URL(preview.url!).host).toBe(new URL(endpoint!).host);

      const res = await fetch(preview.url!);

      expect(res.headers.get("content-type")).toBe(contentType);
      expect(res.headers.get("content-disposition")).toMatch(/^attachment/);
      expect(await res.text()).toBe(body);
    },
  );

  test("an office document gets no preview URL", async () => {
    const fileId = await upload("sheet.xlsx", "bytes");

    expect(await alice.file.previewUrl({ fileId })).toEqual({ kind: "none", url: null });
    expect((await alice.file.signThumbnail({ fileId })).url).toBeNull();
  });

  test("ranges work on preview URLs, for video and the 1 MiB text limit", async () => {
    const fileId = await upload("notes.txt", "0123456789");
    const { url } = await alice.file.previewUrl({ fileId });
    const res = await fetch(url!, { headers: { Range: "bytes=0-3" } });

    expect(res.status).toBe(206);
    expect(await res.text()).toBe("0123");
  });

  test("a file gone from the bucket can't be previewed, and is marked missing", async () => {
    const fileId = await upload("gone.png", "x");
    const { objectKey } = await row(fileId);

    await s3.send(new DeleteObjectCommand({ Bucket: "fileee", Key: objectKey }));
    await expect(alice.file.previewUrl({ fileId })).rejects.toThrow("no longer in the bucket");
    expect((await row(fileId)).status).toBe("missing");
  });

  test("get returns what was extracted, plus the uploader", async () => {
    const fileId = await upload("a.png", "x", "image/png");

    await alice.file.saveExtracted({
      fileId,
      metadata: { width: 10, height: 20, camera: "Test" },
      thumbnail: false,
      sha256: "a".repeat(64),
    });

    expect(await alice.file.get({ fileId })).toMatchObject({
      metadata: { width: 10, height: 20, camera: "Test" },
      sha256: "a".repeat(64),
      uploaderName: "Admin",
      previewKind: "image",
      thumbnailKey: null,
    });
  });

  test("bad metadata is refused, and unknown fields are dropped", async () => {
    const fileId = await upload("b.png", "x");

    await expect(
      alice.file.saveExtracted({ fileId, metadata: { width: -1 }, thumbnail: false }),
    ).rejects.toThrow("Input validation failed");

    await expect(
      alice.file.saveExtracted({ fileId, thumbnail: false, sha256: "not a hash" }),
    ).rejects.toThrow("Input validation failed");

    await alice.file.saveExtracted({
      fileId,
      metadata: { pages: 1, html: "<b>" } as never,
      thumbnail: false,
    });

    expect((await row(fileId)).metadata).toEqual({ pages: 1 });
  });

  test("a thumbnail lives under .fileee, must exist, and reaches the list without an RPC per row", async () => {
    const fileId = await upload("c.png", "x");

    await expect(
      alice.file.saveExtracted({ fileId, metadata: {}, thumbnail: true }),
    ).rejects.toThrow("didn't reach the bucket");

    await putThumbnail(fileId);
    await alice.file.saveExtracted({ fileId, metadata: {}, thumbnail: true });
    expect((await row(fileId)).thumbnailKey).toBe(`${prefix}/.fileee/thumbs/${fileId}.webp`);

    const { items } = await alice.file.list({ storageId, folderId: rootId });
    const listed = items.find((f) => f.id === fileId)!;
    const res = await fetch(listed.thumbnailUrl!);

    expect(res.headers.get("content-type")).toBe("image/webp");
    expect(await res.text()).toBe("webp bytes");
    expect(items.find((f) => f.name === "notes.txt")?.thumbnailUrl).toBeNull();

    expect(new URL(listed.thumbnailUrl!).searchParams.get("X-Amz-Expires")).toBe("900");

    // Stable within a window, so a refetched list doesn't defeat the browser's cache.
    const WINDOW = 300_000;

    const urlAt = async (now: number) => {
      vi.setSystemTime(now);

      const page = await alice.file.list({ storageId, folderId: rootId });

      return page.items.find((f) => f.id === fileId)!.thumbnailUrl;
    };

    vi.useFakeTimers({ toFake: ["Date"] });

    try {
      const start = Math.ceil(Date.now() / WINDOW) * WINDOW;
      const url = await urlAt(start + 1000);

      expect(await urlAt(start + WINDOW - 1000)).toBe(url);
      expect(await urlAt(start + WINDOW + 1000)).not.toBe(url);
    } finally {
      vi.useRealTimers();
    }
  });

  test("a sync clears what was extracted when the object changes, not otherwise", async () => {
    const fileId = await upload("changes.png", "before");

    await putThumbnail(fileId);

    await alice.file.saveExtracted({
      fileId,
      metadata: { width: 1, height: 1 },
      thumbnail: true,
      sha256: "b".repeat(64),
    });

    const sync = async () => {
      await alice.storage.sync({ storageId });
      await runJobs();
    };

    await sync();
    expect((await row(fileId)).thumbnailKey).not.toBeNull();

    await new Promise((resolve) => setTimeout(resolve, 1100)); // LastModified has one-second precision

    await s3.send(
      new PutObjectCommand({
        Bucket: "fileee",
        Key: (await row(fileId)).objectKey,
        Body: "after, and longer",
      }),
    );

    await new Promise((resolve) => setTimeout(resolve, 1100));
    await sync();
    expect(await row(fileId)).toMatchObject({ thumbnailKey: null, metadata: null, sha256: null });
    expect((await row(fileId)).size).toBe("after, and longer".length);
  });

  test("backfill offers only what still needs work", async () => {
    const todo = await upload("todo.png", "x");
    const text = await upload("todo.md", "x");
    const office = await upload("skip.docx", "x");
    const noThumb = await upload("nothumb.mp4", "x");

    await alice.file.saveExtracted({ fileId: noThumb, metadata: {}, thumbnail: false });

    const textDone = await upload("done.md", "x");

    await alice.file.saveExtracted({ fileId: textDone, metadata: { lines: 1 }, thumbnail: false });

    const done = await upload("done.png", "x");

    await putThumbnail(done);
    await alice.file.saveExtracted({ fileId: done, metadata: {}, thumbnail: true });

    const { fileIds } = await alice.storage.backfillCandidates({ storageId });

    expect(fileIds).toEqual(expect.arrayContaining([todo, text, noThumb]));

    for (const id of [office, textDone, done]) expect(fileIds).not.toContain(id);
  });

  test("permanent delete removes the thumbnail too", async () => {
    const fileId = await upload("purged.png", "x");

    await putThumbnail(fileId);
    await alice.file.saveExtracted({ fileId, metadata: {}, thumbnail: true });

    const { thumbnailKey } = await row(fileId);

    await alice.file.trash({ fileId });
    await alice.file.purge({ fileId });
    await runJobs();
    expect(await headObject(s3, "fileee", thumbnailKey!)).toBeNull();
  });

  test("another user can't reach previews, thumbnails or extracted data", async () => {
    const fileId = await upload("private.png", "x");
    const denied = { code: "NOT_FOUND" };

    await expect(bob.file.get({ fileId })).rejects.toMatchObject(denied);
    await expect(bob.file.previewUrl({ fileId })).rejects.toMatchObject(denied);
    await expect(bob.file.signThumbnail({ fileId })).rejects.toMatchObject(denied);

    await expect(
      bob.file.saveExtracted({ fileId, metadata: {}, thumbnail: false }),
    ).rejects.toMatchObject(denied);

    await expect(bob.storage.backfillCandidates({ storageId })).rejects.toMatchObject(denied);
    await expect(bob.file.list({ storageId, folderId: rootId })).rejects.toMatchObject(denied);
  });
});
