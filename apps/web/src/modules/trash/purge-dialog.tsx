import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@fileee/ui/components/alert-dialog";
import { type TrashRow } from "./trash-table.tsx";

export function PurgeDialog({
  purging,
  onClose,
  onConfirm,
}: {
  purging: TrashRow | null;
  onClose: () => void;
  onConfirm: (row: TrashRow) => void;
}) {
  return (
    <AlertDialog open={purging !== null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete "{purging?.name}" forever?</AlertDialogTitle>

          <AlertDialogDescription>
            {purging?.kind === "folder" ? "Everything in this folder is" : "This file is"} removed
            from your bucket. This can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>

          <AlertDialogAction variant="destructive" onClick={() => purging && onConfirm(purging)}>
            Delete forever
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
