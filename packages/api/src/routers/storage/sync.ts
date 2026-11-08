import * as z from "zod";
import { authed, requireStorage } from "../../lib/orpc.ts";
import { runJobs } from "../../lib/jobs.ts";
import { startSync } from "../../lib/sync.ts";

export const sync = authed
  .input(z.object({ storageId: z.string() }))
  .use(requireStorage)
  .handler(async ({ context: { storage } }) => {
    const run = await startSync(storage.id, "manual", () => void runJobs());

    return { id: run.id, status: run.status };
  });
