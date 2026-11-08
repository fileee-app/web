import { db, files, folders } from "@fileee/db";
import { and, asc, eq, isNull } from "drizzle-orm";
import * as z from "zod";
import { previewOf } from "../../lib/mime.ts";
import { pub } from "../../lib/orpc.ts";
import {
  checkPassword,
  findLiveLink,
  isInSharedFolder,
  passwordAttempt,
  tokenSchema,
  unavailable,
} from "../../lib/shares.ts";

// shortcut: a shared folder shows its first 500 folders and files, paginate if people hit the note on the page.
const LISTING_LIMIT = 500;

/**
 * Public. Never returns object keys, buckets or anything about the storage, and no names until the password passes.
 * A folder link browses its own subtree, one level per call.
 */
export const resolve = pub
  .input(
    z.object({
      token: tokenSchema,
      password: passwordAttempt,
      folderId: z.string().max(64).optional(),
    }),
  )
  .handler(async ({ input }) => {
    const { link, file, folder } = await findLiveLink(input.token);

    if (link.passwordHash && input.password === undefined) {
      return { needsPassword: true as const };
    }

    await checkPassword(link, input.password);

    if (file) {
      const { id, name, size, mimeType } = file;

      return {
        needsPassword: false as const,
        kind: "file" as const,
        file: { id, name, size, mimeType, preview: previewOf(name).kind },
      };
    }

    const folderId = input.folderId ?? folder!.id;

    if (!(await isInSharedFolder(folder!.id, folderId))) throw unavailable();

    const [subfolders, fileRows] = await Promise.all([
      db
        .select({ id: folders.id, name: folders.name })
        .from(folders)
        .where(and(eq(folders.parentId, folderId), isNull(folders.trashedAt)))
        .orderBy(asc(folders.name))
        .limit(LISTING_LIMIT + 1),
      db
        .select({ id: files.id, name: files.name, size: files.size, mimeType: files.mimeType })
        .from(files)
        .where(
          and(eq(files.folderId, folderId), isNull(files.trashedAt), eq(files.status, "ready")),
        )
        .orderBy(asc(files.name))
        .limit(LISTING_LIMIT + 1),
    ]);

    return {
      needsPassword: false as const,
      kind: "folder" as const,
      name: folder!.name,
      folders: subfolders.slice(0, LISTING_LIMIT),
      files: fileRows
        .slice(0, LISTING_LIMIT)
        .map((row) => ({ ...row, preview: previewOf(row.name).kind })),
      truncated: subfolders.length > LISTING_LIMIT || fileRows.length > LISTING_LIMIT,
    };
  });
