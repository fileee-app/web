import { db, files, storages } from "@fileee/db";
import { headObject, signView, withPrefix, type createClient } from "@fileee/storage";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { connect } from "./storage.ts";

type File = typeof files.$inferSelect;
type Storage = typeof storages.$inferSelect;

const MISSING_MESSAGE =
  "This file is no longer in the bucket. It may have been moved, renamed or deleted outside fileee.";

const SIGNING_WINDOW = 5 * 60 * 1000;

export async function assertInBucket(
  client: ReturnType<typeof createClient>,
  file: File,
  storage: Storage,
) {
  if (file.status === "missing") throw new ORPCError("CONFLICT", { message: MISSING_MESSAGE });

  if (file.status !== "ready" || file.trashedAt) {
    throw new ORPCError("CONFLICT", { message: "This file isn't available." });
  }

  // If they disagree about existence, S3 wins: the object was removed outside fileee.
  const head = await headObject(client, storage.bucket, file.objectKey);

  if (!head) {
    await db.update(files).set({ status: "missing" }).where(eq(files.id, file.id));

    throw new ORPCError("CONFLICT", { message: MISSING_MESSAGE });
  }

  return head;
}

export const thumbnailKeyOf = (storage: Storage, fileId: string) =>
  withPrefix(storage.prefix, `.fileee/thumbs/${fileId}.webp`);

/**
 * Signing is local, so a whole page costs no requests. The date is held to a window so a refetched
 * list keeps the same URLs and the browser's cache keeps working; every URL has 10+ minutes left.
 */
export async function withThumbnailUrls<T extends File>(storage: Storage, rows: T[]) {
  if (!rows.some((row) => row.thumbnailKey)) {
    return rows.map((row) => ({ ...row, thumbnailUrl: null as string | null }));
  }

  const { client } = await connect(storage);
  const now = Date.now();
  const signingDate = new Date(now - (now % SIGNING_WINDOW));

  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      thumbnailUrl: row.thumbnailKey
        ? await signView(
            client,
            storage.bucket,
            row.thumbnailKey,
            "thumbnail.webp",
            "image/webp",
            signingDate,
          )
        : null,
    })),
  );
}
