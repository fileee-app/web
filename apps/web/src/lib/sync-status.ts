import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { orpc } from "./orpc.ts";

const isActive = (status: string | undefined) => status === "queued" || status === "running";

/** Polls only while a run is active. When one finishes, the file lists are refreshed. */
export function useSyncStatus(storageId: string) {
  const queryClient = useQueryClient();

  const query = useQuery(
    orpc.storage.syncStatus.queryOptions({
      input: { storageId },
      refetchInterval: (q) => (isActive(q.state.data?.run?.status) ? 2000 : false),
    }),
  );

  const status = query.data?.run?.status;
  const wasActive = useRef(false);

  useEffect(() => {
    if (wasActive.current && !isActive(status)) {
      void queryClient.invalidateQueries({ queryKey: orpc.file.key() });
      void queryClient.invalidateQueries({ queryKey: orpc.folder.key() });
      // A sync repeats the CDN safety check.
      void queryClient.invalidateQueries({ queryKey: orpc.storage.list.key() });
      void queryClient.invalidateQueries({ queryKey: orpc.share.key() });
    }

    wasActive.current = isActive(status);
  }, [status, queryClient]);

  return query;
}
