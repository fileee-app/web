import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { client, orpc } from "./orpc.ts";

export type FileRow = Awaited<ReturnType<typeof client.file.list>>["items"][number];
export type FolderRow = Awaited<ReturnType<typeof client.folder.get>>["children"][number];

export type BrowserItem =
  | { kind: "folder"; id: string; name: string; folder: FolderRow }
  | { kind: "file"; id: string; name: string; file: FileRow };

/** Each item is its own request, so the ownership middleware covers every one and a failure only affects that item. */
async function forEach<T extends { name: string }>(
  items: T[],
  verb: string,
  run: (item: T) => Promise<unknown>,
) {
  const results = await Promise.allSettled(items.map(run));
  const failed = results.filter((r) => r.status === "rejected");

  if (failed.length) {
    throw new Error(
      `Couldn't ${verb} ${failed.length} of ${items.length}: ${failed[0]!.reason.message}`,
    );
  }
}

const restoreItem = (item: BrowserItem) =>
  item.kind === "file"
    ? client.file.restore({ fileId: item.id })
    : client.folder.restore({ folderId: item.id });

const label = (items: BrowserItem[]) =>
  items.length === 1 ? `"${items[0]!.name}"` : `${items.length} items`;

export function useItemActions() {
  const queryClient = useQueryClient();

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: orpc.file.key() }),
      queryClient.invalidateQueries({ queryKey: orpc.folder.key() }),
      queryClient.invalidateQueries({ queryKey: orpc.trash.key() }),
      queryClient.invalidateQueries({ queryKey: orpc.storage.syncStatus.key() }),
    ]);

  const rename = useMutation({
    mutationFn: ({ item, name }: { item: BrowserItem; name: string }): Promise<unknown> =>
      item.kind === "file"
        ? client.file.rename({ fileId: item.id, name })
        : client.folder.rename({ folderId: item.id, name }),
    onSettled: refresh,
  });

  const move = useMutation({
    mutationFn: ({ items, folderId }: { items: BrowserItem[]; folderId: string }) =>
      forEach(items, "move", (item) =>
        item.kind === "file"
          ? client.file.move({ fileId: item.id, folderId })
          : client.folder.move({ folderId: item.id, parentId: folderId }),
      ),
    onSuccess: (_, { items }) => toast.success(`Moved ${label(items)}.`),
    onSettled: refresh,
  });

  const star = useMutation({
    mutationFn: ({ items, starred }: { items: BrowserItem[]; starred: boolean }) =>
      forEach(
        items.filter((item) => item.kind === "file"),
        "star",
        (item) => client.file.star({ fileId: item.id, starred }),
      ),
    onSettled: refresh,
  });

  const restore = useMutation({
    mutationFn: (items: BrowserItem[]) => forEach(items, "restore", restoreItem),
    onSettled: refresh,
  });

  const trash = useMutation({
    mutationFn: (items: BrowserItem[]) =>
      forEach(items, "move to trash", (item) =>
        item.kind === "file"
          ? client.file.trash({ fileId: item.id })
          : client.folder.trash({ folderId: item.id }),
      ),
    onSuccess: (_, items) =>
      toast(`Moved ${label(items)} to trash.`, {
        action: { label: "Undo", onClick: () => restore.mutate(items) },
      }),
    onSettled: refresh,
  });

  // Settling refreshes the list, because a failure here can mean the file was just found to be missing.
  const download = useMutation({
    mutationFn: (fileId: string) => client.file.downloadUrl({ fileId }),
    onSuccess: ({ url }) => window.location.assign(url), // its Content-Disposition keeps us on this page
    onSettled: refresh,
  });

  return { rename, move, star, trash, download };
}
