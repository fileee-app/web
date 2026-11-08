import type { S3Client } from "@aws-sdk/client-s3";
import { db, publicFiles, storages } from "@fileee/db";
import {
  checkPublicAccess,
  listPage,
  listPrefix,
  publicLocationProblem,
  withPrefix,
} from "@fileee/storage";
import { ORPCError } from "@orpc/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import * as z from "zod";
import { appOrigin } from "../../lib/http.ts";
import { runJobs } from "../../lib/jobs.ts";
import { authed, requireStorage } from "../../lib/orpc.ts";
import { retireCopies } from "../../lib/public.ts";
import { assertValidEndpoint, connect, toPublicStorage } from "../../lib/storage.ts";
import { publicAccessInput } from "../../schemas.ts";

const PROBE_KEY = /^probe-[0-9a-f-]{36}\/fileee-probe\.txt$/;

const refuse = (message: string) => new ORPCError("BAD_REQUEST", { message });

function normalizeCdn(cdnBaseUrl: string) {
  assertValidEndpoint(cdnBaseUrl);

  const url = new URL(cdnBaseUrl);

  if (url.search || url.hash) throw refuse("The CDN URL can't have a query or fragment.");

  // By hostname alone: cookies ignore the port, so another port on the app's host isn't separate enough.
  if (url.hostname === new URL(appOrigin()).hostname) {
    throw refuse(
      "The CDN must be on a different host from this app, so files can't run on its origin.",
    );
  }

  return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
}

/** Whatever is already here would become public. Copies still being deleted and leftover probes don't count. */
async function assertLocationEmpty(
  client: S3Client,
  storageId: string,
  bucket: string,
  prefix: string,
) {
  const { objects } = await listPage(client, bucket, prefix, undefined, 100);

  if (objects.length === 0) return;

  const retired = await db
    .select({ key: publicFiles.publicKey })
    .from(publicFiles)
    .where(
      and(
        eq(publicFiles.storageId, storageId),
        inArray(
          publicFiles.publicKey,
          objects.map((o) => o.key),
        ),
      ),
    );

  const known = new Set(retired.map((row) => row.key));
  const relative = (key: string) => key.slice(listPrefix(prefix).length);
  const foreign = objects.find((o) => !known.has(o.key) && !PROBE_KEY.test(relative(o.key)));

  if (foreign) {
    throw refuse(
      `The public location must be empty, because its contents become public. It already holds ${foreign.key}.`,
    );
  }
}

export const setPublicAccess = authed
  .input(publicAccessInput.extend({ storageId: z.string() }))
  .use(requireStorage)
  .handler(async ({ input, context: { storage } }) => {
    if (!input.cdnBaseUrl) {
      const [row] = await db.transaction(async (tx) => {
        await retireCopies(tx, storage.id);

        return tx
          .update(storages)
          .set({
            cdnBaseUrl: null,
            publicBucket: null,
            publicPrefix: null,
            publicCheckError: null,
            publicCheckedAt: null,
          })
          .where(eq(storages.id, storage.id))
          .returning();
      });

      void runJobs();

      return toPublicStorage(row!);
    }

    const cdnBaseUrl = normalizeCdn(input.cdnBaseUrl);

    const publicBucket =
      input.publicBucket && input.publicBucket !== storage.bucket ? input.publicBucket : null;

    const publicPrefix =
      input.publicPrefix.replace(/\/$/, "") ||
      (publicBucket ? "" : withPrefix(storage.prefix, ".fileee/public"));

    const location = { cdnBaseUrl, bucket: publicBucket ?? storage.bucket, prefix: publicPrefix };

    const problem = publicLocationProblem(storage, location);

    if (problem) throw refuse(problem);

    const { client } = await connect(storage);

    const unchanged =
      storage.cdnBaseUrl === cdnBaseUrl &&
      storage.publicBucket === publicBucket &&
      storage.publicPrefix === publicPrefix;

    if (!unchanged) {
      const [live] = await db
        .select({ id: publicFiles.id })
        .from(publicFiles)
        .where(and(eq(publicFiles.storageId, storage.id), isNull(publicFiles.unpublishedAt)))
        .limit(1);

      if (live) {
        throw new ORPCError("CONFLICT", {
          message: "Turn off public access first. That removes the files already published here.",
        });
      }

      await assertLocationEmpty(client, storage.id, location.bucket, publicPrefix);
    }

    const { error } = await checkPublicAccess(client, storage, location);

    if (error) {
      // A setting already in use stays, but blocked. A new one is simply refused.
      if (unchanged) {
        await db
          .update(storages)
          .set({ publicCheckError: error, publicCheckedAt: new Date() })
          .where(eq(storages.id, storage.id));
      }

      throw refuse(error);
    }

    const [row] = await db
      .update(storages)
      .set({
        cdnBaseUrl,
        publicBucket,
        publicPrefix,
        publicCheckError: null,
        publicCheckedAt: new Date(),
      })
      .where(eq(storages.id, storage.id))
      .returning();

    return toPublicStorage(row!);
  });
