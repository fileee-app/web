import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@fileee/ui/components/breadcrumb";
import { Link } from "@tanstack/react-router";
import { Fragment } from "react";
import { client } from "../../lib/orpc.ts";
import { type DropProps } from "./use-item-drag.ts";

export function FolderBreadcrumb({
  storageId,
  storageName,
  data,
  dropProps,
}: {
  storageId: string;
  storageName: string | undefined;
  data: Awaited<ReturnType<typeof client.folder.get>>;
  dropProps: DropProps;
}) {
  return (
    <Breadcrumb>
      <BreadcrumbList className="flex-nowrap">
        <BreadcrumbItem>
          {data.path.length ? (
            <BreadcrumbLink
              className="rounded-sm data-[drop=true]:ring-2 data-[drop=true]:ring-primary"
              {...dropProps(data.path[0]?.parentId ?? data.folder.id)}
              render={<Link to="/s/$storageId/$" params={{ storageId, _splat: "" }} />}
            >
              {storageName}
            </BreadcrumbLink>
          ) : (
            <BreadcrumbPage>{storageName}</BreadcrumbPage>
          )}
        </BreadcrumbItem>

        {data.path.map((folder, i) => (
          <Fragment key={folder.id}>
            <BreadcrumbSeparator />

            <BreadcrumbItem className="min-w-0">
              {i === data.path.length - 1 ? (
                <BreadcrumbPage className="truncate">{folder.name}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink
                  className="truncate rounded-sm data-[drop=true]:ring-2 data-[drop=true]:ring-primary"
                  {...dropProps(folder.id)}
                  render={<Link to="/s/$storageId/$" params={{ storageId, _splat: folder.id }} />}
                >
                  {folder.name}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
