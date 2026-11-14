import { db, loginAttempts, publicFiles, sessions, users } from "@fileee/db";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import { hashPassword, needsRehash, verifyPassword } from "../../auth/password.ts";
import { ADMIN, setupTestApp } from "../../test-utils.ts";
import { router } from "../_router.ts";

const { browser } = await setupTestApp();
const admin = browser();

const makeUser = async (email: string, password = "a long enough password") => {
  await admin.user.create({ name: "U", email, password, role: "user" });

  return { email, password };
};

const errorFor = (e: string) =>
  browser()
    .auth.login({ email: e, password: "nope" })
    .catch((error) => [error.code, error.message]);

beforeAll(async () => {
  await admin.setup.complete(ADMIN);
});

test("password hash round trip, NFKC and stale parameters", async () => {
  const hash = await hashPassword("ﬁle password long");

  expect(await verifyPassword("file password long", hash)).toBe(true);
  expect(await verifyPassword("wrong", hash)).toBe(false);
  expect(needsRehash(hash)).toBe(false);
  expect(needsRehash("scrypt$16384$8$1$a$b")).toBe(true);
});

test("an old hash is upgraded at login", async () => {
  const { email, password } = await makeUser("old@example.com");
  const { scryptSync, randomBytes } = await import("node:crypto");
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
  const old = `scrypt$16384$8$1$${salt.toString("base64")}$${key.toString("base64")}`;

  await db.update(users).set({ passwordHash: old }).where(eq(users.email, email));
  await browser().auth.login({ email, password });

  const [row] = await db.select().from(users).where(eq(users.email, email));

  expect(needsRehash(row!.passwordHash)).toBe(false);
});

test("wrong password and unknown email give the same error", async () => {
  const { email } = await makeUser("same@example.com");

  expect(await errorFor(email)).toEqual(await errorFor("nobody@example.com"));
});

test("someone guessing an email locks out only their own address", async () => {
  const { email, password } = await makeUser("limit@example.com");

  // Past the limits, so their blocked attempts can't add to the email's own count either.
  for (let i = 0; i < 60; i++) {
    await browser("10.0.0.1")
      .auth.login({ email, password: "wrong" })
      .catch(() => {});
  }

  await expect(browser("10.0.0.1").auth.login({ email, password })).rejects.toMatchObject({
    code: "TOO_MANY_REQUESTS",
  });

  await expect(browser("10.0.0.2").auth.login({ email, password })).resolves.toMatchObject({
    email,
  });
});

test("guesses from many addresses still lock the email", async () => {
  const { email, password } = await makeUser("botnet@example.com");

  await db
    .insert(loginAttempts)
    .values({ key: `email:${email}`, count: 100, windowStartedAt: new Date() });

  await expect(browser("10.0.1.1").auth.login({ email, password })).rejects.toMatchObject({
    code: "TOO_MANY_REQUESTS",
  });
});

test("login is rate limited per IP", async () => {
  for (let i = 0; i < 50; i++) {
    await browser("9.9.9.9")
      .auth.login({ email: `x${i}@example.com`, password: "wrong" })
      .catch(() => {});
  }

  await expect(
    browser("9.9.9.9").auth.login({ email: "y@example.com", password: "wrong" }),
  ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
});

test("unauthenticated calls are rejected and non-admins can't reach admin procedures", async () => {
  await expect(browser().storage.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  expect(await browser().auth.me()).toBeNull();

  const { email, password } = await makeUser("plain@example.com");
  const user = browser();

  await user.auth.login({ email, password });
  expect((await user.auth.me())?.email).toBe(email);
  await expect(user.user.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(user.settings.update({ appName: "x" })).rejects.toMatchObject({ code: "FORBIDDEN" });
});

test("expired sessions are rejected", async () => {
  const { email, password } = await makeUser("expired@example.com");
  const user = browser();

  await user.auth.login({ email, password });

  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));

  await db
    .update(sessions)
    .set({ expiresAt: new Date(0) })
    .where(eq(sessions.userId, row!.id));

  expect(await user.auth.me()).toBeNull();
});

test("the absolute limit caps sliding expiry", async () => {
  const { email, password } = await makeUser("absolute@example.com");
  const user = browser();

  await user.auth.login({ email, password });

  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));

  await db
    .update(sessions)
    .set({ absoluteExpiresAt: new Date(0) })
    .where(eq(sessions.userId, row!.id));

  expect(await user.auth.me()).toBeNull();
});

test("logout ends the session", async () => {
  const { email, password } = await makeUser("out@example.com");
  const user = browser();

  await user.auth.login({ email, password });
  await user.auth.logout();
  expect(await user.auth.me()).toBeNull();
});

test("changing a password ends other sessions but keeps this one", async () => {
  const { email, password } = await makeUser("change@example.com");
  const here = browser();
  const there = browser();

  await here.auth.login({ email, password });
  await there.auth.login({ email, password });

  await expect(
    here.auth.changePassword({ currentPassword: "wrong", newPassword: "another long password" }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });

  await here.auth.changePassword({
    currentPassword: password,
    newPassword: "another long password",
  });

  expect(await here.auth.me()).not.toBeNull();
  expect(await there.auth.me()).toBeNull();
});

test("an admin reset ends all sessions; disabling a user locks them out", async () => {
  const { email, password } = await makeUser("reset@example.com");
  const user = browser();

  await user.auth.login({ email, password });

  const target = (await admin.user.list()).find((u) => u.email === email)!;

  await admin.user.resetPassword({ userId: target.id, password: "brand new password" });
  expect(await user.auth.me()).toBeNull();

  await user.auth.login({ email, password: "brand new password" });
  await admin.user.setDisabled({ userId: target.id, disabled: true });
  expect(await user.auth.me()).toBeNull();

  await expect(user.auth.login({ email, password: "brand new password" })).rejects.toMatchObject({
    code: "UNAUTHORIZED",
  });
});

test("disabling a user takes down their public copies", async () => {
  const { email, password } = await makeUser("published@example.com");
  const user = browser();
  const { id: userId } = await user.auth.login({ email, password });

  const storage = await user.storage.create({
    name: "S",
    provider: "minio",
    endpoint: "http://localhost:9",
    region: "us-east-1",
    bucket: "b",
    prefix: "",
    forcePathStyle: true,
    accessKeyId: "a",
    secretAccessKey: "s",
  });

  const [copy] = await db
    .insert(publicFiles)
    .values({
      userId,
      storageId: storage.id,
      bucket: "b",
      publicKey: "t/f.png",
      url: "https://cdn.example.com/t/f.png",
      copiedAt: new Date(),
    })
    .returning();

  await admin.user.setDisabled({ userId, disabled: true });

  const [after] = await db.select().from(publicFiles).where(eq(publicFiles.id, copy!.id));

  expect(after?.unpublishedAt).toBeInstanceOf(Date);
});

test("the last active admin can't be disabled or deleted", async () => {
  const me = await admin.auth.me();

  await expect(admin.user.setDisabled({ userId: me!.id, disabled: true })).rejects.toMatchObject({
    code: "CONFLICT",
  });

  await expect(admin.user.remove({ userId: me!.id })).rejects.toMatchObject({ code: "CONFLICT" });
});

test("emails are unique, case-insensitively", async () => {
  await expect(
    admin.user.create({
      name: "D",
      email: "ADMIN@example.com",
      password: "a long enough password",
      role: "user",
    }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
});

test("the app API signs in with a bearer token and never sets a cookie", async () => {
  const { email, password } = await makeUser("app@example.com");
  const resHeaders = new Headers();
  const app = (token = "") =>
    createRouterClient(router, {
      context: {
        tokenAuth: true,
        reqHeaders: new Headers(token ? { authorization: `Bearer ${token}` } : {}),
        resHeaders,
      },
    });

  const { token } = await app().auth.login({ email, password });

  expect(token).toEqual(expect.any(String));
  expect(resHeaders.get("set-cookie")).toBeNull();
  expect(await app(token).auth.me()).toMatchObject({ email });
  expect("token" in (await browser().auth.login({ email, password }))).toBe(false);

  await app(token).auth.logout();

  expect(await app(token).auth.me()).toBeNull();
});
