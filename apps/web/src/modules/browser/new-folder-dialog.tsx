import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@fileee/ui/components/dialog";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { orpc } from "../../lib/orpc.ts";
import { NameForm } from "./name-form.tsx";

export function NewFolderDialog({
  open,
  onOpenChange,
  storageId,
  parentId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storageId: string;
  parentId: string;
}) {
  const queryClient = useQueryClient();

  const create = useMutation(
    orpc.folder.create.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: orpc.folder.key() });
        onOpenChange(false);
      },
    }),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New folder</DialogTitle>

          <DialogDescription>
            Folders are kept by fileee, so nothing changes in your bucket.
          </DialogDescription>
        </DialogHeader>

        <NameForm
          initial=""
          label="Name"
          submitLabel="Create"
          onSubmit={(name) => create.mutateAsync({ storageId, parentId, name }).catch(() => {})}
        />
      </DialogContent>
    </Dialog>
  );
}
