// Runs against MinIO: docker compose -f docker-compose.dev.yml up -d, then S3_TEST_ENDPOINT=http://localhost:9000 pnpm test
import {
  CreateBucketCommand,
  DeleteBucketCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { db, files, jobs, publicFiles, storages } from "@fileee/db";
import { copyInParts, createClient, publicLocationProblem, withPrefix } from "@fileee/storage";
import { and, eq, isNull } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { runJobs } from "../../lib/jobs.ts";
import { publicHeadersOf } from "../../lib/mime.ts";
import { retireStuckCopies } from "../../lib/cleanup.ts";
import { startFakeCdn } from "../../test-cdn.ts";
import { ADMIN, setupTestApp } from "../../test-utils.ts";

test("only what a browser won't execute stays inline", () => {
  for (const name of ["a.png", "a.PDF", "a.mp4", "a.mp3"]) {
    expect(publicHeadersOf(name).inline).toBe(true);
  }

  for (const name of ["a.html", "a.HTM", "a.svg", "a.xhtml", "a.js", "a.xml", "a.wasm", "a"]) {
    expect(publicHeadersOf(name).inline).toBe(false);
  }

  expect(publicHeadersOf("a.html").contentType).toBe("text/plain");
  expect(publicHeadersOf("a.xhtml").contentType).toBe("application/octet-stream");
});

test("a public location can't overlap private files", () => {
  const storage = { bucket: "b", prefix: "files" };

  const problem = (prefix: string, bucket = "b") =>
    publicLocationProblem(storage, { bucket, prefix });

  expect(problem("")).toMatch(/whole bucket/);
  expect(problem("files")).toMatch(/prefix/);
  expect(problem("files/")).toMatch(/prefix/);
  expect(problem("files/.fileee/thumbs/x")).toMatch(/reserved/);
  expect(problem("files/.fileee")).toMatch(/reserved/);
  expect(problem("files/.fileee/public")).toBeNull();
  expect(problem("files2")).toBeNull();
  expect(problem("", "other")).toBeNull();

  const nested = { bucket: "b", prefix: "a/b" };

  expect(publicLocationProblem(nested, { bucket: "b", prefix: "a" })).toMatch(/above/);

  const whole = { bucket: "b", prefix: "" };

  expect(publicLocationProblem(whole, { bucket: "b", prefix: "" })).toMatch(/whole bucket/);
  expect(publicLocationProblem(whole, { bucket: "b", prefix: "public" })).toBeNull();
});

const endpoint = process.env.S3_TEST_ENDPOINT;
const { browser } = await setupTestApp();
const alice = browser();
const bob = browser();

describe.skipIf(!endpoint)("public links against MinIO", () => {
  const unique = crypto.randomUUID();
  const prefix = `public-${unique}`;
  const secondBucket = `pub-${unique}`.slice(0, 40);
  const defaultLocation = `${prefix}/.fileee/public`;
  const credentials = { accessKeyId: "minioadmin", secretAccessKey: "minioadmin" };

  const s3 = createClient({
    endpoint: endpoint ?? null,
    region: "us-east-1",
    bucket: "fileee",
    prefix: "",
    forcePathStyle: true,
    ...credentials,
  });

  let cdn: Awaited<ReturnType<typeof startFakeCdn>>;
  let storageId: string;
  let rootId: string;

  const connection = {
    provider: "minio" as const,
    endpoint: endpoint!,
    region: "us-east-1",
    bucket: "fileee",
    forcePathStyle: true,
  };

  /** A CDN scoped to one location: the safe setup. */
  const scopeTo = (location: string, Bucket?: string) => {
    cdn.resolve = (path) => ({ Bucket, Key: withPrefix(location, path) });
  };

  /** A CDN pointed at the whole bucket, with the base URL's path hiding that: the dangerous setup. */
  const exposeBucket = () => {
    cdn.resolve = (path) => ({ Key: path });
  };

  const access = (id = storageId) =>
    alice.storage.setPublicAccess({
      storageId: id,
      cdnBaseUrl: cdn.url,
      publicBucket: "",
      publicPrefix: "",
    });

  const newStorage = async (name: string) =>
    (
      await alice.storage.create({
        name,
        ...connection,
        prefix: `${prefix}-${name}`,
        ...credentials,
      })
    ).id;

  const upload = async (
    name: string,
    body = "bytes",
    mimeType = "",
    folderId = rootId,
    id = storageId,
  ) => {
    const started = await alice.upload.start({
      storageId: id,
      folderId,
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

  const rowsOf = (fileId: string) =>
    db.select().from(publicFiles).where(eq(publicFiles.fileId, fileId));

  const liveObject = async (url: string) => (await fetch(url)).status === 200;

  const sync = async () => {
    await alice.storage.sync({ storageId });
    await runJobs();

    for (let i = 0; i < 50; i++) {
      const { run } = await alice.storage.syncStatus({ storageId });

      if (run?.status === "complete" || run?.status === "failed") return run;

      await new Promise((resolve) => setTimeout(resolve, 100));
      await runJobs();
    }

    throw new Error("sync didn't finish");
  };

  const breakCredentials = (id: string) =>
    alice.storage.update({
      storageId: id,
      name: "broken",
      ...connection,
      prefix: id === storageId ? prefix : `${prefix}-removed`,
      accessKeyId: "minioadmin",
      secretAccessKey: "wrong-secret",
    });

  const fixCredentials = () =>
    alice.storage.update({
      storageId,
      name: "MinIO",
      ...connection,
      prefix,
      ...credentials,
    });

  const makeJobsDue = () => db.update(jobs).set({ runAt: new Date(0) });

  beforeAll(async () => {
    await alice.setup.complete(ADMIN);

    await alice.user.create({
      name: "Bob",
      email: "bob@example.com",
      password: "a long enough password",
      role: "user",
    });

    await bob.auth.login({ email: "bob@example.com", password: "a long enough password" });
    cdn = await startFakeCdn(s3, "fileee");

    storageId = (
      await alice.storage.create({ name: "MinIO", ...connection, prefix, ...credentials })
    ).id;

    await runJobs();
    rootId = (await alice.folder.get({ storageId })).folder.id;
    scopeTo(defaultLocation);
    await access();
  });

  afterAll(() => {
    cdn.server?.close();
  });

  test("the default location is under the prefix, and the setting is reported", async () => {
    const [storage] = (await alice.storage.list()).filter((s) => s.id === storageId);

    expect(storage).toMatchObject({
      cdnBaseUrl: cdn.url,
      publicBucket: null,
      publicPrefix: defaultLocation,
      publicCheckError: null,
    });

    expect(storage!.publicCheckedAt).toBeInstanceOf(Date);
  });

  test("a publish gives a CDN URL with a new copy, and downloads nothing through the app", async () => {
    const name = "report (1).pdf";
    const fileId = await upload(name, "pdf bytes", "text/html");
    const { url } = await alice.share.publish({ fileId });

    expect(url.startsWith(`${cdn.url}/`)).toBe(true);

    const res = await fetch(url);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("pdf bytes");
    // The browser's claimed type is ignored.
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toBeNull();
    expect(res.headers.get("cache-control")).toContain("max-age=3600");

    const [row] = await rowsOf(fileId);

    expect(row!.publicKey.startsWith(`${defaultLocation}/`)).toBe(true);

    const status = await alice.share.publicStatus({ fileId });

    expect(status).toMatchObject({ available: true, blockedBy: null });
    expect(status.copy).toMatchObject({ url, outOfDate: false });
  });

  test("HTML and SVG copies download, whatever type the browser claimed", async () => {
    for (const [name, claimed] of [
      ["page.html", "text/html"],
      ["icon.svg", "image/svg+xml"],
      ["fake.xhtml", "image/png"],
    ] as const) {
      const fileId = await upload(name, "<script>alert(1)</script>", claimed);
      const { url } = await alice.share.publish({ fileId });
      const res = await fetch(url);

      expect(res.headers.get("content-disposition")).toMatch(/^attachment/);
      expect(res.headers.get("content-type")).not.toBe("text/html");
    }
  });

  test("the safety check refuses a CDN that serves the private probe", async () => {
    const id = await newStorage("exposed");
    const location = `${prefix}-exposed/.fileee/public`;

    exposeBucket();

    // The base URL's path makes the public probe load, as a whole-bucket custom domain would.
    await expect(
      alice.storage.setPublicAccess({
        storageId: id,
        cdnBaseUrl: `${cdn.url}/${location}`,
        publicBucket: "",
        publicPrefix: "",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("private") });

    const [row] = await db.select().from(storages).where(eq(storages.id, id));

    expect(row!.cdnBaseUrl).toBeNull();
    scopeTo(defaultLocation);
  });

  test("the check also finds a CDN that only hides dot folders", async () => {
    const id = await newStorage("dots");
    const location = `${prefix}-dots/public`;

    cdn.resolve = (path) => (path.split("/").some((p) => p.startsWith(".")) ? null : { Key: path });

    await expect(
      alice.storage.setPublicAccess({
        storageId: id,
        cdnBaseUrl: `${cdn.url}/${location}`,
        publicBucket: "",
        publicPrefix: location,
      }),
    ).rejects.toMatchObject({ message: expect.stringContaining("private") });

    scopeTo(defaultLocation);
  });

  test("a CDN that doesn't serve the public probe is refused", async () => {
    const id = await newStorage("dead");

    cdn.resolve = () => null;

    await expect(access(id)).rejects.toMatchObject({
      message: expect.stringContaining("public location"),
    });

    scopeTo(defaultLocation);
  });

  test("a redirect isn't followed, and doesn't count as safe", async () => {
    const id = await newStorage("redirect");
    const { createServer } = await import("node:http");

    const server = createServer((_, res) => {
      res.writeHead(302, { Location: "http://127.0.0.1:1/internal" }).end();
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

    const { port } = server.address() as { port: number };

    await expect(
      alice.storage.setPublicAccess({
        storageId: id,
        cdnBaseUrl: `http://127.0.0.1:${port}`,
        publicBucket: "",
        publicPrefix: "",
      }),
    ).rejects.toMatchObject({ message: expect.stringContaining("HTTP 302") });

    server.close();

    // Public probes load, and private ones redirect: that isn't an answer, so it's refused too.
    const partly = createServer(async (req, res) => {
      if (!req.url!.startsWith("/probe-")) {
        res.writeHead(302, { Location: "http://127.0.0.1:1/internal" }).end();

        return;
      }

      const upstream = await fetch(`${cdn.url}${req.url}`);

      res.writeHead(upstream.status, Object.fromEntries(upstream.headers));
      res.end(await upstream.text());
    });

    await new Promise<void>((resolve) => partly.listen(0, "127.0.0.1", resolve));
    scopeTo(`${prefix}-redirect/.fileee/public`);

    await expect(
      alice.storage.setPublicAccess({
        storageId: id,
        cdnBaseUrl: `http://127.0.0.1:${(partly.address() as { port: number }).port}`,
        publicBucket: "",
        publicPrefix: "",
      }),
    ).rejects.toMatchObject({ message: expect.stringContaining("redirect") });

    partly.close();
    scopeTo(defaultLocation);
  });

  test("the CDN URL gets endpoint validation and can't share the app's host", async () => {
    const id = await newStorage("validated");

    const refused = (cdnBaseUrl: string) =>
      expect(
        alice.storage.setPublicAccess({
          storageId: id,
          cdnBaseUrl,
          publicBucket: "",
          publicPrefix: "",
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await refused("not a url");
    await refused("ftp://cdn.example.com");
    await refused("http://user:pass@cdn.example.com");
    await refused("http://localhost:3000");
    await refused("http://localhost:9999");
    await refused("http://cdn.example.com/?x=1");
  });

  test("private addresses are refused without ALLOW_PRIVATE_ENDPOINTS", async () => {
    const id = await newStorage("ssrf");

    process.env.ALLOW_PRIVATE_ENDPOINTS = "false";

    try {
      await expect(
        alice.storage.setPublicAccess({
          storageId: id,
          cdnBaseUrl: "https://169.254.169.254",
          publicBucket: "",
          publicPrefix: "",
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    } finally {
      process.env.ALLOW_PRIVATE_ENDPOINTS = "true";
    }
  });

  test("a location overlapping private files, or holding anything, is refused", async () => {
    const id = await newStorage("overlap");

    const set = (publicPrefix: string) =>
      alice.storage.setPublicAccess({
        storageId: id,
        cdnBaseUrl: cdn.url,
        publicBucket: "",
        publicPrefix,
      });

    await expect(set(`${prefix}-overlap`)).rejects.toMatchObject({
      message: expect.stringContaining("private"),
    });

    await expect(set(`${prefix}-overlap/../x`)).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await s3.send(
      new PutObjectCommand({ Bucket: "fileee", Key: `${prefix}-taken/holiday.jpg`, Body: "x" }),
    );

    await expect(set(`${prefix}-taken`)).rejects.toMatchObject({
      message: expect.stringContaining("empty"),
    });
  });

  test("a repeat failure blocks publishing and warns, until it passes again", async () => {
    const fileId = await upload("blocked.txt");

    cdn.resolve = () => null;

    const failed = await sync();

    expect(failed.status).toBe("complete");

    await expect(alice.share.publish({ fileId })).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("safety check"),
    });

    expect((await alice.share.publicStatus({ fileId })).blockedBy).toBeTruthy();

    expect(
      (await alice.storage.list()).find((s) => s.id === storageId)!.publicCheckError,
    ).toBeTruthy();

    scopeTo(defaultLocation);
    await sync();
    expect((await alice.share.publicStatus({ fileId })).blockedBy).toBeNull();

    const { url } = await alice.share.publish({ fileId });

    expect(await liveObject(url)).toBe(true);
  });

  test("a later exposure found by a sync also blocks", async () => {
    const fileId = await upload("exposed-later.txt");

    // Serves the public location as before, and also anything by its full key.
    cdn.resolve = (path) =>
      path.startsWith(prefix) ? { Key: path } : { Key: withPrefix(defaultLocation, path) };

    await sync();

    const { blockedBy } = await alice.share.publicStatus({ fileId });

    expect(blockedBy).toContain("every private file may be exposed");
    scopeTo(defaultLocation);
    await sync();
  });

  test("unpublish deletes the copy, and publishing again gets a new token", async () => {
    const fileId = await upload("again.txt");
    const first = await alice.share.publish({ fileId });

    await alice.share.unpublish({ fileId });
    await runJobs();
    expect(await liveObject(first.url)).toBe(false);
    expect(await rowsOf(fileId)).toEqual([]);
    expect((await alice.share.publicStatus({ fileId })).copy).toBeNull();

    const second = await alice.share.publish({ fileId });

    expect(second.url).not.toBe(first.url);
    expect(await liveObject(first.url)).toBe(false);
    expect(await liveObject(second.url)).toBe(true);

    const third = await alice.share.publish({ fileId });

    await runJobs();
    expect(await liveObject(second.url)).toBe(false);
    expect(await liveObject(third.url)).toBe(true);
    expect(await rowsOf(fileId)).toHaveLength(1);
  });

  test("trash deletes the copy, and restoring doesn't republish", async () => {
    const fileId = await upload("trashed.txt");
    const { url } = await alice.share.publish({ fileId });

    await alice.file.trash({ fileId });
    await runJobs();
    expect(await liveObject(url)).toBe(false);
    await alice.file.restore({ fileId });
    expect((await alice.share.publicStatus({ fileId })).copy).toBeNull();
    expect(await liveObject(url)).toBe(false);

    await expect(
      (async () => {
        await alice.file.trash({ fileId });
        await alice.share.publish({ fileId });
      })(),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("trashing a folder deletes the copies throughout its subtree", async () => {
    const parent = await alice.folder.create({ storageId, parentId: rootId, name: "pub-parent" });
    const child = await alice.folder.create({ storageId, parentId: parent.id, name: "pub-child" });
    const a = await upload("a.txt", "a", "", parent.id);
    const b = await upload("b.txt", "b", "", child.id);

    const urls = [
      await alice.share.publish({ fileId: a }),
      await alice.share.publish({ fileId: b }),
    ];

    await alice.folder.trash({ folderId: parent.id });
    await runJobs();

    for (const { url } of urls) expect(await liveObject(url)).toBe(false);

    expect(await rowsOf(a)).toEqual([]);
    expect(await rowsOf(b)).toEqual([]);
  });

  test("permanent delete leaves no copy and no row", async () => {
    const fileId = await upload("purged.txt");
    const { url } = await alice.share.publish({ fileId });

    await alice.file.trash({ fileId });
    await alice.file.purge({ fileId });
    await runJobs();
    expect(await liveObject(url)).toBe(false);

    const left = await db.select().from(publicFiles).where(eq(publicFiles.url, url));

    expect(left).toEqual([]);
  });

  test("a failed deletion is kept, shown to the owner and retried", async () => {
    const fileId = await upload("retry.txt");
    const { url } = await alice.share.publish({ fileId });

    await breakCredentials(storageId);
    await alice.file.trash({ fileId });
    await runJobs();
    expect(await liveObject(url)).toBe(true);

    const [row] = await db.select().from(publicFiles).where(eq(publicFiles.url, url));

    expect(row!.deleteError).toBeTruthy();

    const failures = await alice.share.removalFailures();

    expect(failures.map((f) => f.url)).toContain(url);
    expect(await bob.share.removalFailures()).toEqual([]);
    expect(JSON.stringify(failures)).not.toContain("encrypted");

    await fixCredentials();
    await makeJobsDue();
    await runJobs();
    expect(await liveObject(url)).toBe(false);
    expect(await db.select().from(publicFiles).where(eq(publicFiles.url, url))).toEqual([]);
    expect(await alice.share.removalFailures()).toEqual([]);
  });

  test("removing a storage still deletes copies, even after a failure", async () => {
    const id = await newStorage("removed");

    await runJobs();
    scopeTo(`${prefix}-removed/.fileee/public`);
    await access(id);

    const root = (await alice.folder.get({ storageId: id })).folder.id;
    const fileId = await upload("gone.txt", "gone", "", root, id);
    const { url } = await alice.share.publish({ fileId });

    expect(await liveObject(url)).toBe(true);

    await alice.storage.remove({ storageId: id });
    await runJobs();
    expect(await liveObject(url)).toBe(false);
    expect(await db.select().from(publicFiles).where(eq(publicFiles.url, url))).toEqual([]);

    // The same, with the job failing first and the storage's row already gone.
    const again = await newStorage("removed-bad");

    await runJobs();
    scopeTo(`${prefix}-removed-bad/.fileee/public`);
    await access(again);

    const rootAgain = (await alice.folder.get({ storageId: again })).folder.id;
    const other = await upload("gone2.txt", "gone", "", rootAgain, again);
    const second = await alice.share.publish({ fileId: other });
    const [storage] = await db.select().from(storages).where(eq(storages.id, again));

    await alice.storage.update({
      storageId: again,
      name: "bad",
      ...connection,
      prefix: `${prefix}-removed-bad`,
      accessKeyId: "minioadmin",
      secretAccessKey: "wrong-secret",
    });

    await alice.storage.remove({ storageId: again });
    await runJobs();
    expect(await liveObject(second.url)).toBe(true);

    const [row] = await db.select().from(publicFiles).where(eq(publicFiles.url, second.url));

    expect(row!.deleteError).toBeTruthy();
    expect((await alice.share.removalFailures()).map((f) => f.url)).toContain(second.url);

    // Operator fixes it: restore the good secret on the record, as a corrected key would be.
    await db
      .update(publicFiles)
      .set({
        retiredConnection: {
          ...row!.retiredConnection!,
          encryptedCredentials: storage!.encryptedCredentials,
          keyVersion: storage!.keyVersion,
        },
      })
      .where(eq(publicFiles.id, row!.id));

    await makeJobsDue();
    await runJobs();
    expect(await liveObject(second.url)).toBe(false);
    scopeTo(defaultLocation);
  });

  test("deleting a user deletes their copies, and admins see failures", async () => {
    await alice.user.create({
      name: "Carol",
      email: "carol@example.com",
      password: "a long enough password",
      role: "user",
    });

    const carol = browser();

    await carol.auth.login({ email: "carol@example.com", password: "a long enough password" });

    const { id } = await carol.storage.create({
      name: "Carol's",
      ...connection,
      prefix: `${prefix}-carol`,
      ...credentials,
    });

    await runJobs();
    scopeTo(`${prefix}-carol/.fileee/public`);

    await carol.storage.setPublicAccess({
      storageId: id,
      cdnBaseUrl: cdn.url,
      publicBucket: "",
      publicPrefix: "",
    });

    const root = (await carol.folder.get({ storageId: id })).folder.id;

    const started = await carol.upload.start({
      storageId: id,
      folderId: root,
      name: "carol.txt",
      size: 5,
      mimeType: "",
    });

    if (started.kind !== "single") throw new Error("expected single");

    await fetch(started.url, { method: "PUT", body: "carol" });
    await carol.upload.complete({ fileId: started.fileId });

    const { url } = await carol.share.publish({ fileId: started.fileId });

    const [user] = (await alice.user.list()).filter((u) => u.email === "carol@example.com");

    await alice.user.remove({ userId: user!.id });
    await runJobs();
    expect(await liveObject(url)).toBe(false);
    expect(await db.select().from(publicFiles).where(eq(publicFiles.url, url))).toEqual([]);
    scopeTo(defaultLocation);
  });

  test("another user can't publish, unpublish or inspect your file", async () => {
    const fileId = await upload("private.txt");
    const { url } = await alice.share.publish({ fileId });
    const notFound = { code: "NOT_FOUND" };

    await expect(bob.share.publish({ fileId })).rejects.toMatchObject(notFound);
    await expect(bob.share.unpublish({ fileId })).rejects.toMatchObject(notFound);
    await expect(bob.share.publicStatus({ fileId })).rejects.toMatchObject(notFound);

    await expect(
      bob.storage.setPublicAccess({
        storageId,
        cdnBaseUrl: "",
        publicBucket: "",
        publicPrefix: "",
      }),
    ).rejects.toMatchObject(notFound);

    await expect(bob.storage.publicSummary({ storageId })).rejects.toMatchObject(notFound);
    expect(await liveObject(url)).toBe(true);
  });

  test("a changed original shows the copy as out of date until republished", async () => {
    const fileId = await upload("changes.txt", "old");
    const { url } = await alice.share.publish({ fileId });
    const [file] = await db.select().from(files).where(eq(files.id, fileId));

    await s3.send(
      new PutObjectCommand({ Bucket: "fileee", Key: file!.objectKey, Body: "new bytes" }),
    );

    expect((await alice.share.publicStatus({ fileId })).copy!.outOfDate).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 1100)); // a change newer than the run isn't judged yet
    await sync();
    expect((await alice.share.publicStatus({ fileId })).copy!.outOfDate).toBe(true);

    expect((await alice.storage.publicSummary({ storageId })).outOfDate).toContainEqual({
      fileId,
      name: "changes.txt",
    });

    expect(await (await fetch(url)).text()).toBe("old");

    const republished = await alice.share.publish({ fileId });

    expect((await alice.share.publicStatus({ fileId })).copy!.outOfDate).toBe(false);
    expect(await (await fetch(republished.url)).text()).toBe("new bytes");
  });

  test("sync skips the public location", async () => {
    const before = await sync();

    expect(before.status).toBe("complete");

    const imported = await db
      .select({ key: files.objectKey })
      .from(files)
      .where(eq(files.storageId, storageId));

    expect(imported.filter((f) => f.key.includes(".fileee/public"))).toEqual([]);

    // A custom prefix under the private one, in a storage of its own.
    const id = await newStorage("custom");

    await runJobs();

    const custom = `${prefix}-custom/published`;

    scopeTo(custom);

    await alice.storage.setPublicAccess({
      storageId: id,
      cdnBaseUrl: cdn.url,
      publicBucket: "",
      publicPrefix: custom,
    });

    const root = (await alice.folder.get({ storageId: id })).folder.id;
    const fileId = await upload("custom.txt", "c", "", root, id);

    await alice.share.publish({ fileId });
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await alice.storage.sync({ storageId: id });
    await runJobs();

    for (let i = 0; i < 50; i++) {
      const { run } = await alice.storage.syncStatus({ storageId: id });

      if (run?.status === "complete") break;

      await new Promise((resolve) => setTimeout(resolve, 100));
      await runJobs();
    }

    const rows = await db
      .select({ key: files.objectKey })
      .from(files)
      .where(and(eq(files.storageId, id), isNull(files.trashedAt)));

    expect(rows.map((r) => r.key).filter((k) => k.includes("/published/"))).toEqual([]);
    scopeTo(defaultLocation);
  });

  test("a separate public bucket works, with its own prefix optional", async () => {
    await s3.send(new CreateBucketCommand({ Bucket: secondBucket }));

    const id = await newStorage("separate");

    await runJobs();
    scopeTo("", secondBucket);

    await alice.storage.setPublicAccess({
      storageId: id,
      cdnBaseUrl: cdn.url,
      publicBucket: secondBucket,
      publicPrefix: "",
    });

    const root = (await alice.folder.get({ storageId: id })).folder.id;
    const fileId = await upload("separate.png", "p", "", root, id);
    const { url } = await alice.share.publish({ fileId });
    const res = await fetch(url);

    expect(await res.text()).toBe("p");
    expect(res.headers.get("content-type")).toBe("image/png");

    const [row] = await rowsOf(fileId);

    expect(row!.bucket).toBe(secondBucket);

    await alice.file.trash({ fileId });
    await runJobs();
    expect(await liveObject(url)).toBe(false);
    await s3.send(new DeleteBucketCommand({ Bucket: secondBucket }));
    scopeTo(defaultLocation);
  });

  test("turning public access off removes copies; while on, the storage can't move", async () => {
    const id = await newStorage("off");

    await runJobs();
    scopeTo(`${prefix}-off/.fileee/public`);
    await access(id);

    const root = (await alice.folder.get({ storageId: id })).folder.id;
    const fileId = await upload("off.txt", "x", "", root, id);
    const { url } = await alice.share.publish({ fileId });

    await expect(
      alice.storage.update({
        storageId: id,
        name: "off",
        ...connection,
        prefix: "elsewhere",
        accessKeyId: "",
        secretAccessKey: "",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    await expect(
      alice.storage.setPublicAccess({
        storageId: id,
        cdnBaseUrl: cdn.url,
        publicBucket: "",
        publicPrefix: `${prefix}-off/elsewhere`,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    await alice.storage.setPublicAccess({
      storageId: id,
      cdnBaseUrl: "",
      publicBucket: "",
      publicPrefix: "",
    });

    await runJobs();
    expect(await liveObject(url)).toBe(false);
    expect((await alice.share.publicStatus({ fileId })).available).toBe(false);
    await expect(alice.share.publish({ fileId })).rejects.toMatchObject({ code: "CONFLICT" });
    scopeTo(defaultLocation);
  });

  test("a publish cut off by a restart is cleaned up", async () => {
    const fileId = await upload("stuck.txt");
    const key = `${defaultLocation}/stuck-token/stuck.txt`;

    await s3.send(new PutObjectCommand({ Bucket: "fileee", Key: key, Body: "s" }));

    const [{ id } = { id: "" }] = await db
      .insert(publicFiles)
      .values({
        userId: "whoever",
        storageId,
        fileId,
        bucket: "fileee",
        publicKey: key,
        url: "http://cdn/stuck",
        createdAt: new Date(Date.now() - 2 * 86_400_000),
      })
      .returning({ id: publicFiles.id });

    await retireStuckCopies();
    await runJobs();
    expect(await db.select().from(publicFiles).where(eq(publicFiles.id, id))).toEqual([]);

    await expect(
      s3.send(new HeadObjectCommand({ Bucket: "fileee", Key: key })),
    ).rejects.toMatchObject({ $metadata: { httpStatusCode: 404 } });
  });

  test("large files can be copied part by part with the new headers", async () => {
    const source = `${prefix}-parts/source.bin`;
    const target = `${prefix}-parts/target.html`;
    const size = 6 * 1024 * 1024;

    await s3.send(
      new PutObjectCommand({ Bucket: "fileee", Key: source, Body: Buffer.alloc(size, 7) }),
    );

    await copyInParts(
      s3,
      { Bucket: "fileee", Key: source },
      {
        Bucket: "fileee",
        Key: target,
        ContentType: "text/plain",
        ContentDisposition: "attachment",
        CacheControl: "public, max-age=3600",
      },
      size,
      5 * 1024 * 1024,
    );

    const copied = await s3.send(new GetObjectCommand({ Bucket: "fileee", Key: target }));

    expect(copied.ContentDisposition).toBe("attachment");
    expect(copied.ContentType).toBe("text/plain");
    expect((await copied.Body!.transformToByteArray()).length).toBe(size);
  });
});
