import { applyCors } from "./apply-cors.ts";
import { backfillCandidates } from "./backfill-candidates.ts";
import { corsInfo } from "./cors-info.ts";
import { create } from "./create.ts";
import { list } from "./list.ts";
import { remove } from "./remove.ts";
import { publicSummary } from "./public-summary.ts";
import { setPublicAccess } from "./set-public-access.ts";
import { sync } from "./sync.ts";
import { syncStatus } from "./sync-status.ts";
import { test } from "./test.ts";
import { update } from "./update.ts";

export const storageRouter = {
  list,
  create,
  update,
  remove,
  test,
  corsInfo,
  applyCors,
  sync,
  syncStatus,
  backfillCandidates,
  setPublicAccess,
  publicSummary,
};
