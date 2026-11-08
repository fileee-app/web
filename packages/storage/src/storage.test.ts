import { createCipheriv, randomBytes } from "node:crypto";
import { expect, test, vi } from "vitest";
import {
  attachmentDisposition,
  decryptCredentials,
  encryptCredentials,
  isPrivateAddress,
  MAX_PARTS,
  MIN_PART_SIZE,
  partSizeFor,
  safeFileName,
  safeLookup,
  validateEndpoint,
  withPrefix,
} from "./index.ts";

vi.stubEnv("ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
vi.stubEnv("ALLOW_PRIVATE_ENDPOINTS", "false");

const creds = { accessKeyId: "AKIA", secretAccessKey: "secret" };

test("credentials round trip, and another version or tampering fails", async () => {
  const { encryptedCredentials, keyVersion } = await encryptCredentials(creds);

  expect(keyVersion).toBe(2);
  expect(encryptedCredentials).not.toContain("secret");
  await expect(decryptCredentials(encryptedCredentials, keyVersion)).resolves.toEqual(creds);

  await expect(decryptCredentials(encryptedCredentials, keyVersion + 1)).rejects.toThrow(
    "invalid tag",
  );

  const last = encryptedCredentials.at(-1) === "0" ? "1" : "0";

  await expect(
    decryptCredentials(`${encryptedCredentials.slice(0, -1)}${last}`, keyVersion),
  ).rejects.toThrow("invalid tag");
});

test("credentials saved as AES-256-GCM still decrypt", async () => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.alloc(32, 7), iv);

  cipher.setAAD(Buffer.from("1"));

  const data = Buffer.concat([cipher.update(JSON.stringify(creds), "utf8"), cipher.final()]);
  const encrypted = [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64")).join(".");

  await expect(decryptCredentials(encrypted, 1)).resolves.toEqual(creds);
});

test.each([
  ["http://s3.example.com", false],
  ["https://user:pw@s3.example.com", false],
  ["https://localhost", false],
  ["https://127.0.0.1", false],
  ["https://169.254.169.254", false],
  ["https://10.0.0.1", false],
  ["https://[::1]", false],
  ["https://[::ffff:127.0.0.1]", false],
  ["not a url", false],
  ["https://s3.example.com", true],
  ["https://8.8.8.8", true],
])("validateEndpoint(%s) ok=%s", (url, ok) => {
  expect(validateEndpoint(url) === null).toBe(ok);
});

test("private endpoints are allowed only when opted in", () => {
  vi.stubEnv("ALLOW_PRIVATE_ENDPOINTS", "true");
  expect(validateEndpoint("http://localhost:9000")).toBeNull();
  vi.stubEnv("ALLOW_PRIVATE_ENDPOINTS", "false");
});

test("private address ranges", () => {
  for (const ip of [
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "::1",
    "fe80::1",
    "fd00::1",
    "fec0::1",
    "64:ff9b::7f00:1",
    "2002:7f00:1::",
    "::ffff:10.0.0.1",
  ]) {
    expect(isPrivateAddress(ip)).toBe(true);
  }

  for (const ip of ["8.8.8.8", "172.32.0.1", "2606:4700::1"]) {
    expect(isPrivateAddress(ip)).toBe(false);
  }
});

test("a hostname resolving to a private address fails at connection time", async () => {
  const err = await new Promise((resolve) => safeLookup("localhost", {}, (e) => resolve(e)));

  expect(err).toBeInstanceOf(Error);
});

test("part size stays within provider limits", () => {
  expect(partSizeFor(1)).toBe(MIN_PART_SIZE);

  for (const size of [5 * 1024 ** 3, 200 * 1024 ** 3, 5 * 1024 ** 4]) {
    const part = partSizeFor(size);

    expect(part).toBeGreaterThanOrEqual(MIN_PART_SIZE);
    expect(Math.ceil(size / part)).toBeLessThanOrEqual(MAX_PARTS);
  }
});

test("file names are safe in keys and headers", () => {
  expect(safeFileName("../a/b\\c\n.txt")).toBe(".._a_b_c_.txt");
  expect(safeFileName("  ")).toBe("file");

  expect(attachmentDisposition('we"ird;é.txt')).toBe(
    `attachment; filename="we_ird__.txt"; filename*=UTF-8''we%22ird%3B%C3%A9.txt`,
  );

  expect(withPrefix("a/", "b")).toBe("a/b");
  expect(withPrefix("", "b")).toBe("b");
});
