import { create } from "./create.ts";
import { ensurePath } from "./ensure-path.ts";
import { get } from "./get.ts";
import { move } from "./move.ts";
import { purge } from "./purge.ts";
import { rename } from "./rename.ts";
import { restore } from "./restore.ts";
import { trash } from "./trash.ts";

export const folderRouter = { get, create, ensurePath, rename, move, trash, restore, purge };
