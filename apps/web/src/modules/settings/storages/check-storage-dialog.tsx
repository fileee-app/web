import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@fileee/ui/components/dialog";
import { StorageCheck } from "./storage-check.tsx";
import { type StorageRow } from "./types.ts";

export function CheckStorageDialog({
  checking,
  onClose,
}: {
  checking: StorageRow | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={checking !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Check {checking?.name}</DialogTitle>
          <DialogDescription>Finds out exactly what's wrong, if anything.</DialogDescription>
        </DialogHeader>

        {checking && <StorageCheck storageId={checking.id} />}
      </DialogContent>
    </Dialog>
  );
}
