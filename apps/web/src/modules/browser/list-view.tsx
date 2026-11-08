import { Badge } from "@fileee/ui/components/badge";
import { Checkbox } from "@fileee/ui/components/checkbox";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@fileee/ui/components/table";
import { FolderIcon, StarIcon } from "lucide-react";
import { DateText } from "../../components/date-text.tsx";
import { FileThumb } from "../../components/file-icon.tsx";
import { formatBytes } from "../../lib/format.ts";
import { FolderLink } from "./folder-link.tsx";
import { ItemContextMenu } from "./item-context-menu.tsx";
import { ItemDropdown } from "./item-dropdown.tsx";
import { RowCheckbox } from "./row-checkbox.tsx";
import { type ViewProps } from "./view-types.ts";
import { keyOf } from "./use-selection.ts";

export function ListView(props: ViewProps) {
  const { items, selected, storageId } = props;
  const allSelected = items.length > 0 && selected.size === items.length;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8">
            <Checkbox
              aria-label="Select all"
              checked={allSelected}
              indeterminate={selected.size > 0 && !allSelected}
              onCheckedChange={props.onToggleAll}
            />
          </TableHead>

          <TableHead>Name</TableHead>
          <TableHead className="w-24 text-right max-sm:hidden">Size</TableHead>
          <TableHead className="w-36 text-right max-sm:hidden">Modified</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>

      <TableBody>
        {items.map((item) => (
          <ItemContextMenu key={keyOf(item)} item={item} props={props}>
            <TableRow
              draggable
              data-state={selected.has(keyOf(item)) ? "selected" : undefined}
              className="cursor-default select-none data-[drop=true]:bg-primary/10 data-[drop=true]:ring-2 data-[drop=true]:ring-primary data-[drop=true]:ring-inset"
              onClick={(e) => props.onRowClick(item, e)}
              onDoubleClick={() => props.actions.open(item)}
              onContextMenu={() => props.onRowContextMenu(item)}
              onDragStart={(e) => props.onDragStart(item, e)}
              {...(item.kind === "folder" ? props.dropProps(item.id) : {})}
            >
              <TableCell>
                <RowCheckbox item={item} props={props} />
              </TableCell>

              <TableCell className="max-w-0">
                <div className="flex items-center gap-2">
                  {item.kind === "folder" ? (
                    <>
                      <FolderIcon className="size-4 shrink-0 fill-sky-500/20 text-sky-500" />

                      <FolderLink
                        item={item}
                        storageId={storageId}
                        className="min-w-0 truncate font-medium hover:underline"
                      />
                    </>
                  ) : (
                    <>
                      <FileThumb
                        file={item.file}
                        thumbClassName="-my-0.5 size-6 shrink-0 rounded-sm object-cover"
                        iconClassName="size-4 shrink-0 text-muted-foreground"
                      />

                      <span className="truncate" title={item.name}>
                        {item.name}
                      </span>

                      {item.file.starred && (
                        <StarIcon
                          aria-label="Starred"
                          className="size-3.5 shrink-0 fill-current text-muted-foreground"
                        />
                      )}

                      {item.file.status === "missing" && (
                        <Badge variant="destructive">Missing</Badge>
                      )}
                    </>
                  )}
                </div>
              </TableCell>

              <TableCell className="text-right text-muted-foreground tabular-nums max-sm:hidden">
                {item.kind === "file" ? formatBytes(item.file.size) : "—"}
              </TableCell>

              <TableCell className="text-right text-muted-foreground max-sm:hidden">
                <DateText
                  date={item.kind === "file" ? item.file.modifiedAt : item.folder.updatedAt}
                />
              </TableCell>

              <TableCell>
                <ItemDropdown item={item} props={props} />
              </TableCell>
            </TableRow>
          </ItemContextMenu>
        ))}
      </TableBody>
    </Table>
  );
}
