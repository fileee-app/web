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

export function DeleteUserDialog({
  user,
  onClose,
  onConfirm,
}: {
  user: { id: string; name: string } | null;
  onClose: () => void;
  onConfirm: (userId: string) => void;
}) {
  return (
    <AlertDialog open={user !== null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {user?.name}?</AlertDialogTitle>

          <AlertDialogDescription>
            This removes their account and their connected storages from fileee. Files in their
            buckets aren't touched.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>

          <AlertDialogAction variant="destructive" onClick={() => user && onConfirm(user.id)}>
            Delete user
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
