import { db, files, folders, shareLinks, storages, users } from "@fileee/db";
import type { createClient } from "@fileee/storage";
import { ORPCError } from "@orpc/server";
import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import * as z from "zod";
import { hashPassword, verifyPassword } from "../auth/password.ts";
import { clearRateLimit, enforceRateLimit } from "../auth/rate-limit.ts";
import { hashToken } from "../auth/session.ts";
import { assertInBucket } from "./previews.ts";
import { connect } from "./storage.ts";
import { subtree } from "./trash.ts";

const PASSWORD_ATTEMPTS = 10;

/** Tokens are looked up by hash, so one with its case changed is simply an unknown token. */
export const tokenSchema = z.string().min(1).max(128);
export const passwordAttempt = z.string().min(1).max(128).optional();
export const newPasswordHash = (password: string) => (password ? hashPassword(password) : null);

/** Unknown, revoked, expired, trashed, purged and missing all answer the same, so a visitor learns only that it doesn't work. */
export const unavailable = () =>
  new ORPCError("NOT_FOUND", { message: "This link isn't available." });

export async function findLiveLink(token: string) {
  const now = new Date();

  const [row] = await db
    .select({ link: shareLinks, file: files, folder: folders, storage: storages })
    .from(shareLinks)
    .leftJoin(files, eq(shareLinks.fileId, files.id))
    .leftJoin(folders, eq(shareLinks.folderId, folders.id))
    .innerJoin(storages, sql`${storages.id} = coalesce(${files.storageId}, ${folders.storageId})`)
    .innerJoin(users, eq(storages.userId, users.id))
    .where(
      and(
        eq(shareLinks.tokenHash, hashToken(token)),
        isNull(shareLinks.revokedAt),
        or(isNull(shareLinks.expiresAt), gt(shareLinks.expiresAt, now)),
        isNull(users.disabledAt),
      ),
    );

  if (!row) throw unavailable();
  if (row.file && (row.file.status !== "ready" || row.file.trashedAt)) throw unavailable();
  // A trashed ancestor stamps everything below it, so these two cover the whole path.
  if (row.folder && (row.folder.trashedAt || row.folder.purgingAt)) throw unavailable();

  return row;
}

// Not the login error code: the web app sends UNAUTHORIZED to the sign-in page.
const wrongPassword = () => new ORPCError("FORBIDDEN", { message: "Wrong password." });

/**
 * Limited per link, not per IP: no client-supplied header or rotating address buys more guesses,
 * and SSR calls with no IP count too. The cost is that someone holding the link can lock it for 15 minutes.
 */
export async function checkPassword(
  link: typeof shareLinks.$inferSelect,
  password: string | undefined,
) {
  if (!link.passwordHash) return;
  if (password === undefined) throw wrongPassword();

  const key = `share:${link.id}`;

  await enforceRateLimit([[key, PASSWORD_ATTEMPTS]]);

  if (!(await verifyPassword(password, link.passwordHash))) throw wrongPassword();

  await clearRateLimit(key);
}

/** Walks down from the shared folder through untrashed folders only. Purging folders are always trashed. */
export async function isInSharedFolder(sharedFolderId: string, folderId: string) {
  const [row] = await db
    .select({ id: folders.id })
    .from(folders)
    .where(and(eq(folders.id, folderId), sql`${folders.id} IN ${subtree(sharedFolderId, null)}`));

  return Boolean(row);
}

/**
 * Signs a URL for one file the link reaches, or throws "unavailable". Provider errors can name the
 * bucket or endpoint, so they stay in the server log.
 */
export async function signSharedFile<T>(
  input: { token: string; password?: string; fileId: string },
  sign: (
    client: ReturnType<typeof createClient>,
    bucket: string,
    file: typeof files.$inferSelect,
  ) => Promise<T>,
) {
  const { link, folder, storage } = await findLiveLink(input.token);

  await checkPassword(link, input.password);

  const [file] = await db.select().from(files).where(eq(files.id, input.fileId));

  const allowed =
    file && (folder ? await isInSharedFolder(folder.id, file.folderId) : file.id === link.fileId);

  if (!file || !allowed) throw unavailable();

  try {
    const { client } = await connect(storage);

    await assertInBucket(client, file, storage); // also refuses trashed, pending and purging files

    return { link, file, url: await sign(client, storage.bucket, file) };
  } catch (error) {
    if (error instanceof ORPCError) throw unavailable();

    console.error(error);

    throw new ORPCError("BAD_GATEWAY", { message: "The file can't be reached right now." });
  }
}
