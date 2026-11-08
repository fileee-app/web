import { create } from "./create.ts";
import { download } from "./download.ts";
import { list } from "./list.ts";
import { preview } from "./preview.ts";
import { publicStatus } from "./public-status.ts";
import { publish } from "./publish.ts";
import { removalFailures } from "./removal-failures.ts";
import { resolve } from "./resolve.ts";
import { revoke } from "./revoke.ts";
import { unpublish } from "./unpublish.ts";

export const shareRouter = {
  create,
  list,
  revoke,
  resolve,
  download,
  preview,
  publish,
  unpublish,
  publicStatus,
  removalFailures,
};
