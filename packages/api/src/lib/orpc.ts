import { appSettings, db, files, folders, shareLinks, storages } from "@fileee/db";
import { ORPCError, os } from "@orpc/server";
import type {
  RequestHeadersHandlerPluginContext,
  ResponseHeadersHandlerPluginContext,
} from "@orpc/server/plugins";
import { and, eq, isNull, ne } from "drizzle-orm";
import { loadSession } from "../auth/session.ts";
import { isInvalidText } from "./db-errors.ts";

export interface Context
  extends RequestHeadersHandlerPluginContext, ResponseHeadersHandlerPluginContext {
  clientIp?: string;
}

/** Only `setup.*` uses this directly. */
export const base = os.$context<Context>().use(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (isInvalidText(error)) {
      throw new ORPCError("BAD_REQUEST", { message: "That text contains an invalid character." });
    }

    throw error;
  }
});

export const isSetupComplete = async () =>
  (await db.select({ id: appSettings.id }).from(appSettings).limit(1)).length > 0;

export const pub = base.use(async ({ next }) => {
  if (!(await isSetupComplete())) {
    throw new ORPCError("PRECONDITION_FAILED", { message: "Setup is not complete." });
  }

  return next();
});

export const authed = pub.use(async ({ context, next }) => {
  const auth = await loadSession(context.reqHeaders);

  if (!auth) throw new ORPCError("UNAUTHORIZED", { message: "Sign in to continue." });

  return next({ context: { user: auth.user, session: auth.session } });
});

export const admin = authed.use(({ context, next }) => {
  if (context.user.role !== "admin") throw new ORPCError("FORBIDDEN", { message: "Admins only." });

  return next();
});

/** Provider failures surface as a readable error; nothing here can contain credentials. */
const fromProvider = (error: unknown) => {
  const e = error as { $metadata?: unknown; name?: string; message?: string };

  if (!e.$metadata) return error;

  return new ORPCError("BAD_GATEWAY", {
    message: `The storage provider returned an error: ${e.name}: ${e.message}`,
  });
};

/** Ownership checks live here so no handler can forget one. A foreign ID looks the same as a missing one. */
export const requireStorage = authed.middleware(
  async ({ context, next }, input: { storageId: string }) => {
    const [storage] = await db
      .select()
      .from(storages)
      .where(and(eq(storages.id, input.storageId), eq(storages.userId, context.user.id)));

    if (!storage) throw new ORPCError("NOT_FOUND", { message: "Storage not found." });

    try {
      return await next({ context: { storage } });
    } catch (error) {
      throw fromProvider(error);
    }
  },
);

const ownedFile = async (userId: string, fileId: string) =>
  (
    await db
      .select({ file: files, storage: storages })
      .from(files)
      .innerJoin(storages, eq(files.storageId, storages.id))
      .where(and(eq(files.id, fileId), eq(storages.userId, userId), ne(files.status, "purging")))
  )[0];

const ownedFolder = async (userId: string, folderId: string) =>
  (
    await db
      .select({ folder: folders, storage: storages })
      .from(folders)
      .innerJoin(storages, eq(folders.storageId, storages.id))
      .where(and(eq(folders.id, folderId), eq(storages.userId, userId), isNull(folders.purgingAt)))
  )[0];

export const requireFile = authed.middleware(
  async ({ context, next }, input: { fileId: string }) => {
    const row = await ownedFile(context.user.id, input.fileId);

    if (!row) throw new ORPCError("NOT_FOUND", { message: "File not found." });

    try {
      return await next({ context: { file: row.file, storage: row.storage } });
    } catch (error) {
      throw fromProvider(error);
    }
  },
);

/** Finds trashed folders too, for restore and purge. Handlers that must not touch trash check `trashedAt`. */
export const requireFolder = authed.middleware(
  async ({ context, next }, input: { folderId: string }) => {
    const row = await ownedFolder(context.user.id, input.folderId);

    if (!row) throw new ORPCError("NOT_FOUND", { message: "Folder not found." });

    return next({ context: { folder: row.folder, storage: row.storage } });
  },
);

/** A file or folder to share. A folder is only used when there's no file ID. */
export const requireShareTarget = authed.middleware(
  async ({ context, next }, input: { fileId?: string; folderId?: string }) => {
    const file = input.fileId ? await ownedFile(context.user.id, input.fileId) : undefined;

    const folder =
      !input.fileId && input.folderId
        ? await ownedFolder(context.user.id, input.folderId)
        : undefined;

    if (!file && !folder) throw new ORPCError("NOT_FOUND", { message: "Item not found." });

    return next({ context: { targetFile: file?.file, targetFolder: folder?.folder } });
  },
);

export const requireShareLink = authed.middleware(
  async ({ context, next }, input: { linkId: string }) => {
    const [link] = await db.select().from(shareLinks).where(eq(shareLinks.id, input.linkId));

    const owner =
      link &&
      (link.fileId
        ? await ownedFile(context.user.id, link.fileId)
        : await ownedFolder(context.user.id, link.folderId!));

    if (!owner) throw new ORPCError("NOT_FOUND", { message: "Link not found." });

    return next({ context: { link: link! } });
  },
);
