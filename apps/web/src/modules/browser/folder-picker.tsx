import { Button } from "@fileee/ui/components/button";
import { DialogFooter, DialogClose } from "@fileee/ui/components/dialog";
import { ItemGroup, Item, ItemMedia, ItemContent, ItemTitle } from "@fileee/ui/components/item";
import { ScrollArea } from "@fileee/ui/components/scroll-area";
import { Skeleton } from "@fileee/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeftIcon, FolderIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import { type BrowserItem } from "../../lib/item-actions.ts";
import { orpc } from "../../lib/orpc.ts";

export function FolderPicker({
  storageId,
  startFolderId,
  items,
  onMove,
}: {
  storageId: string;
  startFolderId: string;
  items: BrowserItem[];
  onMove: (folderId: string) => void;
}) {
  const [folderId, setFolderId] = useState(startFolderId);
  const { data } = useQuery(orpc.folder.get.queryOptions({ input: { storageId, folderId } }));
  const moving = new Set(items.filter((i) => i.kind === "folder").map((i) => i.id));
  const parent = data?.path.at(-2)?.id ?? data?.folder.parentId;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-h-8 items-center gap-1">
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Up one folder"
          disabled={!parent}
          onClick={() => parent && setFolderId(parent)}
        >
          <ChevronLeftIcon />
        </Button>

        <span className="truncate text-sm font-medium">
          {data?.path.at(-1)?.name ?? "Top level"}
        </span>
      </div>

      <ScrollArea className="h-56 rounded-lg border">
        {!data ? (
          <div className="flex flex-col gap-2 p-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : data.children.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">No folders here.</p>
        ) : (
          <ItemGroup className="p-1">
            {data.children.map((child) => (
              <Item
                key={child.id}
                size="xs"
                className="hover:bg-muted"
                render={
                  <button
                    type="button"
                    aria-label={`Open ${child.name}`}
                    disabled={moving.has(child.id)}
                    className="w-full text-left disabled:opacity-50"
                    onClick={() => setFolderId(child.id)}
                  />
                }
              >
                <ItemMedia>
                  <FolderIcon className="size-4 fill-sky-500/20 text-sky-500" />
                </ItemMedia>

                <ItemContent className="min-w-0">
                  <ItemTitle className="w-full truncate font-normal">{child.name}</ItemTitle>
                </ItemContent>

                <ChevronRightIcon className="size-4 text-muted-foreground" />
              </Item>
            ))}
          </ItemGroup>
        )}
      </ScrollArea>

      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>

        <Button disabled={!data || folderId === startFolderId} onClick={() => onMove(folderId)}>
          Move here
        </Button>
      </DialogFooter>
    </div>
  );
}
