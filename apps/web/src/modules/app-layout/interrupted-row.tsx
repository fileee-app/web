import { Button } from "@fileee/ui/components/button";
import {
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "@fileee/ui/components/item";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { XIcon } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import { formatBytes } from "../../lib/format.ts";
import { orpc } from "../../lib/orpc.ts";
import { resumeUpload } from "../../lib/uploads.ts";
import { IconAction } from "./icon-action.tsx";

/** Uploads left over from before a reload. A browser can't reopen a file by itself, so the user picks it again. */
export function InterruptedRow({
  pending,
  wide,
}: {
  pending: { fileId: string; name: string; size: number; storageId: string; folderId: string };
  wide: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const discard = useMutation(
    orpc.upload.abort.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.upload.listPending.key() }),
    }),
  );

  return (
    <Item size="xs" className="flex-nowrap px-0">
      <ItemContent className="min-w-0">
        <ItemTitle className="w-full">
          <span className={wide ? "break-all" : "truncate"} title={pending.name}>
            {pending.name}
          </span>
        </ItemTitle>

        <ItemDescription>Interrupted · {formatBytes(pending.size)}</ItemDescription>
      </ItemContent>

      <ItemActions>
        <input
          ref={input}
          type="file"
          className="sr-only"
          aria-label={`Choose ${pending.name} again`}
          onChange={(e) => {
            const file = e.target.files?.[0];

            e.target.value = "";

            if (!file) return;

            if (file.name !== pending.name || file.size !== pending.size) {
              toast.error(
                `That isn't the same file. Choose ${pending.name} (${formatBytes(pending.size)}).`,
              );

              return;
            }

            resumeUpload(file, pending, queryClient);
          }}
        />

        <Button size="sm" variant="outline" onClick={() => input.current?.click()}>
          Resume
        </Button>

        <IconAction label="Discard" onClick={() => discard.mutate({ fileId: pending.fileId })}>
          <XIcon />
        </IconAction>
      </ItemActions>
    </Item>
  );
}
