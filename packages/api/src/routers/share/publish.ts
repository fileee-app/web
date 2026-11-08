import { randomBytes } from "node:crypto";
import { db, files, publicFiles, storages } from "@fileee/db";
import { attachmentDisposition, copyObject, safeFileName, withPrefix } from "@fileee/storage";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull } from "drizzle-orm";
import * as z from "zod";
import { runJobs } from "../../lib/jobs.ts";
import { publicHeadersOf } from "../../lib/mime.ts";
import { authed, requireFile } from "../../lib/orpc.ts";
import { assertInBucket } from "../../lib/previews.ts";
import { connectionOf, enqueueDeletion, retireCopies } from "../../lib/public.ts";
import { connect } from "../../lib/storage.ts";

// Removal lags behind the CDN's cache, and a CDN that honours this keeps that lag short.
const CACHE_CONTROL = "public, max-age=3600";

/** Always a new token, so an old URL never comes back. Publishing again retires the current copy. */
export const publish = authed
  .input(z.object({ fileId: z.string() }))
  .use(requireFile)
  .handler(async ({ context: { file, storage } }) => {
    const { client } = await connect(storage);
    const head = await assertInBucket(client, file, storage);

    const token = randomBytes(24).toString("base64url");
    const name = safeFileName(file.name);

    // The row comes first: a copy without one would stay public with nothing knowing about it.
    const row = await db.transaction(async (tx) => {
      const [current] = await tx
        .select({
          cdnBaseUrl: storages.cdnBaseUrl,
          publicBucket: storages.publicBucket,
          publicPrefix: storages.publicPrefix,
          error: storages.publicCheckError,
        })
        .from(files)
        .innerJoin(storages, eq(files.storageId, storages.id))
        .where(and(eq(files.id, file.id), eq(files.status, "ready"), isNull(files.trashedAt)));

      if (!current) throw new ORPCError("CONFLICT", { message: "This file isn't available." });

      if (!current.cdnBaseUrl) {
        throw new ORPCError("CONFLICT", {
          message: "Public access isn't set up for this storage.",
        });
      }

      if (current.error) {
        throw new ORPCError("CONFLICT", {
          message: `Publishing is blocked because the CDN safety check is failing. ${current.error}`,
        });
      }

      await retireCopies(tx, storage.id, eq(publicFiles.fileId, file.id));

      const [created] = await tx
        .insert(publicFiles)
        .values({
          userId: storage.userId,
          storageId: storage.id,
          fileId: file.id,
          bucket: current.publicBucket ?? storage.bucket,
          publicKey: withPrefix(current.publicPrefix ?? "", `${token}/${name}`),
          url: `${current.cdnBaseUrl}/${token}/${encodeURIComponent(name)}`,
          sourceEtag: head.etag,
        })
        .returning();

      return created!;
    });

    void runJobs();

    const { contentType, inline } = publicHeadersOf(file.name);

    try {
      await copyObject(
        client,
        { Bucket: storage.bucket, Key: file.objectKey },
        {
          Bucket: row.bucket,
          Key: row.publicKey,
          ContentType: contentType,
          ContentDisposition: inline ? undefined : attachmentDisposition(file.name),
          CacheControl: CACHE_CONTROL,
        },
        head.size,
      );
    } catch (error) {
      await db.transaction((tx) => retireCopies(tx, storage.id, eq(publicFiles.id, row.id)));
      void runJobs();

      throw error;
    }

    const [live] = await db
      .update(publicFiles)
      .set({ copiedAt: new Date() })
      .where(and(eq(publicFiles.id, row.id), isNull(publicFiles.unpublishedAt)))
      .returning({ id: publicFiles.id });

    if (!live) {
      // Trashed or removed during the copy. Its row may already be gone, so put back what the job needs.
      await db.transaction(async (tx) => {
        await tx
          .insert(publicFiles)
          .values({
            ...row,
            fileId: null,
            unpublishedAt: new Date(),
            retiredConnection: connectionOf(storage),
          })
          .onConflictDoUpdate({
            target: publicFiles.id,
            set: { retiredConnection: connectionOf(storage) },
          });

        await enqueueDeletion(tx, storage.id);
      });

      void runJobs();

      throw new ORPCError("CONFLICT", {
        message: "This file was removed while it was publishing.",
      });
    }

    return { url: row.url };
  });
