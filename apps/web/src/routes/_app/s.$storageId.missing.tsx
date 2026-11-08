import { createFileRoute } from "@tanstack/react-router";
import { pageTitle } from "../../lib/title.ts";
import { MissingPage } from "../../modules/missing/missing-page.tsx";
import { missingOptions } from "../../modules/missing/queries.ts";

export const Route = createFileRoute("/_app/s/$storageId/missing")({
  loader: ({ context, params }) =>
    context.queryClient.ensureInfiniteQueryData(missingOptions(params.storageId)),
  head: ({ matches }) => pageTitle("Missing files", matches),
  component: MissingPage,
});
