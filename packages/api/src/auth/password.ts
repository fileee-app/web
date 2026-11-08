import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const PARAMS = { N: 2 ** 17, r: 8, p: 1 };
const KEY_LENGTH = 32;

const derive = (password: string, salt: Buffer, params: typeof PARAMS) =>
  new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password.normalize("NFKC"),
      salt,
      KEY_LENGTH,
      { ...params, maxmem: 256 * params.N * params.r },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await derive(password, salt, PARAMS);
  const { N, r, p } = PARAMS;

  return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [, N, r, p, salt, hash] = stored.split("$");
  const expected = Buffer.from(hash ?? "", "base64");

  const actual = await derive(password, Buffer.from(salt ?? "", "base64"), {
    N: Number(N),
    r: Number(r),
    p: Number(p),
  });

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export const needsRehash = (stored: string) => {
  const { N, r, p } = PARAMS;

  return !stored.startsWith(`scrypt$${N}$${r}$${p}$`);
};

/** Verified against for unknown emails, so timing doesn't reveal which accounts exist. */
let dummy: Promise<string> | undefined;

export const dummyHash = () => (dummy ??= hashPassword(randomBytes(16).toString("hex")));
