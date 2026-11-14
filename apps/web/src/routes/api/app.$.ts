import { createFileRoute } from "@tanstack/react-router";
import { handleRpc } from "../../lib/rpc-handler.ts";

// The desktop and mobile apps' API: the same procedures as /api/rpc, signed in with a bearer token.
// No Origin check: cookies are ignored here, and browsers can't send the header cross-site without a preflight we never answer.
export const Route = createFileRoute("/api/app/$")({
  server: { handlers: { ANY: ({ request }) => handleRpc(request, "/api/app") } },
});
