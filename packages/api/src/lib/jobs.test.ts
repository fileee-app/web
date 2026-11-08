import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { db, jobs, syncRuns } from "@fileee/db";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { ADMIN, setupTestApp } from "../test-utils.ts";
import { runJobs } from "./jobs.ts";
import { runSync } from "./sync.ts";

const { browser } = await setupTestApp();
const user = browser();
// Accepts every connection and never answers, like a storage endpoint that stalls.
const silent = createServer(() => {});

const connect = (name: string, endpoint: string) =>
  user.storage.create({
    name,
    provider: "minio",
    endpoint,
    region: "us-east-1",
    bucket: "b",
    prefix: "",
    forcePathStyle: true,
    accessKeyId: "a",
    secretAccessKey: "s",
  });

const runsOf = (storageId: string) =>
  db.select().from(syncRuns).where(eq(syncRuns.storageId, storageId));

const runningSyncs = () =>
  db
    .select()
    .from(jobs)
    .where(and(eq(jobs.type, "sync"), eq(jobs.status, "running")));

beforeAll(async () => {
  await new Promise<void>((resolve) => silent.listen(0, "127.0.0.1", resolve));
  await user.setup.complete(ADMIN);
});

afterAll(async () => {
  silent.close();
  silent.closeAllConnections();
  await runJobs();
});

test("a sync past its time limit stops with a reason", async () => {
  const storage = await connect("slow", "http://127.0.0.1:1");

  await vi.waitFor(async () => expect((await runsOf(storage.id))[0]?.status).toBe("failed"));

  const [run] = await db
    .insert(syncRuns)
    .values({
      storageId: storage.id,
      trigger: "manual",
      status: "running",
      startedAt: new Date(Date.now() - 7 * 3_600_000),
    })
    .returning();

  await runSync(run!.id, async () => {});

  const [after] = await db.select().from(syncRuns).where(eq(syncRuns.id, run!.id));

  expect(after).toMatchObject({ status: "failed", error: expect.stringMatching(/over 6 hours/) });
});

test("stalled syncs can't hold up removing public copies", async () => {
  const { port } = silent.address() as AddressInfo;
  const endpoint = `http://127.0.0.1:${port}`;
  const [first] = await Promise.all(["a", "b", "c"].map((name) => connect(name, endpoint)));

  await vi.waitFor(async () => expect((await runningSyncs()).length).toBeGreaterThanOrEqual(2));

  await db
    .insert(jobs)
    .values({ type: "unpublish", payload: { storageId: first!.id }, runAt: new Date() });

  void runJobs();

  await vi.waitFor(
    async () => expect(await db.select().from(jobs).where(eq(jobs.type, "unpublish"))).toEqual([]),
    { timeout: 5000 },
  );
});
