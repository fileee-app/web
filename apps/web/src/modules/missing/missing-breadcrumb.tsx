import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@fileee/ui/components/breadcrumb";
import { Link } from "@tanstack/react-router";

export function MissingBreadcrumb({
  storageId,
  storageName,
}: {
  storageId: string;
  storageName: string | undefined;
}) {
  return (
    <Breadcrumb>
      <BreadcrumbList className="flex-nowrap">
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link to="/s/$storageId/$" params={{ storageId, _splat: "" }} />}>
            {storageName}
          </BreadcrumbLink>
        </BreadcrumbItem>

        <BreadcrumbSeparator />

        <BreadcrumbItem>
          <BreadcrumbPage>Missing files</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
