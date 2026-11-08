import { orpc } from "../../lib/orpc.ts";

export const missingOptions = (storageId: string) =>
  orpc.file.listMissing.infiniteOptions({
    input: (cursor: string | undefined) => ({ storageId, cursor }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor,
  });
