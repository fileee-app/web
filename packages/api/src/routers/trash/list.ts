import { authed } from "../../lib/orpc.ts";
import { trashItems } from "./items.ts";

export const list = authed.handler(({ context }) => trashItems(context.user.id));
