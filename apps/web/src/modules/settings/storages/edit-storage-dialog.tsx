import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@fileee/ui/components/dialog";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "../../../lib/orpc.ts";
import { StorageForm } from "./storage-form.tsx";
import { type StorageRow } from "./types.ts";

export function EditStorageDialog({
  editing,
  onClose,
}: {
  editing: StorageRow | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: orpc.storage.key() });

  const update = useMutation(
    orpc.storage.update.mutationOptions({
      onSuccess: async () => {
        await refresh();
        onClose();
        toast.success("Storage updated. Run the check again to confirm it still works.");
      },
    }),
  );

  return (
    <Dialog open={editing !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit {editing?.name}</DialogTitle>

          <DialogDescription>
            Moving to a different bucket doesn't move your files.
          </DialogDescription>
        </DialogHeader>

        {editing && (
          <StorageForm
            key={editing.id}
            editing={{ accessKeyHint: editing.accessKeyHint }}
            submitLabel="Save changes"
            initial={{
              name: editing.name,
              provider: editing.provider,
              endpoint: editing.endpoint ?? "",
              region: editing.region,
              bucket: editing.bucket,
              prefix: editing.prefix,
              forcePathStyle: editing.forcePathStyle,
              accessKeyId: "",
              secretAccessKey: "",
            }}
            onSubmit={(values) =>
              update.mutateAsync({ ...values, storageId: editing.id }).catch(() => {})
            }
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
