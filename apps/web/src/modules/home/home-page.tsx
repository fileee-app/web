import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { PageHeader } from "../../components/page-header.tsx";
import { orpc } from "../../lib/orpc.ts";
import { FileTable } from "./file-table.tsx";
import { NoStorages } from "./no-storages.tsx";
import { StorageGrid } from "./storage-grid.tsx";

const route = getRouteApi("/_app/");

export function HomePage() {
  const { data: storages } = useSuspenseQuery(orpc.storage.list.queryOptions());
  const { data: recent } = useSuspenseQuery(orpc.file.recent.queryOptions());
  const { data: starred } = useSuspenseQuery(orpc.file.starred.queryOptions());
  const { user } = route.useRouteContext();

  return (
    <>
      <PageHeader>Home</PageHeader>

      {storages.length === 0 ? (
        <NoStorages />
      ) : (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-6">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              Welcome back, {user.name.trim().split(/\s+/)[0]}
            </h1>

            <p className="text-sm text-muted-foreground">
              Your files across {storages.length} {storages.length === 1 ? "storage" : "storages"}.
            </p>
          </div>

          <StorageGrid storages={storages} />

          {starred.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-medium text-muted-foreground">Starred</h2>
              <FileTable files={starred} />
            </section>
          )}

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">Recent files</h2>

            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">Files you upload will show up here.</p>
            ) : (
              <FileTable files={recent} />
            )}
          </section>
        </div>
      )}
    </>
  );
}
