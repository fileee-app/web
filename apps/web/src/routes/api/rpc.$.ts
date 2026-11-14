import { isAllowedOrigin } from "@fileee/api/http";
import { createFileRoute } from "@tanstack/react-router";
import { handleRpc } from "../../lib/rpc-handler.ts";

export const Route = createFileRoute("/api/rpc/$")({
  server: {
    handlers: {
      ANY: async ({ request }) => {
        // RPCHandler only accepts state-changing methods, so this covers every call.
        if (!isAllowedOrigin(request.headers)) return new Response("Forbidden", { status: 403 });

        return handleRpc(request, "/api/rpc");
      },
    },
  },
});
