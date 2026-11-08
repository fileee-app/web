import { downloadUrl } from "./download-url.ts";
import { get } from "./get.ts";
import { list } from "./list.ts";
import { listMissing } from "./list-missing.ts";
import { move } from "./move.ts";
import { purge } from "./purge.ts";
import { previewUrl } from "./preview-url.ts";
import { recent } from "./recent.ts";
import { rename } from "./rename.ts";
import { restore } from "./restore.ts";
import { saveExtracted } from "./save-extracted.ts";
import { signThumbnail } from "./sign-thumbnail.ts";
import { star } from "./star.ts";
import { starred } from "./starred.ts";
import { trash } from "./trash.ts";

export const fileRouter = {
  list,
  listMissing,
  recent,
  starred,
  get,
  downloadUrl,
  previewUrl,
  signThumbnail,
  saveExtracted,
  rename,
  move,
  star,
  trash,
  restore,
  purge,
};
