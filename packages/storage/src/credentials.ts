import { createDecipheriv } from "node:crypto";
import { decrypt, encrypt } from "minicrypt/xchacha20-poly1305";

export interface Credentials {
  accessKeyId: string;
  secretAccessKey: string;
}

export const KEY_VERSION = 2;

export function encryptionKey() {
  const raw = process.env.ENCRYPTION_KEY;

  if (!raw) throw new Error("ENCRYPTION_KEY is not set (openssl rand -base64 32)");

  const key = Buffer.from(raw, "base64");

  if (key.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes, base64 encoded");

  return key;
}

/** The version goes into key derivation, so a row can't be replayed under another key version. */
const options = (keyVersion: number) => ({
  key: encryptionKey().toString("base64"),
  info: `fileee/credentials:v${keyVersion}`,
});

export async function encryptCredentials(credentials: Credentials) {
  return {
    encryptedCredentials: await encrypt({
      ...options(KEY_VERSION),
      data: JSON.stringify(credentials),
    }),
    keyVersion: KEY_VERSION,
  };
}

/** Rows saved before minicrypt were AES-256-GCM. They're rewritten the next time their storage is edited. */
function decryptV1(encrypted: string): Credentials {
  const [iv, tag, data] = encrypted.split(".").map((part) => Buffer.from(part, "base64"));

  if (!iv || !tag || !data) throw new Error("Malformed encrypted credentials");

  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);

  decipher.setAAD(Buffer.from("1"));
  decipher.setAuthTag(tag);

  return JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8"));
}

export async function decryptCredentials(
  encrypted: string,
  keyVersion: number,
): Promise<Credentials> {
  if (keyVersion === 1) return decryptV1(encrypted);

  return JSON.parse(await decrypt({ ...options(keyVersion), data: encrypted }));
}
