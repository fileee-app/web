import { getRouteApi } from "@tanstack/react-router";
import { PageHeader } from "../../components/page-header.tsx";
import { SearchBox } from "./search-box.tsx";
import { SearchFilters } from "./search-filters.tsx";
import { type Search, isEmpty } from "./search-params.ts";
import { SearchPrompt } from "./search-prompt.tsx";
import { Results } from "./search-results.tsx";

const route = getRouteApi("/_app/search");

export function SearchPage() {
  const search = route.useSearch();
  const navigate = route.useNavigate();

  const update = (change: Partial<Search>) =>
    navigate({ search: (previous) => ({ ...previous, ...change }), replace: true });

  return (
    <>
      <PageHeader>Search</PageHeader>

      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <SearchBox q={search.q ?? ""} onChange={(q) => update({ q: q || undefined })} />
        <SearchFilters search={search} update={update} />

        {isEmpty(search) ? <SearchPrompt /> : <Results search={search} />}
      </div>
    </>
  );
}
