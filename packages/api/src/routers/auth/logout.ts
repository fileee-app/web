import { endSession } from "../../auth/session.ts";
import { authed } from "../../lib/orpc.ts";

export const logout = authed.handler(async ({ context }) => {
  await endSession(context.session.id, context.resHeaders);

  return { ok: true };
});
