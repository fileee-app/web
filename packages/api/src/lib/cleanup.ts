import { db, files, loginAttempts, publicFiles, sessions, storages, uploads } from "@fileee/db";
import { abortMultipart, headObject } from "@fileee/storage";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import { runJobs } from "./jobs.ts";
import { retireCopies } from "./public.ts";
import { connect } from "./storage.ts";
import { markReady } from "./uploads.ts";

const removePending = (fileId: string) => db.delete(files).where(eq(files.id, fileId));

/** Finishes or removes abandoned uploads. A failure leaves the row, so the next run retries it. */
export async function cleanupExpiredUploads(now = new Date()) {
  const expired = await db
    .select({ upload: uploads, file: files, storage: storages })
    .from(uploads)
    .innerJoin(files, eq(uploads.fileId, files.id))
    .innerJoin(storages, eq(files.storageId, storages.id))
    .where(lt(uploads.expiresAt, now));

  for (const { upload, file, storage } of expired) {
    try {
      const { client } = await connect(storage);

      if (upload.s3UploadId) {
        await abortMultipart(client, storage.bucket, file.objectKey, upload.s3UploadId).catch(
          (error) => {
            // Already aborted or completed by the provider's own lifecycle rules.
            if (error?.name !== "NoSuchUpload") throw error;
          },
        );

        await removePending(file.id);
      } else {
        const head = await headObject(client, storage.bucket, file.objectKey);

        // The bytes arrived and only the browser's `complete` call was lost.
        if (head) await markReady(file, head);
        else await removePending(file.id);
      }
    } catch (error) {
      console.error(`Upload cleanup failed for file ${file.id}`, error);
    }
  }
}

/** A restart during publishing leaves a copy nobody has the link to, which may exist and is billed. */
export async function retireStuckCopies(now = new Date()) {
  const stuck = await db
    .select({ id: publicFiles.id, storageId: publicFiles.storageId })
    .from(publicFiles)
    .where(
      and(
        isNull(publicFiles.copiedAt),
        isNull(publicFiles.unpublishedAt),
        lt(publicFiles.createdAt, new Date(now.getTime() - 86_400_000)),
      ),
    );

  if (stuck.length === 0) return;

  await db.transaction(async (tx) => {
    for (const { id, storageId } of stuck)
      await retireCopies(tx, storageId, eq(publicFiles.id, id));
  });

  void runJobs();
}

export async function cleanupExpiredRows(now = new Date()) {
  await db
    .delete(sessions)
    .where(or(lt(sessions.expiresAt, now), lt(sessions.absoluteExpiresAt, now)));

  await db
    .delete(loginAttempts)
    .where(lt(loginAttempts.windowStartedAt, new Date(now.getTime() - 86_400_000)));
}
