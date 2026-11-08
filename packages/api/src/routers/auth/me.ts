import { loadSession, publicUser } from "../../auth/session.ts";
import { pub } from "../../lib/orpc.ts";

/** Null rather than an error, because "not signed in" is an expected answer for the route guards. */
export const me = pub.handler(async ({ context }) => {
  const auth = await loadSession(context.reqHeaders);

  return auth ? publicUser(auth.user) : null;
});
