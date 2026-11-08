import { db, files, uploads } from "@fileee/db";
import { and, eq } from "drizzle-orm";
import { authed } from "../../lib/orpc.ts";

export const listPending = authed.handler(({ context }) =>
  db
    .select({
      fileId: files.id,
      name: files.name,
      size: files.size,
      storageId: files.storageId,
      folderId: files.folderId,
      createdAt: files.createdAt,
    })
    .from(files)
    .innerJoin(uploads, eq(uploads.fileId, files.id))
    .where(and(eq(files.uploaderId, context.user.id), eq(files.status, "pending"))),
);
