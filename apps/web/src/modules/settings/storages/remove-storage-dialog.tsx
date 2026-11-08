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
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { orpc } from "../../../lib/orpc.ts";
import { type StorageRow } from "./types.ts";

export function RemoveStorageDialog({
  removing,
  onClose,
}: {
  removing: StorageRow | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: orpc.storage.key() });

  const remove = useMutation(
    orpc.storage.remove.mutationOptions({ onSuccess: refresh, onSettled: () => onClose() }),
  );

  return (
    <AlertDialog open={removing !== null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {removing?.name}?</AlertDialogTitle>

          <AlertDialogDescription>
            fileee forgets this connection and its folders. Files in the bucket aren't deleted, but
            folder names you set here are lost. Public copies are deleted, and their links stop
            working.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>

          <AlertDialogAction
            variant="destructive"
            onClick={() => removing && remove.mutate({ storageId: removing.id })}
          >
            Remove storage
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
