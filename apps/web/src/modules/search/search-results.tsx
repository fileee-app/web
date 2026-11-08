import { Button } from "@fileee/ui/components/button";
import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DetailsSheet } from "../../components/browser/details-sheet/details-sheet.tsx";
import { PreviewDialog } from "../../components/browser/preview-dialog/preview-dialog.tsx";
import { useItemActions } from "../../lib/item-actions.ts";
import { NoResults } from "./no-results.tsx";
import { ResultsTable } from "./results-table.tsx";
import { type Search, searchOptions } from "./search-params.ts";

export function Results({ search }: { search: Search }) {
  const results = useSuspenseInfiniteQuery(searchOptions(search));
  const itemActions = useItemActions();
  // IDs rather than rows, so the panels follow the results after a refetch.
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const items = results.data.pages.flatMap((page) => page.items);
  const byId = (id: string | null) => items.find((item) => item.id === id) ?? null;
  const download = (id: string) => itemActions.download.mutate(id);

  if (items.length === 0) return <NoResults />;

  return (
    <>
      <ResultsTable items={items} onPreview={setPreviewing} />

      {results.hasNextPage && (
        <Button
          variant="outline"
          className="self-center"
          disabled={results.isFetchingNextPage}
          onClick={() => void results.fetchNextPage()}
        >
          {results.isFetchingNextPage ? "Loading…" : "Load more"}
        </Button>
      )}

      <PreviewDialog
        file={byId(previewing)}
        onClose={() => setPreviewing(null)}
        onDownload={download}
        onDetails={(id) => {
          setPreviewing(null);
          setDetailsId(id);
        }}
      />

      <DetailsSheet
        file={byId(detailsId)}
        onClose={() => setDetailsId(null)}
        onDownload={download}
        onPreview={(id) => {
          setDetailsId(null);
          setPreviewing(id);
        }}
      />
    </>
  );
}
