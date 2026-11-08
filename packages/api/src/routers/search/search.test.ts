// The upload, sync and purge parts run against MinIO: docker compose -f docker-compose.dev.yml up -d, then S3_TEST_ENDPOINT=http://localhost:9000 pnpm test
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { db, files, folders, storages } from "@fileee/db";
import { createClient } from "@fileee/storage";
import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";
import { runJobs } from "../../lib/jobs.ts";
import { ADMIN, setupTestApp } from "../../test-utils.ts";
import { toTerms } from "./query.ts";

const endpoint = process.env.S3_TEST_ENDPOINT;
const { browser } = await setupTestApp();
const alice = browser();
const bob = browser();
let aliceId: string;
let bobId: string;
let storageId: string;
let otherStorageId: string;
let rootId: string;
let otherRootId: string;

/** A storage row with no bucket behind it, for tests that don't touch S3. */
async function addStorage(userId: string, name: string) {
  const id = crypto.randomUUID();
  const folderId = crypto.randomUUID();

  await db.insert(storages).values({
    id,
    userId,
    name,
    provider: "minio",
    region: "us-east-1",
    bucket: "none",
    encryptedCredentials: "unused",
    keyVersion: 1,
  });

  await db.insert(folders).values({ id: folderId, storageId: id, name: "" });

  return { id, rootId: folderId };
}

async function addFile(name: string, values: Partial<typeof files.$inferInsert> = {}) {
  const id = crypto.randomUUID();

  await db.insert(files).values({
    id,
    storageId,
    folderId: rootId,
    name,
    objectKey: `key/${id}`,
    size: 1,
    status: "ready",
    ...values,
  });

  return id;
}

const find = async (q: string, client = alice) =>
  (await client.search.query({ q })).items.map((f) => f.name).toSorted();

const names = async (filters: object, q = "filtered") =>
  (await alice.search.query({ q, ...filters })).items.map((f) => f.name.split(" ")[1]).toSorted();

const pagedStorage = async () =>
  (await db.select().from(storages).where(eq(storages.name, "Paged")))[0]!.id;

const indexed = async (word: string) =>
  (
    await db.execute<{ c: number }>(
      sql`SELECT count(*)::int c FROM file WHERE search @@ search_term(${word})`,
    )
  ).rows[0]!.c;

const statusOf = async (q: string) => (await alice.search.query({ q })).items.map((f) => f.status);

beforeAll(async () => {
  await alice.setup.complete(ADMIN);

  await alice.user.create({
    name: "Bob",
    email: "bob@example.com",
    password: "a long enough password",
    role: "user",
  });

  await bob.auth.login({ email: "bob@example.com", password: "a long enough password" });
  aliceId = (await alice.auth.me())!.id;
  bobId = (await bob.auth.me())!.id;
  ({ id: storageId, rootId } = await addStorage(aliceId, "Main"));
  ({ id: otherStorageId, rootId: otherRootId } = await addStorage(aliceId, "Photos"));
});

describe("text is never tsquery syntax", () => {
  test.each([
    '"',
    '""',
    '"unbalanced',
    "unbalanced'",
    "*",
    "a*",
    "*a",
    "^a",
    "(",
    ")",
    "(a",
    "a)",
    "AND",
    "OR",
    "NOT",
    "a AND",
    "OR a",
    "NOT a",
    "a NOT",
    "NEAR",
    "NEAR(a b)",
    "NEAR(a b, 2)",
    "name:a",
    "meta:a",
    "nosuchcolumn:a",
    "{name meta}:a",
    "-name:a",
    "a + b",
    "+",
    "-",
    ":",
    ",",
    ";",
    "\\",
    "%",
    "_",
    "'; DROP TABLE file; --",
    "a\0b",
    "\0",
    "🦄",
    "🦄 a",
    "a".repeat(200),
  ])("%j doesn't fail", async (q) => {
    await expect(alice.search.query({ q })).resolves.toBeDefined();
  });

  test("operators and columns are plain words", async () => {
    await addFile("cats and dogs.txt");
    await addFile("cats.txt");
    await addFile("hidden name.txt");
    await addFile("name hidden.txt");
    expect(await find("cats NOT dogs")).toEqual([]); // needs a file with all three words
    expect(await find("cats OR nothingmatches")).toEqual([]);
    expect(await find("cats AND dogs")).toEqual(["cats and dogs.txt"]);
    // A real column filter would find "hidden name.txt"; here it's the phrase "name hidden".
    expect(await find("name:hidden")).toEqual(["name hidden.txt"]);
    expect(await find("meta:hidden")).toEqual([]);
    expect(await find('cats"')).toEqual(["cats and dogs.txt", "cats.txt"]);
  });

  test("text that's only punctuation matches nothing, not everything", async () => {
    await addFile("punctuation.txt");
    expect(toTerms('*** "" -')).toEqual([]);
    expect(await find("***")).toEqual([]);
  });

  test("every term is passed on whole", () => {
    expect(toTerms('say "hi" NOT')).toEqual(["say", '"hi"', "NOT"]);
  });
});

describe("matching", () => {
  test("names split on punctuation, terms are prefixes, and accents and case don't matter", async () => {
    await addFile("Quarterly_Report-2024.FINAL.pdf");
    await addFile("Résumé draft.docx");

    for (const q of [
      "quarterly",
      "QUART",
      "report",
      "2024",
      "final",
      "pdf",
      "quarterly_report",
      "2024 quart",
    ]) {
      expect(await find(q)).toContain("Quarterly_Report-2024.FINAL.pdf");
    }

    expect(await find("resume")).toEqual(["Résumé draft.docx"]);
    expect(await find("résumé")).toEqual(["Résumé draft.docx"]);
  });

  test("metadata is searched, and a name match ranks above a metadata match", async () => {
    await addFile("unrelated.jpg", { metadata: { camera: "Zeiss Ikon", title: "x" } });
    await addFile("zeiss manual.pdf");

    const { items } = await alice.search.query({ q: "zeiss" });

    expect(items.map((f) => f.name)).toEqual(["zeiss manual.pdf", "unrelated.jpg"]);
    expect(await find("ikon")).toEqual(["unrelated.jpg"]);
    await addFile("by author.pdf", { metadata: { author: "Ada Lovelace" } });
    await addFile("by title.pdf", { metadata: { title: "Analytical engine" } });
    expect(await find("lovelace")).toEqual(["by author.pdf"]);
    expect(await find("analytical")).toEqual(["by title.pdf"]);
  });
});

describe("visibility", () => {
  test("one user can't find another's files, or filter into their storage", async () => {
    const bobs = await addStorage(bobId, "Bob's");

    await addFile("sharedword alice.txt");
    await addFile("sharedword bob.txt", { storageId: bobs.id, folderId: bobs.rootId });
    expect(await find("sharedword")).toEqual(["sharedword alice.txt"]);
    expect(await find("sharedword", bob)).toEqual(["sharedword bob.txt"]);

    const reach = await alice.search.query({ q: "sharedword", storageId: bobs.id });

    expect(reach.items).toEqual([]);
    expect((await alice.search.query({ storageId: bobs.id, q: "" })).items).toEqual([]);
  });

  test("signing in is required", async () => {
    await expect(browser().search.query({ q: "x" })).rejects.toThrow("Sign in");
  });

  test("pending, purging and trashed files stay out; missing ones stay in, and say so", async () => {
    await addFile("statuscheck pending.txt", { status: "pending" });
    await addFile("statuscheck purging.txt", { status: "purging", trashedAt: new Date() });
    await addFile("statuscheck trashed.txt", { trashedAt: new Date() });
    await addFile("statuscheck ready.txt");
    await addFile("statuscheck missing.txt", { status: "missing" });

    const { items } = await alice.search.query({ q: "statuscheck" });

    expect(items.map((f) => [f.name, f.status]).toSorted()).toEqual([
      ["statuscheck missing.txt", "missing"],
      ["statuscheck ready.txt", "ready"],
    ]);
  });
});

describe("filters", () => {
  const JAN = new Date("2024-01-15T12:00:00Z");
  const MAR = new Date("2024-03-15T12:00:00Z");

  beforeAll(async () => {
    await addFile("filtered a.png", { mimeType: "image/png", size: 10, modifiedAt: JAN });
    await addFile("filtered b.pdf", { mimeType: "application/pdf", size: 2000, modifiedAt: MAR });
    await addFile("filtered c", { mimeType: null, size: 30, modifiedAt: MAR });

    await addFile("filtered d.mp4", {
      mimeType: "video/mp4",
      size: 5000,
      modifiedAt: JAN,
      storageId: otherStorageId,
      folderId: otherRootId,
    });
  });

  test("each alone", async () => {
    expect(await names({ type: "image" })).toEqual(["a.png"]);
    expect(await names({ type: "pdf" })).toEqual(["b.pdf"]);
    expect(await names({ type: "video" })).toEqual(["d.mp4"]);
    expect(await names({ minSize: 2000 })).toEqual(["b.pdf", "d.mp4"]);
    expect(await names({ maxSize: 30 })).toEqual(["a.png", "c"]);
    expect(await names({ storageId: otherStorageId })).toEqual(["d.mp4"]);
    expect(await names({ modifiedFrom: "2024-02-01" })).toEqual(["b.pdf", "c"]);
    expect(await names({ modifiedTo: "2024-02-01" })).toEqual(["a.png", "d.mp4"]);
  });

  test("the date range includes both of its days", async () => {
    expect(await names({ modifiedFrom: "2024-01-15", modifiedTo: "2024-01-15" })).toEqual([
      "a.png",
      "d.mp4",
    ]);
  });

  test("together, with text", async () => {
    expect(
      await names({ type: "pdf", minSize: 1000, modifiedFrom: "2024-03-01", storageId }),
    ).toEqual(["b.pdf"]);

    expect(await names({ type: "pdf", storageId: otherStorageId })).toEqual([]);
  });

  test("without text, newest first", async () => {
    const { items } = await alice.search.query({ q: "", storageId: otherStorageId, type: "video" });

    expect(items.map((f) => f.name)).toEqual(["filtered d.mp4"]);

    const all = await alice.search.query({ q: "", maxSize: 30, modifiedTo: "2024-12-31" });

    expect(all.items.map((f) => f.name)).toEqual(["filtered c", "filtered a.png"]);
  });

  test("sizes past 32 bits work", async () => {
    await addFile("huge.bin", { size: 6_000_000_000 });

    const { items } = await alice.search.query({ q: "huge", minSize: 5_000_000_000 });

    expect(items.map((f) => f.size)).toEqual([6_000_000_000]);
  });

  test("a NUL byte in a name is refused, not a server error", async () => {
    await expect(
      alice.folder.create({ storageId, parentId: rootId, name: "a\0b" }),
    ).rejects.toThrow("invalid character");
  });

  test("bad input is refused", async () => {
    await expect(alice.search.query({ q: "x".repeat(201) })).rejects.toThrow(
      "Input validation failed",
    );

    await expect(alice.search.query({ q: "", minSize: -1 })).rejects.toThrow(
      "Input validation failed",
    );

    await expect(alice.search.query({ q: "", modifiedFrom: "soon" })).rejects.toThrow(
      "Input validation failed",
    );

    await expect(alice.search.query({ q: "", type: "nope" as "pdf" })).rejects.toThrow(
      "Input validation failed",
    );
  });
});

describe("pagination", () => {
  beforeAll(async () => {
    const { id } = await addStorage(aliceId, "Paged");

    const [{ id: folderId }] = (await db
      .select({ id: folders.id })
      .from(folders)
      .where(eq(folders.storageId, id))) as [{ id: string }];

    await db.insert(files).values(
      Array.from({ length: 120 }, (_, i) => ({
        storageId: id,
        folderId,
        name: `pagedword ${i}.txt`,
        objectKey: `paged/${i}`,
        size: 1,
        status: "ready" as const,
        // Some share a modified time, so the id has to break ties.
        modifiedAt: new Date(1_700_000_000_000 + (i % 7)),
      })),
    );
  });

  test.each([
    ["with text", "pagedword"],
    ["with filters only", ""],
  ])("%s, walks every result once", async (_, q) => {
    const seen: string[] = [];
    let cursor: { score: number; id: string } | undefined;

    do {
      const page = await alice.search.query({
        q,
        storageId: q ? undefined : await pagedStorage(),
        cursor,
      });

      seen.push(...page.items.map((f) => f.id));
      cursor = page.nextCursor;
    } while (cursor);

    expect(seen).toHaveLength(120);
    expect(new Set(seen).size).toBe(120);
  });
});

describe("every change keeps the index right", () => {
  test("rename", async () => {
    const fileId = await addFile("beforename.txt");

    await alice.file.rename({ fileId, name: "aftername.txt" });
    expect(await find("beforename")).toEqual([]);
    expect(await find("aftername")).toEqual(["aftername.txt"]);
  });

  test("move, to another folder", async () => {
    const fileId = await addFile("movable.txt");
    const folder = await alice.folder.create({ storageId, parentId: rootId, name: "Destination" });

    await alice.file.move({ fileId, folderId: folder.id });

    const { items } = await alice.search.query({ q: "movable" });

    expect(items.map((f) => f.folderId)).toEqual([folder.id]);
  });

  test("trash and restore, of a file", async () => {
    const fileId = await addFile("binned.txt");

    await alice.file.trash({ fileId });
    expect(await find("binned")).toEqual([]);
    await alice.file.restore({ fileId });
    expect(await find("binned")).toEqual(["binned.txt"]);
  });

  test("trash and restore, of a folder and what's inside", async () => {
    const outer = await alice.folder.create({ storageId, parentId: rootId, name: "Outer" });
    const inner = await alice.folder.create({ storageId, parentId: outer.id, name: "Inner" });

    await addFile("subtree one.txt", { folderId: outer.id });
    await addFile("subtree two.txt", { folderId: inner.id });
    await alice.folder.trash({ folderId: outer.id });
    expect(await find("subtree")).toEqual([]);
    await alice.folder.restore({ folderId: outer.id });
    expect(await find("subtree")).toEqual(["subtree one.txt", "subtree two.txt"]);
  });

  test("restoring under a new name finds the new name", async () => {
    const fileId = await addFile("clash.txt");

    await alice.file.trash({ fileId });
    await addFile("clash.txt");
    await alice.file.restore({ fileId });
    expect(await find("clash")).toEqual(["clash (1).txt", "clash.txt"]);
  });

  test("metadata written after upload is found, and replaced metadata isn't", async () => {
    const fileId = await addFile("photo.jpg");

    expect(await find("hasselblad")).toEqual([]);

    await alice.file.saveExtracted({
      fileId,
      metadata: { camera: "Hasselblad", author: "Ansel" },
      thumbnail: false,
    });

    expect(await find("hasselblad")).toEqual(["photo.jpg"]);
    expect(await find("ansel")).toEqual(["photo.jpg"]);
    await alice.file.saveExtracted({ fileId, metadata: { camera: "Leica\0\0" }, thumbnail: false });
    expect(await find("hasselblad")).toEqual([]);
    expect(await find("leica")).toEqual(["photo.jpg"]);
  });

  test("deleting a storage's rows empties their index entries", async () => {
    const gone = await addStorage(aliceId, "Gone");

    await addFile("cascaded.txt", { storageId: gone.id, folderId: gone.rootId });
    expect(await indexed("cascaded")).toBe(1);
    await db.delete(storages).where(eq(storages.id, gone.id));
    expect(await indexed("cascaded")).toBe(0);
  });
});

describe.skipIf(!endpoint)("the paths through the bucket, against MinIO", () => {
  const s3 = createClient({
    endpoint: endpoint ?? null,
    region: "us-east-1",
    bucket: "fileee",
    prefix: "",
    forcePathStyle: true,
    accessKeyId: "minioadmin",
    secretAccessKey: "minioadmin",
  });

  const prefix = `search-${crypto.randomUUID()}`;
  let realId: string;
  let realRoot: string;

  const put = (key: string, body = "hello") =>
    s3.send(new PutObjectCommand({ Bucket: "fileee", Key: `${prefix}/${key}`, Body: body }));

  const remove = (key: string) =>
    s3.send(new DeleteObjectCommand({ Bucket: "fileee", Key: `${prefix}/${key}` }));

  const sync = async () => {
    await new Promise((resolve) => setTimeout(resolve, 1100)); // LastModified has one-second precision
    await alice.storage.sync({ storageId: realId });
    await runJobs();
  };

  beforeAll(async () => {
    const storage = await alice.storage.create({
      name: "MinIO",
      provider: "minio",
      endpoint: endpoint!,
      region: "us-east-1",
      bucket: "fileee",
      prefix,
      forcePathStyle: true,
      accessKeyId: "minioadmin",
      secretAccessKey: "minioadmin",
    });

    realId = storage.id;
    await runJobs();
    realRoot = (await alice.folder.get({ storageId: realId })).folder.id;
  });

  test("an upload is found once it's ready, not before; an abort leaves nothing", async () => {
    const started = await alice.upload.start({
      storageId: realId,
      folderId: realRoot,
      name: "uploadedword.txt",
      size: 5,
      mimeType: "text/plain",
    });

    if (started.kind !== "single") throw new Error("expected single");

    expect(await find("uploadedword")).toEqual([]);
    await fetch(started.url, { method: "PUT", body: "hello" });
    await alice.upload.complete({ fileId: started.fileId });
    expect(await find("uploadedword")).toEqual(["uploadedword.txt"]);

    const aborted = await alice.upload.start({
      storageId: realId,
      folderId: realRoot,
      name: "abortedword.txt",
      size: 5,
      mimeType: "text/plain",
    });

    await alice.upload.abort({ fileId: aborted.fileId });
    expect(await find("abortedword")).toEqual([]);
  });

  test("sync: imports are found, changes drop old metadata, missing files say so, and return", async () => {
    await put("docs/syncedword.txt");
    await sync();
    expect(await find("syncedword")).toEqual(["syncedword.txt"]);

    const { items } = await alice.search.query({ q: "syncedword" });
    const fileId = items[0]!.id;

    await alice.file.saveExtracted({ fileId, metadata: { title: "Staleword" }, thumbnail: false });
    expect(await find("staleword")).toEqual(["syncedword.txt"]);
    await put("docs/syncedword.txt", "new bytes, so what was extracted is out of date");
    await sync();
    expect(await find("staleword")).toEqual([]);
    expect(await find("syncedword")).toEqual(["syncedword.txt"]);

    await remove("docs/syncedword.txt");
    await sync();
    expect(await statusOf("syncedword")).toEqual(["missing"]);

    await put("docs/syncedword.txt");
    await sync();
    expect(await statusOf("syncedword")).toEqual(["ready"]);
  });

  test("permanent delete: gone from results at once, and from the index when the job has run", async () => {
    await put("purgedword.txt");
    await sync();

    const { items } = await alice.search.query({ q: "purgedword" });
    const fileId = items[0]!.id;

    await alice.file.trash({ fileId });
    await alice.file.purge({ fileId });
    expect(await find("purgedword")).toEqual([]);
    await runJobs();
    expect(await indexed("purgedword")).toBe(0);
  });

  test("removing a storage takes its files out of search", async () => {
    await put("removedword.txt");
    await sync();
    expect(await find("removedword")).toEqual(["removedword.txt"]);
    await alice.storage.remove({ storageId: realId });
    expect(await find("removedword")).toEqual([]);
    expect(await indexed("removedword")).toBe(0);
  });
});
