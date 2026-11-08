import { ORPCError } from "@orpc/client";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { toast } from "sonner";
import { ErrorPage, NotFoundPage } from "./components/status-pages";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  // One per response, set on the CSP in __root.tsx. Dev has none, because Vite injects its own inline scripts.
  const nonce = import.meta.env.SSR && import.meta.env.PROD ? crypto.randomUUID() : undefined;

  const onError = (error: unknown) => {
    if (error instanceof ORPCError && error.code === "UNAUTHORIZED") {
      queryClient.clear();

      if (router.state.location.pathname !== "/login") void router.navigate({ to: "/login" });
    }
  };

  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({
      onError: (error) => {
        onError(error);
        toast.error(error.message);
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Only network failures are worth retrying; the API's own answers won't change by asking again.
        retry: (count, error) => !(error instanceof ORPCError) && count < 2,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient, nonce },
    ssr: { nonce },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultErrorComponent: ErrorPage,
    defaultNotFoundComponent: NotFoundPage,
  });

  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
