import { orpc } from "../../lib/orpc.ts";

export const folderOptions = (storageId: string, folderId: string) =>
  orpc.folder.get.queryOptions({ input: { storageId, folderId: folderId || undefined } });

export const fileOptions = (storageId: string, folderId: string) =>
  orpc.file.list.infiniteOptions({
    input: (cursor: string | undefined) => ({ storageId, folderId, cursor }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor,
    // Keeps thumbnail URLs from expiring in a tab left open.
    refetchInterval: 5 * 60 * 1000,
  });
