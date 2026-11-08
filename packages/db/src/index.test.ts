import { expect, test, vi } from "vitest";
import { createTestDatabase } from "./test-database.ts";

vi.stubEnv("DATABASE_URL", await createTestDatabase());

const { db } = await import("./index.ts");
const { sql } = await import("drizzle-orm");

const rows = async (query: ReturnType<typeof sql>) => (await db.execute(query)).rows;

test("transactions take turns, so one can check a row and then act on it", async () => {
  await db.execute(sql`CREATE TABLE counter (n INTEGER)`);
  await db.execute(sql`INSERT INTO counter VALUES (0)`);

  // Without turns these would all read the same value and lose updates.
  await Promise.all(
    Array.from({ length: 5 }, () =>
      db.transaction(async (tx) => {
        const { rows: read } = await tx.execute<{ n: number }>(sql`SELECT n FROM counter`);

        await new Promise((resolve) => setTimeout(resolve, 10));
        await tx.execute(sql`UPDATE counter SET n = ${read[0]!.n + 1}`);
      }),
    ),
  );

  expect(await rows(sql`SELECT n FROM counter`)).toEqual([{ n: 5 }]);
});

test("a failed transaction rolls back and lets the next one through", async () => {
  await db.execute(sql`CREATE TABLE u (n INTEGER PRIMARY KEY)`);

  await expect(
    db.transaction(async (tx) => {
      await tx.execute(sql`INSERT INTO u VALUES (1)`);
      await tx.execute(sql`INSERT INTO u VALUES (1)`);
    }),
  ).rejects.toThrow("Failed query");

  await db.transaction((tx) => tx.execute(sql`INSERT INTO u VALUES (2)`));
  expect(await rows(sql`SELECT n FROM u`)).toEqual([{ n: 2 }]);
});

test("a savepoint keeps its transaction alive after a failed statement", async () => {
  await db.execute(sql`CREATE TABLE s (n INTEGER PRIMARY KEY)`);

  await db.transaction(async (tx) => {
    await tx.execute(sql`INSERT INTO s VALUES (1)`);

    await expect(
      tx.transaction((savepoint) => savepoint.execute(sql`INSERT INTO s VALUES (1)`)),
    ).rejects.toThrow("Failed query");

    await tx.execute(sql`INSERT INTO s VALUES (2)`);
  });

  expect(await rows(sql`SELECT n FROM s ORDER BY n`)).toEqual([{ n: 1 }, { n: 2 }]);
});

test("reads don't wait for an open transaction", async () => {
  let finish!: () => void;

  const open = db.transaction(async (tx) => {
    await tx.execute(sql`INSERT INTO u VALUES (5)`);

    await new Promise<void>((resolve) => {
      finish = resolve;
    });
  });

  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(await rows(sql`SELECT n FROM u WHERE n = 5`)).toEqual([]);
  finish();
  await open;
});
