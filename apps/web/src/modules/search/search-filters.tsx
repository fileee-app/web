import { FILE_TYPES } from "@fileee/api/schemas";
import { Button } from "@fileee/ui/components/button";
import { useSuspenseQuery } from "@tanstack/react-query";
import { orpc } from "../../lib/orpc.ts";
import { DateFilter } from "./date-filter.tsx";
import { FilterSelect } from "./filter-select.tsx";
import { type Search, isEmpty } from "./search-params.ts";

const MB = 1_000_000;
const ANY = "any";

const TYPE_ITEMS = [
  { value: ANY, label: "Any type" },
  ...FILE_TYPES.map((type) => ({
    value: type,
    label: type === "pdf" ? "PDF" : `${type[0]!.toUpperCase()}${type.slice(1)}`,
  })),
];

const SIZES = [
  { value: ANY, label: "Any size" },
  { value: "small", label: "Under 1 MB", maxSize: MB },
  { value: "medium", label: "1 MB to 100 MB", minSize: MB, maxSize: 100 * MB },
  { value: "large", label: "100 MB to 1 GB", minSize: 100 * MB, maxSize: 1000 * MB },
  { value: "huge", label: "Over 1 GB", minSize: 1000 * MB },
];

export function SearchFilters({
  search,
  update,
}: {
  search: Search;
  update: (change: Partial<Search>) => void;
}) {
  const { data: storages } = useSuspenseQuery(orpc.storage.list.queryOptions());

  const storageItems = [
    { value: ANY, label: "All storages" },
    ...storages.map((storage) => ({ value: storage.id, label: storage.name })),
  ];

  const size = SIZES.find(
    (item) => item.minSize === search.minSize && item.maxSize === search.maxSize,
  );

  const hasFilters = !isEmpty({ ...search, q: undefined });

  return (
    <div className="flex flex-wrap items-end gap-2">
      <FilterSelect
        label="Type"
        items={TYPE_ITEMS}
        value={search.type ?? ANY}
        onChange={(value) =>
          update({ type: value === ANY ? undefined : (value as (typeof FILE_TYPES)[number]) })
        }
      />

      <FilterSelect
        label="Size"
        items={SIZES}
        value={size?.value ?? ANY}
        onChange={(value) => {
          const picked = SIZES.find((item) => item.value === value);

          update({ minSize: picked?.minSize, maxSize: picked?.maxSize });
        }}
      />

      <FilterSelect
        label="Storage"
        items={storageItems}
        value={search.storageId ?? ANY}
        onChange={(value) => update({ storageId: value === ANY ? undefined : value })}
      />

      <DateFilter
        label="Modified from"
        value={search.modifiedFrom}
        onChange={(modifiedFrom) => update({ modifiedFrom })}
      />

      <DateFilter
        label="Modified to"
        value={search.modifiedTo}
        onChange={(modifiedTo) => update({ modifiedTo })}
      />

      {hasFilters && (
        <Button
          variant="ghost"
          onClick={() =>
            update({
              type: undefined,
              minSize: undefined,
              maxSize: undefined,
              storageId: undefined,
              modifiedFrom: undefined,
              modifiedTo: undefined,
            })
          }
        >
          Clear filters
        </Button>
      )}
    </div>
  );
}
