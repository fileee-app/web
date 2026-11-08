import type { Router } from "@fileee/api";
import { router } from "@fileee/api";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import { createRouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

// On the server this calls procedures in-process (no HTTP) during SSR, with the visitor's cookies; the server branch is stripped from the client bundle.
const getClient = createIsomorphicFn()
  .server(() =>
    createRouterClient(router, {
      context: () => ({ reqHeaders: new Headers(getRequestHeaders()) }),
    }),
  )
  .client((): RouterClient<Router> => createORPCClient(new RPCLink({ url: "/api/rpc" })));

export const client: RouterClient<Router> = getClient();
export const orpc = createTanstackQueryUtils(client);
