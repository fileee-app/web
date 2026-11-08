import { ORPCError } from "@orpc/client";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { pageTitle } from "../lib/title.ts";
import { resolveOptions } from "../modules/share/queries.ts";
import { SharePage } from "../modules/share/share-page.tsx";
import { Unavailable } from "../modules/share/unavailable.tsx";

export const Route = createFileRoute("/share/$token")({
  // The URL holds the secret: keep it out of Referer headers, including the one the bucket would see, and out of caches.
  headers: () => ({
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex",
  }),
  loader: ({ context: { queryClient }, params }) =>
    queryClient.ensureQueryData(resolveOptions(params.token)).catch((error: unknown) => {
      if (error instanceof ORPCError && error.code === "NOT_FOUND") throw notFound();

      throw error;
    }),
  head: ({ matches }) => ({
    meta: [
      ...pageTitle("Shared file", matches).meta,
      { name: "referrer", content: "no-referrer" },
      { name: "robots", content: "noindex" },
    ],
  }),
  notFoundComponent: Unavailable,
  component: SharePage,
});
