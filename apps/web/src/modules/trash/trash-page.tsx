import { Button } from "@fileee/ui/components/button";
import { useSuspenseQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "../../components/page-header.tsx";
import { orpc, client } from "../../lib/orpc.ts";
import { EmptyTrashDialog } from "./empty-trash-dialog.tsx";
import { PurgeDialog } from "./purge-dialog.tsx";
import { TrashEmpty } from "./trash-empty.tsx";
import { type TrashRow, TrashTable } from "./trash-table.tsx";

export function TrashPage() {
  const { data } = useSuspenseQuery(orpc.trash.list.queryOptions());
  const queryClient = useQueryClient();
  const [purging, setPurging] = useState<TrashRow | null>(null);
  const [emptying, setEmptying] = useState(false);

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: orpc.trash.key() }),
      queryClient.invalidateQueries({ queryKey: orpc.file.key() }),
      queryClient.invalidateQueries({ queryKey: orpc.folder.key() }),
    ]);

  const restore = useMutation({
    mutationFn: (row: TrashRow): Promise<{ name: string }> =>
      row.kind === "file"
        ? client.file.restore({ fileId: row.id })
        : client.folder.restore({ folderId: row.id }),
    onSuccess: (restored) => toast.success(`Restored "${restored.name}".`),
    onSettled: refresh,
  });

  const purge = useMutation({
    mutationFn: (row: TrashRow): Promise<unknown> =>
      row.kind === "file"
        ? client.file.purge({ fileId: row.id })
        : client.folder.purge({ folderId: row.id }),
    onSuccess: () => toast.success("Deleting from your bucket."),
    onSettled: async () => {
      setPurging(null);
      await refresh();
    },
  });

  const empty = useMutation(
    orpc.trash.empty.mutationOptions({
      onSuccess: () => toast.success("Deleting from your bucket."),
      onSettled: async () => {
        setEmptying(false);
        await refresh();
      },
    }),
  );

  const rows: TrashRow[] = [
    ...data.folders.map((folder) => ({ ...folder, kind: "folder" as const })),
    ...data.files.map((file) => ({ ...file, kind: "file" as const })),
  ];

  return (
    <>
      <PageHeader
        actions={
          rows.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setEmptying(true)}>
              <Trash2Icon data-icon="inline-start" />
              Empty trash
            </Button>
          )
        }
      >
        Trash
      </PageHeader>

      {rows.length === 0 ? (
        <TrashEmpty />
      ) : (
        <div className="mx-auto flex w-full max-w-5xl flex-col p-4 md:p-6">
          <TrashTable rows={rows} onRestore={(row) => restore.mutate(row)} onPurge={setPurging} />
        </div>
      )}

      <PurgeDialog
        purging={purging}
        onClose={() => setPurging(null)}
        onConfirm={(row) => purge.mutate(row)}
      />

      <EmptyTrashDialog
        open={emptying}
        onOpenChange={setEmptying}
        onConfirm={() => empty.mutate()}
      />
    </>
  );
}
