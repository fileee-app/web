import { createFileRoute } from "@tanstack/react-router";
import { pageTitle } from "../../lib/title.ts";
import { SearchPage } from "../../modules/search/search-page.tsx";
import { parseSearch, isEmpty, searchOptions } from "../../modules/search/search-params.ts";

export const Route = createFileRoute("/_app/search")({
  validateSearch: parseSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ context: { queryClient }, deps }) => {
    if (!isEmpty(deps)) await queryClient.ensureInfiniteQueryData(searchOptions(deps));
  },
  head: ({ matches }) => pageTitle("Search", matches),
  component: SearchPage,
});
