import { Badge } from "@fileee/ui/components/badge";
import { Card, CardContent } from "@fileee/ui/components/card";
import { FolderIcon } from "lucide-react";
import { FileThumb } from "../../components/file-icon.tsx";
import { formatBytes } from "../../lib/format.ts";
import { FolderLink } from "./folder-link.tsx";
import { ItemContextMenu } from "./item-context-menu.tsx";
import { ItemDropdown } from "./item-dropdown.tsx";
import { RowCheckbox } from "./row-checkbox.tsx";
import { type ViewProps } from "./view-types.ts";
import { keyOf } from "./use-selection.ts";

export function GridView(props: ViewProps) {
  const { items, selected, storageId } = props;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {items.map((item) => (
        <ItemContextMenu key={keyOf(item)} item={item} props={props}>
          <Card
            size="sm"
            draggable
            data-selected={selected.has(keyOf(item))}
            className="relative cursor-default transition-colors select-none hover:bg-muted/50 data-[drop=true]:ring-2 data-[drop=true]:ring-primary data-[selected=true]:bg-muted data-[selected=true]:ring-2 data-[selected=true]:ring-ring"
            onClick={(e) => props.onRowClick(item, e)}
            onDoubleClick={() => props.actions.open(item)}
            onContextMenu={() => props.onRowContextMenu(item)}
            onDragStart={(e) => props.onDragStart(item, e)}
            {...(item.kind === "folder" ? props.dropProps(item.id) : {})}
          >
            <CardContent className="flex flex-col items-center gap-2 py-4 text-center">
              {item.kind === "folder" ? (
                <>
                  <div className="flex h-24 w-full items-center justify-center">
                    <FolderIcon
                      className="size-10 fill-sky-500/20 text-sky-500"
                      strokeWidth={1.25}
                    />
                  </div>

                  <FolderLink
                    item={item}
                    storageId={storageId}
                    className="w-full truncate text-sm font-medium hover:underline"
                  />

                  <span className="text-xs text-muted-foreground">Folder</span>
                </>
              ) : (
                <>
                  <div className="flex h-24 w-full items-center justify-center">
                    <FileThumb
                      file={item.file}
                      thumbClassName="size-full rounded-md object-contain"
                      iconClassName="size-10 text-muted-foreground"
                    />
                  </div>

                  <span className="w-full truncate text-sm" title={item.name}>
                    {item.name}
                  </span>

                  {item.file.status === "missing" ? (
                    <Badge variant="destructive">Missing</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {formatBytes(item.file.size)}
                    </span>
                  )}
                </>
              )}
            </CardContent>

            <div className="absolute top-2 left-2 flex">
              <RowCheckbox item={item} props={props} />
            </div>

            <div className="absolute top-1 right-1">
              <ItemDropdown item={item} props={props} />
            </div>
          </Card>
        </ItemContextMenu>
      ))}
    </div>
  );
}
