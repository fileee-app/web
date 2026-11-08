import { Button } from "@fileee/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@fileee/ui/components/dialog";
import { Spinner } from "@fileee/ui/components/spinner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { backfill } from "../../../lib/extract.ts";
import { orpc } from "../../../lib/orpc.ts";

export function BackfillDialog({
  storage,
  onClose,
}: {
  storage: { id: string; name: string } | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const controller = useRef<AbortController>(null);
  const [progress, setProgress] = useState({ done: 0, failed: 0 });

  const run = useMutation({
    mutationFn: (storageId: string) => {
      setProgress({ done: 0, failed: 0 });
      controller.current = new AbortController();

      return backfill(storageId, controller.current.signal, (done, failed) =>
        setProgress({ done, failed }),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: orpc.file.key() }),
  });

  const close = () => {
    controller.current?.abort();
    run.reset();
    onClose();
  };

  return (
    <Dialog open={storage !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Backfill thumbnails for {storage?.name}</DialogTitle>

          <DialogDescription>
            This browser downloads files that have no thumbnail or details yet, such as imported
            ones, and processes them here. Your provider may charge for the download. Keep this
            window open while it runs.
          </DialogDescription>
        </DialogHeader>

        {(run.isPending || run.isSuccess) && (
          <p className="flex items-center gap-2" aria-live="polite">
            {run.isPending && <Spinner />}
            {run.isPending ? "Working: " : "Finished: "}
            {progress.done} processed
            {progress.failed > 0 && `, ${progress.failed} couldn't be read`}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={close}>
            {run.isPending ? "Stop" : "Close"}
          </Button>

          {!run.isPending && !run.isSuccess && (
            <Button onClick={() => storage && run.mutate(storage.id)}>Start</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
