import { db, files } from "@fileee/db";
import { and, count, eq, isNull } from "drizzle-orm";
import * as z from "zod";
import { authed, requireStorage } from "../../lib/orpc.ts";
import { latestRun } from "../../lib/sync.ts";

export const syncStatus = authed
  .input(z.object({ storageId: z.string() }))
  .use(requireStorage)
  .handler(async ({ context: { storage } }) => {
    const [run, missing] = await Promise.all([
      latestRun(storage.id),
      db
        .select({ n: count() })
        .from(files)
        .where(
          and(
            eq(files.storageId, storage.id),
            eq(files.status, "missing"),
            isNull(files.trashedAt),
          ),
        ),
    ]);

    if (!run) return { run: null, missing: missing[0]!.n };

    const { continuationToken: _, ...publicRun } = run;

    return { run: publicRun, missing: missing[0]!.n };
  });
