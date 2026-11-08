import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@fileee/ui/components/dialog";
import { type BrowserItem } from "../../lib/item-actions.ts";
import { FolderPicker } from "./folder-picker.tsx";

export function MoveDialog({
  items,
  storageId,
  currentFolderId,
  onClose,
  onMove,
}: {
  items: BrowserItem[] | null;
  storageId: string;
  currentFolderId: string;
  onClose: () => void;
  onMove: (items: BrowserItem[], folderId: string) => void;
}) {
  return (
    <Dialog open={items !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="break-words">
            Move {items?.length === 1 ? `"${items[0]!.name}"` : `${items?.length} items`}
          </DialogTitle>

          <DialogDescription>
            Moving is instant, because nothing changes in your bucket.
          </DialogDescription>
        </DialogHeader>

        {items && (
          <FolderPicker
            storageId={storageId}
            startFolderId={currentFolderId}
            items={items}
            onMove={(folderId) => onMove(items, folderId)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
