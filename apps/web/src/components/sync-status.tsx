import { Button } from "@fileee/ui/components/button";
import { ItemDescription } from "@fileee/ui/components/item";
import { Spinner } from "@fileee/ui/components/spinner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { RefreshCwIcon } from "lucide-react";
import { orpc } from "../lib/orpc.ts";
import { useSyncStatus } from "../lib/sync-status.ts";
import { DateText } from "./date-text.tsx";

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;

export function SyncLine({ storageId }: { storageId: string }) {
  const { data } = useSyncStatus(storageId);
  const run = data?.run;

  if (!run) return <ItemDescription>Not synced yet.</ItemDescription>;
  if (run.status === "queued") return <ItemDescription>Waiting to sync…</ItemDescription>;

  if (run.status === "running") {
    return <ItemDescription>Syncing… {plural(run.listed, "object")} so far.</ItemDescription>;
  }

  if (run.status === "failed") {
    return (
      <ItemDescription className="line-clamp-none text-destructive">
        Last sync failed, so nothing was marked missing: {run.error}
      </ItemDescription>
    );
  }

  return (
    <ItemDescription className="line-clamp-none">
      Synced {run.finishedAt && <DateText date={run.finishedAt} />}: {plural(run.listed, "object")},{" "}
      {run.added.toLocaleString()} added, {run.updated.toLocaleString()} updated.{" "}
      {data.missing > 0 && (
        <Link
          to="/s/$storageId/missing"
          params={{ storageId }}
          className="text-destructive underline underline-offset-3"
        >
          {plural(data.missing, "file")} missing
        </Link>
      )}
    </ItemDescription>
  );
}

export function SyncNowButton({ storageId }: { storageId: string }) {
  const queryClient = useQueryClient();
  const { data } = useSyncStatus(storageId);

  const sync = useMutation(
    orpc.storage.sync.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.storage.syncStatus.key() }),
    }),
  );

  const active =
    sync.isPending || data?.run?.status === "queued" || data?.run?.status === "running";

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={active}
      onClick={() => sync.mutate({ storageId })}
    >
      {active ? <Spinner data-icon="inline-start" /> : <RefreshCwIcon data-icon="inline-start" />}
      {active ? "Syncing" : "Sync now"}
    </Button>
  );
}
