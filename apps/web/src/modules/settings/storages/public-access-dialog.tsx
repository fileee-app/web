import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@fileee/ui/components/dialog";
import { PublicAccessForm } from "./public-access-form.tsx";
import { type StorageRow } from "./types.ts";

export function PublicAccessDialog({
  publicAccess,
  onClose,
}: {
  publicAccess: StorageRow | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={publicAccess !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Public access for {publicAccess?.name}</DialogTitle>

          <DialogDescription>
            Serve published files through a CDN. Only copies you publish go in the public location,
            and private files never use the CDN.
          </DialogDescription>
        </DialogHeader>

        {publicAccess && (
          <PublicAccessForm key={publicAccess.id} storage={publicAccess} onDone={() => onClose()} />
        )}
      </DialogContent>
    </Dialog>
  );
}
