import { abort } from "./abort.ts";
import { complete } from "./complete.ts";
import { listPending } from "./list-pending.ts";
import { resume } from "./resume.ts";
import { signParts } from "./sign-parts.ts";
import { start } from "./start.ts";

export const uploadRouter = { start, signParts, resume, complete, abort, listPending };
