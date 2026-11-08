import { db, users } from "@fileee/db";
import { expect, test, vi } from "vitest";
import { bootstrap } from "../../bootstrap.ts";
import { ADMIN, setupTestApp } from "../../test-utils.ts";

const { browser } = await setupTestApp();

test("production won't start open to whoever reaches setup first", async () => {
  await expect(bootstrap()).rejects.toThrow(/SETUP_TOKEN/);
});

test("everything but setup is blocked until setup completes", async () => {
  const anon = browser();

  expect(await anon.setup.status()).toEqual({
    complete: false,
    appName: "Fileee",
    setupTokenRequired: false,
  });

  await expect(anon.auth.me()).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

  await expect(anon.share.resolve({ token: "x" })).rejects.toMatchObject({
    code: "PRECONDITION_FAILED",
  });

  await expect(anon.share.download({ token: "x", fileId: "x" })).rejects.toMatchObject({
    code: "PRECONDITION_FAILED",
  });

  await expect(anon.auth.login({ email: ADMIN.email, password: "x" })).rejects.toMatchObject({
    code: "PRECONDITION_FAILED",
  });
});

test("a wrong or missing setup token is rejected", async () => {
  vi.stubEnv("SETUP_TOKEN", "the-token");

  const anon = browser();

  expect((await anon.setup.status()).setupTokenRequired).toBe(true);

  await expect(anon.setup.complete({ ...ADMIN, setupToken: "wrong" })).rejects.toMatchObject({
    code: "FORBIDDEN",
  });

  await expect(anon.setup.complete(ADMIN)).rejects.toMatchObject({ code: "FORBIDDEN" });
  vi.stubEnv("SETUP_TOKEN", "");
  expect(await db.select().from(users)).toEqual([]);
});

test("concurrent completes produce one admin, sign in the winner and close setup", async () => {
  const [a, b] = [browser(), browser()];

  const results = await Promise.allSettled([
    a.setup.complete(ADMIN),
    b.setup.complete({ ...ADMIN, email: "other@example.com" }),
  ]);

  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);

  const loser = results.find((r) => r.status === "rejected") as PromiseRejectedResult;

  expect(loser.reason.code).toBe("CONFLICT");
  expect(await db.select().from(users)).toHaveLength(1);

  const signedIn = (await Promise.all([a.auth.me(), b.auth.me()])).filter(Boolean);

  expect(signedIn).toHaveLength(1);
  expect(signedIn[0]!.role).toBe("admin");
  expect(await browser().setup.status()).toMatchObject({ complete: true, appName: "Acme" });
  await expect(browser().setup.complete(ADMIN)).rejects.toMatchObject({ code: "CONFLICT" });
});
