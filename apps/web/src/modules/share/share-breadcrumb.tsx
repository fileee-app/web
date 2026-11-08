import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@fileee/ui/components/breadcrumb";
import { Fragment } from "react";
import { type Crumb } from "./queries.ts";

export function ShareBreadcrumb({
  name,
  trail,
  browse,
}: {
  name: string;
  trail: Crumb[];
  browse: (next: Crumb[]) => void;
}) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem className="min-w-0">
          {trail.length ? (
            <BreadcrumbLink
              render={<button type="button" aria-label={name} onClick={() => browse([])} />}
            >
              {name}
            </BreadcrumbLink>
          ) : (
            <BreadcrumbPage className="truncate">{name}</BreadcrumbPage>
          )}
        </BreadcrumbItem>

        {trail.map((crumb, i) => (
          <Fragment key={crumb.id}>
            <BreadcrumbSeparator />

            <BreadcrumbItem className="min-w-0">
              {i === trail.length - 1 ? (
                <BreadcrumbPage className="truncate">{crumb.name}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink
                  render={
                    <button
                      type="button"
                      aria-label={crumb.name}
                      onClick={() => browse(trail.slice(0, i + 1))}
                    />
                  }
                >
                  {crumb.name}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
