import { router } from "@fileee/api";
import { startBackground } from "@fileee/api/background";
import { clientIp } from "@fileee/api/http";
import { ORPCError, onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import {
  RequestHeadersHandlerPlugin,
  RequestLimitHandlerPlugin,
  ResponseHeadersHandlerPlugin,
} from "@orpc/server/plugins";
import { getRequestIP } from "@tanstack/react-start/server";

const EXPECTED = new Set<string>([
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "BAD_REQUEST",
  "PRECONDITION_FAILED",
  "TOO_MANY_REQUESTS",
]);

const handler = new RPCHandler(router, {
  plugins: [
    new RequestHeadersHandlerPlugin(),
    new ResponseHeadersHandlerPlugin(),
    // File bytes never pass through here, so real calls are small. Runs before anyone is signed in.
    new RequestLimitHandlerPlugin({ maxBodySize: 1024 * 1024 }),
  ],
  interceptors: [
    // A signed-out visitor or a wrong password is normal traffic, not a server problem.
    onError((error) => {
      if (!(error instanceof ORPCError && EXPECTED.has(error.code))) console.error(error);
    }),
  ],
});

/** Server-only: the browser API (`/api/rpc`) and the app API (`/api/app`) share one router. */
export async function handleRpc(request: Request, prefix: "/api/rpc" | "/api/app") {
  if (import.meta.env.DEV) startBackground(); // production starts it in start.ts

  const tokenAuth = prefix === "/api/app";
  const reqHeaders = new Headers(request.headers);

  // The app API ignores cookies, so a page on another site can't ride a browser session there.
  if (tokenAuth) reqHeaders.delete("cookie");

  const { response } = await handler.handle(request, {
    prefix,
    context: { clientIp: clientIp(request.headers, getRequestIP()), tokenAuth, reqHeaders },
  });

  return response ?? new Response("Not found", { status: 404 });
}
