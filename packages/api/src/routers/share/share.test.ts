// Runs against MinIO: docker compose -f docker-compose.dev.yml up -d, then S3_TEST_ENDPOINT=http://localhost:9000 pnpm test
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { db, files, shareLinks, users } from "@fileee/db";
import { createClient } from "@fileee/storage";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";
import { hashToken } from "../../auth/session.ts";
import { runJobs } from "../../lib/jobs.ts";
import { ADMIN, setupTestApp } from "../../test-utils.ts";

const endpoint = process.env.S3_TEST_ENDPOINT;
const { browser } = await setupTestApp();
const alice = browser();
const bob = browser();
const visitor = browser();

const NOT_AVAILABLE = { code: "NOT_FOUND", message: "This link isn't available." };
const tokenOf = (url: string) => url.split("/share/")[1]!;

const countOf = async (linkId: string) =>
  (await db.select().from(shareLinks).where(eq(shareLinks.id, linkId)))[0]!.downloadCount;

const uniqueName = (ext = "txt") => `${crypto.randomUUID()}.${ext}`;

const shareFile = async (fileId: string, options = {}) => {
  const link = await alice.share.create({ fileId, expiry: "never", password: "", ...options });

  return { ...link, token: tokenOf(link.url) };
};

const shareFolder = async (folderId: string, options = {}) => {
  const link = await alice.share.create({ folderId, expiry: "never", password: "", ...options });

  return { ...link, token: tokenOf(link.url) };
};

describe.skipIf(!endpoint)("share links against MinIO", () => {
  const prefix = `share-${crypto.randomUUID()}`;

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

  const upload = async (name: string, body = "bytes", folderId = rootId, mimeType = "") => {
    const started = await alice.upload.start({
      storageId,
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

  const newFolder = (name: string, parentId = rootId) =>
    alice.folder.create({ storageId, parentId, name });

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

  test("the token is stored hashed and encrypted, and only the list's url reveals it", async () => {
    const fileId = await upload(uniqueName());
    const { id, token, url } = await shareFile(fileId);

    expect(url).toBe(`${process.env.APP_URL}/share/${token}`);

    const [row] = await db.select().from(shareLinks).where(eq(shareLinks.id, id));

    expect(row!.tokenHash).toBe(hashToken(token));
    expect(JSON.stringify(row)).not.toContain(token);

    const [listed] = await alice.share.list({ fileId });

    expect(listed).toMatchObject({ id, url, hasPassword: false, downloadCount: 0 });
    expect(JSON.stringify(listed)).not.toContain(row!.tokenHash);
    expect(JSON.stringify(listed)).not.toContain(row!.encryptedToken);
  });

  test("resolve works signed out and shows nothing about the storage", async () => {
    const name = uniqueName();
    const fileId = await upload(name);
    const { token } = await shareFile(fileId);
    const resolved = await visitor.share.resolve({ token });

    expect(resolved).toEqual({
      needsPassword: false,
      kind: "file",
      file: { id: fileId, name, size: 5, mimeType: null, preview: "text" },
    });

    const text = JSON.stringify(resolved);

    expect(text).not.toContain(prefix);
    expect(text).not.toContain("objectKey");
    expect(text).not.toContain("bucket");
  });

  test("download moves the count only when a URL is issued", async () => {
    const fileId = await upload(uniqueName(), "hello");
    const { id, token } = await shareFile(fileId);

    await visitor.share.resolve({ token });
    expect(await countOf(id)).toBe(0);

    await expect(visitor.share.download({ token, fileId: "other" })).rejects.toMatchObject(
      NOT_AVAILABLE,
    );

    expect(await countOf(id)).toBe(0);

    const { url } = await visitor.share.download({ token, fileId });

    expect(await countOf(id)).toBe(1);

    const res = await fetch(url);

    expect(await res.text()).toBe("hello");
    expect(new URL(url).host).toBe(new URL(endpoint!).host);
    expect(new URL(url).searchParams.get("X-Amz-Expires")).toBe("900");
  });

  test("preview signs a view URL the link reaches, and isn't counted as a download", async () => {
    const fileId = await upload(uniqueName(), "hello");
    const { id, token } = await shareFile(fileId);

    await expect(visitor.share.preview({ token, fileId: "other" })).rejects.toMatchObject(
      NOT_AVAILABLE,
    );

    const { kind, url } = await visitor.share.preview({ token, fileId });

    expect(kind).toBe("text");

    const res = await fetch(url!);

    expect(res.headers.get("content-type")).toBe("text/plain");
    expect(await res.text()).toBe("hello");
    expect(await countOf(id)).toBe(0);

    const zipId = await upload(uniqueName("zip"));
    const zip = await shareFile(zipId);

    expect(await visitor.share.preview({ token: zip.token, fileId: zipId })).toEqual({
      kind: "none",
      url: null,
    });
  });

  test("preview needs the password", async () => {
    const fileId = await upload(uniqueName());
    const { token } = await shareFile(fileId, { password: "open sesame" });

    await expect(visitor.share.preview({ token, fileId })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    await expect(
      visitor.share.preview({ token, fileId, password: "open sesame" }),
    ).resolves.toMatchObject({ kind: "text" });
  });

  test.each([
    ["evil.html", "<script>alert(1)</script>", "text/html"],
    ["evil.svg", "<svg onload='alert(1)'/>", "image/svg+xml"],
    ["evil.png", "<script>alert(1)</script>", "text/html"],
  ])("%s downloads rather than renders", async (name, body, mimeType) => {
    const folder = await newFolder(crypto.randomUUID());
    const fileId = await upload(name, body, folder.id, mimeType);
    const { token } = await shareFile(fileId);
    const { url } = await visitor.share.download({ token, fileId });
    const res = await fetch(url);

    expect(res.headers.get("content-disposition")).toMatch(/^attachment/);
    expect(await res.text()).toBe(body);
  });

  test("a revoked link stops for new visits, while an issued URL keeps working", async () => {
    const fileId = await upload(uniqueName(), "still here");
    const { id, token } = await shareFile(fileId);
    const { url } = await visitor.share.download({ token, fileId });

    await alice.share.revoke({ linkId: id });

    await expect(visitor.share.resolve({ token })).rejects.toMatchObject(NOT_AVAILABLE);
    await expect(visitor.share.download({ token, fileId })).rejects.toMatchObject(NOT_AVAILABLE);
    expect(await (await fetch(url)).text()).toBe("still here");

    const [listed] = await alice.share.list({ fileId });

    expect(listed!.revokedAt).toBeInstanceOf(Date);
    expect(listed!.url).toBeNull();
  });

  test("an expired link answers just like an unknown one", async () => {
    const fileId = await upload(uniqueName());
    const { id, token } = await shareFile(fileId, { expiry: "1h" });

    await expect(visitor.share.resolve({ token })).resolves.toMatchObject({ kind: "file" });

    await db
      .update(shareLinks)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(shareLinks.id, id));

    const errors = await Promise.all(
      [token, "unknown"].map((t) =>
        visitor.share.resolve({ token: t }).catch((e: { code: string; message: string }) => ({
          code: e.code,
          message: e.message,
        })),
      ),
    );

    expect(errors).toEqual([NOT_AVAILABLE, NOT_AVAILABLE]);
  });

  test("a password protects the name and the URL, and uses FORBIDDEN so the page doesn't go to /login", async () => {
    const name = uniqueName();
    const fileId = await upload(name);
    const { token } = await shareFile(fileId, { password: "open sesame" });

    const locked = await visitor.share.resolve({ token });

    expect(locked).toEqual({ needsPassword: true });

    await expect(visitor.share.resolve({ token, password: "nope nope" })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Wrong password.",
    });

    await expect(visitor.share.download({ token, fileId })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    await expect(
      visitor.share.download({ token, fileId, password: "nope nope" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(visitor.share.resolve({ token, password: "open sesame" })).resolves.toMatchObject({
      file: { name },
    });

    const { url } = await visitor.share.download({ token, fileId, password: "open sesame" });

    expect(url).toContain("X-Amz-Signature");
  });

  test("a dead link says so before asking for a password", async () => {
    const fileId = await upload(uniqueName());
    const { id, token } = await shareFile(fileId, { password: "open sesame" });

    await alice.share.revoke({ linkId: id });
    await expect(visitor.share.resolve({ token })).rejects.toMatchObject(NOT_AVAILABLE);
  });

  test("the password limit holds across addresses and token case, and blocks the right password too", async () => {
    const fileId = await upload(uniqueName());
    const { id, token } = await shareFile(fileId, { password: "open sesame" });

    for (let i = 0; i < 10; i++) {
      // A new client IP each time, as X-Forwarded-For spoofing would give with TRUST_PROXY on.
      await expect(
        browser(`10.0.0.${i}`).share.resolve({ token, password: "wrong guess" }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    }

    await expect(
      browser("10.0.1.1").share.resolve({ token, password: "wrong guess" }),
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });

    await expect(visitor.share.resolve({ token, password: "open sesame" })).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });

    await expect(
      visitor.share.download({ token, fileId, password: "open sesame" }),
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });

    expect(await countOf(id)).toBe(0);

    // Another case is another token: it finds no link at all, so it can't reach a fresh counter.
    const swapped = [...token]
      .map((c) => (c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase()))
      .join("");

    await expect(
      visitor.share.resolve({ token: swapped, password: "open sesame" }),
    ).rejects.toMatchObject(NOT_AVAILABLE);

    // No password, no guess: the locked page still loads.
    await expect(visitor.share.resolve({ token })).resolves.toEqual({ needsPassword: true });
  });

  test("the right password resets the count of wrong ones", async () => {
    const fileId = await upload(uniqueName());
    const { token } = await shareFile(fileId, { password: "open sesame" });

    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < 9; i++) {
        await visitor.share.resolve({ token, password: "wrong guess" }).catch(() => {});
      }

      await expect(
        visitor.share.resolve({ token, password: "open sesame" }),
      ).resolves.toMatchObject({ kind: "file" });
    }
  });

  test("another user can't create, list or revoke links on your files", async () => {
    const folder = await newFolder(crypto.randomUUID());
    const fileId = await upload(uniqueName(), "x", folder.id);
    const input = { expiry: "never", password: "" } as const;

    await expect(bob.share.create({ ...input, fileId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    await expect(bob.share.create({ ...input, folderId: folder.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    await expect(bob.share.list({ fileId })).rejects.toMatchObject({ code: "NOT_FOUND" });

    await expect(bob.share.list({ folderId: folder.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    const fileLink = await shareFile(fileId);
    const folderLink = await shareFolder(folder.id);

    for (const { id, token } of [fileLink, folderLink]) {
      await expect(bob.share.revoke({ linkId: id })).rejects.toMatchObject({ code: "NOT_FOUND" });

      await expect(visitor.share.resolve({ token })).resolves.toMatchObject({
        needsPassword: false,
      });
    }

    await expect(visitor.share.create({ ...input, fileId })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });

    await expect(alice.share.create({ ...input })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("trashing stops a file link, and restoring doesn't bring it back", async () => {
    const fileId = await upload(uniqueName());
    const { token } = await shareFile(fileId);

    await alice.file.trash({ fileId });
    await expect(visitor.share.resolve({ token })).rejects.toMatchObject(NOT_AVAILABLE);

    await expect(
      alice.share.create({ fileId, expiry: "never", password: "" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    await alice.file.restore({ fileId });
    await expect(visitor.share.resolve({ token })).rejects.toMatchObject(NOT_AVAILABLE);
    expect((await alice.share.list({ fileId }))[0]!.revokedAt).toBeInstanceOf(Date);

    // A new link works.
    const fresh = await shareFile(fileId);

    await expect(visitor.share.resolve({ token: fresh.token })).resolves.toMatchObject({
      kind: "file",
    });
  });

  test("trashing a folder stops links to it and to everything in it, for good", async () => {
    const top = await newFolder(crypto.randomUUID());
    const sub = await newFolder("sub", top.id);
    const fileId = await upload(uniqueName(), "x", sub.id);
    const links = await Promise.all([shareFolder(top.id), shareFolder(sub.id), shareFile(fileId)]);

    await alice.folder.trash({ folderId: top.id });

    for (const { token } of links) {
      await expect(visitor.share.resolve({ token })).rejects.toMatchObject(NOT_AVAILABLE);
    }

    await alice.folder.restore({ folderId: top.id });

    for (const { token } of links) {
      await expect(visitor.share.resolve({ token })).rejects.toMatchObject(NOT_AVAILABLE);
    }
  });

  test("a file gone from the bucket stops at download, gives no provider details, and isn't counted", async () => {
    const fileId = await upload(uniqueName());
    const { id, token } = await shareFile(fileId);
    const [row] = await db.select().from(files).where(eq(files.id, fileId));

    await s3.send(new DeleteObjectCommand({ Bucket: "fileee", Key: row!.objectKey }));

    await expect(visitor.share.download({ token, fileId })).rejects.toMatchObject(NOT_AVAILABLE);
    expect(await countOf(id)).toBe(0);
    await expect(visitor.share.resolve({ token })).rejects.toMatchObject(NOT_AVAILABLE);
  });

  test("purging removes the link", async () => {
    const fileId = await upload(uniqueName());
    const { id, token } = await shareFile(fileId);

    await alice.file.trash({ fileId });
    await alice.file.purge({ fileId });
    await expect(visitor.share.resolve({ token })).rejects.toMatchObject(NOT_AVAILABLE);
    await runJobs();
    expect(await db.select().from(shareLinks).where(eq(shareLinks.id, id))).toEqual([]);
  });

  test("a disabled owner's links stop", async () => {
    const fileId = await upload(uniqueName());
    const { token } = await shareFile(fileId);
    const [owner] = await db.select().from(users).where(eq(users.email, ADMIN.email));

    await db.update(users).set({ disabledAt: new Date() }).where(eq(users.id, owner!.id));
    await expect(visitor.share.resolve({ token })).rejects.toMatchObject(NOT_AVAILABLE);
    await db.update(users).set({ disabledAt: null }).where(eq(users.id, owner!.id));
  });

  describe("folder links", () => {
    let shared: { id: string };
    let inside: { id: string };
    let outside: { id: string };
    let token: string;
    let linkId: string;
    let keptFile: string;
    let nestedFile: string;
    let trashedFile: string;
    let outsideFile: string;
    let siblingFile: string;

    beforeAll(async () => {
      shared = await newFolder(crypto.randomUUID());
      inside = await newFolder("inside", shared.id);
      outside = await newFolder(crypto.randomUUID());
      keptFile = await upload("kept.txt", "kept", shared.id);
      nestedFile = await upload("nested.txt", "nested", inside.id);
      trashedFile = await upload("trashed.txt", "t", shared.id);
      outsideFile = await upload("outside.txt", "o", outside.id);
      siblingFile = await upload(uniqueName(), "s");
      await alice.file.trash({ fileId: trashedFile });

      const link = await shareFolder(shared.id);

      token = link.token;
      linkId = link.id;
    });

    test("lists its own contents, without trashed files", async () => {
      expect(await visitor.share.resolve({ token })).toMatchObject({
        kind: "folder",
        folders: [{ id: inside.id, name: "inside" }],
        files: [{ id: keptFile, name: "kept.txt" }],
        truncated: false,
      });
    });

    test("browses and downloads inside its subtree", async () => {
      expect(await visitor.share.resolve({ token, folderId: inside.id })).toMatchObject({
        files: [{ id: nestedFile }],
      });

      const before = await countOf(linkId);
      const { url } = await visitor.share.download({ token, fileId: nestedFile });

      expect(await (await fetch(url)).text()).toBe("nested");
      expect(await countOf(linkId)).toBe(before + 1);
    });

    test("can't reach anything outside its subtree", async () => {
      for (const folderId of [outside.id, rootId]) {
        await expect(visitor.share.resolve({ token, folderId })).rejects.toMatchObject(
          NOT_AVAILABLE,
        );
      }

      for (const fileId of [outsideFile, siblingFile, trashedFile, "missing"]) {
        await expect(visitor.share.download({ token, fileId })).rejects.toMatchObject(
          NOT_AVAILABLE,
        );
      }
    });

    test("a file moved out is out of reach, and a trashed subfolder is too", async () => {
      const moved = await upload(uniqueName(), "m", shared.id);

      await expect(visitor.share.download({ token, fileId: moved })).resolves.toBeTruthy();
      await alice.file.move({ fileId: moved, folderId: outside.id });

      await expect(visitor.share.download({ token, fileId: moved })).rejects.toMatchObject(
        NOT_AVAILABLE,
      );

      const sub = await newFolder(crypto.randomUUID(), shared.id);
      const subFile = await upload(uniqueName(), "s", sub.id);

      await alice.folder.trash({ folderId: sub.id });

      await expect(visitor.share.resolve({ token, folderId: sub.id })).rejects.toMatchObject(
        NOT_AVAILABLE,
      );

      await expect(visitor.share.download({ token, fileId: subFile })).rejects.toMatchObject(
        NOT_AVAILABLE,
      );

      const listed = await visitor.share.resolve({ token });

      expect(listed.needsPassword === false && listed.kind === "folder" && listed.folders).toEqual([
        { id: inside.id, name: "inside" },
      ]);
    });

    test("a password covers browsing, downloading and subfolders", async () => {
      const { token: locked } = await shareFolder(shared.id, { password: "open sesame" });

      await expect(visitor.share.resolve({ token: locked, folderId: inside.id })).resolves.toEqual({
        needsPassword: true,
      });

      await expect(
        visitor.share.download({ token: locked, fileId: keptFile }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });

      await expect(
        visitor.share.resolve({ token: locked, password: "open sesame" }),
      ).resolves.toMatchObject({ kind: "folder" });
    });
  });

  test("removing the storage removes its links", async () => {
    const otherId = (
      await alice.storage.create({
        name: "Other",
        provider: "minio",
        endpoint: endpoint!,
        region: "us-east-1",
        bucket: "fileee",
        prefix: `${prefix}-other`,
        forcePathStyle: true,
        accessKeyId: "minioadmin",
        secretAccessKey: "minioadmin",
      })
    ).id;

    await runJobs();

    const other = (await alice.folder.get({ storageId: otherId })).folder.id;

    const folder = await alice.folder.create({
      storageId: otherId,
      parentId: other,
      name: "docs",
    });

    const { id, token } = await shareFolder(folder.id);

    await alice.storage.remove({ storageId: otherId });
    await expect(visitor.share.resolve({ token })).rejects.toMatchObject(NOT_AVAILABLE);
    expect(await db.select().from(shareLinks).where(eq(shareLinks.id, id))).toEqual([]);
  });
});
