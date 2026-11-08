import { router } from "@fileee/api";
import { startBackground } from "@fileee/api/background";
import { clientIp, isAllowedOrigin } from "@fileee/api/http";
import { ORPCError, onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import {
  RequestHeadersHandlerPlugin,
  RequestLimitHandlerPlugin,
  ResponseHeadersHandlerPlugin,
} from "@orpc/server/plugins";
import { createFileRoute } from "@tanstack/react-router";
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

export const Route = createFileRoute("/api/rpc/$")({
  server: {
    handlers: {
      ANY: async ({ request }) => {
        if (import.meta.env.DEV) startBackground(); // production starts it in start.ts
        // RPCHandler only accepts state-changing methods, so this covers every call.
        if (!isAllowedOrigin(request.headers)) return new Response("Forbidden", { status: 403 });

        const { response } = await handler.handle(request, {
          prefix: "/api/rpc",
          context: { clientIp: clientIp(request.headers, getRequestIP()) },
        });

        return response ?? new Response("Not found", { status: 404 });
      },
    },
  },
});
