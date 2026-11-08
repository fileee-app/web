import { Button } from "@fileee/ui/components/button";
import { ButtonGroup } from "@fileee/ui/components/button-group";
import { Link2Icon, FolderInputIcon, StarIcon, Trash2Icon, XIcon } from "lucide-react";
import { type BrowserItem } from "../../lib/item-actions.ts";
import { type ViewActions } from "./view-types.ts";

export function SelectionToolbar({
  selectedItems,
  actions,
  onShare,
  onMove,
  onClear,
}: {
  selectedItems: BrowserItem[];
  actions: ViewActions;
  onShare: (item: BrowserItem) => void;
  onMove: (items: BrowserItem[]) => void;
  onClear: () => void;
}) {
  const selectedFiles = selectedItems.filter((i) => i.kind === "file");

  return (
    <>
      <span className="text-sm text-muted-foreground tabular-nums max-sm:hidden" aria-live="polite">
        {selectedItems.length} selected
      </span>

      <ButtonGroup>
        {selectedItems.length === 1 && (
          <Button
            size="sm"
            variant="outline"
            disabled={
              selectedItems[0]!.kind === "file" && selectedItems[0]!.file.status !== "ready"
            }
            onClick={() => onShare(selectedItems[0]!)}
          >
            <Link2Icon data-icon="inline-start" />
            Share
          </Button>
        )}

        <Button size="sm" variant="outline" onClick={() => onMove(selectedItems)}>
          <FolderInputIcon data-icon="inline-start" />
          Move
        </Button>

        {selectedFiles.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => actions.star(selectedFiles, !selectedFiles.every((i) => i.file.starred))}
          >
            <StarIcon data-icon="inline-start" />
            {selectedFiles.every((i) => i.file.starred) ? "Unstar" : "Star"}
          </Button>
        )}

        <Button size="sm" variant="outline" onClick={() => actions.trash(selectedItems)}>
          <Trash2Icon data-icon="inline-start" />
          Trash
        </Button>
      </ButtonGroup>

      <Button size="icon-sm" variant="ghost" aria-label="Clear selection" onClick={onClear}>
        <XIcon />
      </Button>
    </>
  );
}
