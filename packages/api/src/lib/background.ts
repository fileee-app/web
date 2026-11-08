import { cleanupExpiredRows, cleanupExpiredUploads, retireStuckCopies } from "./cleanup.ts";
import { runJobs } from "./jobs.ts";
import { scheduleSyncs } from "./sync.ts";

const housekeeping = () =>
  Promise.all([
    cleanupExpiredUploads(),
    cleanupExpiredRows(),
    retireStuckCopies(),
    scheduleSyncs(),
  ]).catch((error) => console.error("Housekeeping failed", error));

const state = globalThis as { fileeeBackground?: true };

/** Once per process, surviving dev-server reloads. */
export function startBackground() {
  if (state.fileeeBackground) return;

  state.fileeeBackground = true;
  void runJobs();
  void housekeeping();
  setInterval(() => void runJobs(), 60 * 1000).unref();
  setInterval(() => void housekeeping(), 15 * 60 * 1000).unref();
}
