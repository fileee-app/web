import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@fileee/ui/components/dialog";
import { type BrowserItem } from "../../lib/item-actions.ts";
import { NameForm } from "./name-form.tsx";

export function RenameDialog({
  item,
  onClose,
  onRename,
}: {
  item: BrowserItem | null;
  onClose: () => void;
  onRename: (item: BrowserItem, name: string) => Promise<unknown>;
}) {
  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Rename</DialogTitle>

          <DialogDescription>
            Only the name in fileee changes. The object in your bucket stays put.
          </DialogDescription>
        </DialogHeader>

        {item && (
          <NameForm
            key={item.id}
            initial={item.name}
            label="Name"
            submitLabel="Rename"
            onSubmit={(name) => onRename(item, name).then(onClose, () => {})}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
