import { Button } from "@fileee/ui/components/button";
import { useSuspenseQuery, useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { PageHeader } from "../../components/page-header.tsx";
import { SyncNowButton } from "../../components/sync-status.tsx";
import { orpc } from "../../lib/orpc.ts";
import { useSyncStatus } from "../../lib/sync-status.ts";
import { MissingBreadcrumb } from "./missing-breadcrumb.tsx";
import { MissingTable } from "./missing-table.tsx";
import { NothingMissing } from "./nothing-missing.tsx";
import { missingOptions } from "./queries.ts";

const route = getRouteApi("/_app/s/$storageId/missing");

export function MissingPage() {
  const { storageId } = route.useParams();
  const { data: storages } = useSuspenseQuery(orpc.storage.list.queryOptions());
  const files = useSuspenseInfiniteQuery(missingOptions(storageId));

  useSyncStatus(storageId);

  const storage = storages.find((s) => s.id === storageId);
  const rows = files.data.pages.flatMap((page) => page.items);

  return (
    <>
      <PageHeader actions={<SyncNowButton storageId={storageId} />}>
        <MissingBreadcrumb storageId={storageId} storageName={storage?.name} />
      </PageHeader>

      {rows.length === 0 ? (
        <NothingMissing />
      ) : (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 md:p-6">
          <p className="text-sm text-muted-foreground">
            These objects weren't in the bucket at the last sync. They may have been moved, renamed
            or deleted outside fileee. Their names, stars and folders are kept, and a file that
            comes back at the same key is restored by the next sync.
          </p>

          <MissingTable rows={rows} storageId={storageId} />

          {files.hasNextPage && (
            <Button
              variant="outline"
              className="self-center"
              disabled={files.isFetchingNextPage}
              onClick={() => void files.fetchNextPage()}
            >
              {files.isFetchingNextPage ? "Loading…" : "Load more"}
            </Button>
          )}
        </div>
      )}
    </>
  );
}
