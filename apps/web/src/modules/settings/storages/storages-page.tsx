import { ItemGroup } from "@fileee/ui/components/item";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { orpc } from "../../../lib/orpc.ts";
import { BackfillDialog } from "./backfill-dialog.tsx";
import { CheckStorageDialog } from "./check-storage-dialog.tsx";
import { ConnectStorageButton } from "./connect-storage-button.tsx";
import { EditStorageDialog } from "./edit-storage-dialog.tsx";
import { NoStorages } from "./no-storages.tsx";
import { PublicAccessDialog } from "./public-access-dialog.tsx";
import { RemoveStorageDialog } from "./remove-storage-dialog.tsx";
import { StorageRowItem } from "./storage-row.tsx";
import { StuckCopiesAlert } from "./stuck-copies-alert.tsx";
import { type StorageRow } from "./types.ts";

export function StoragesPage() {
  const { data: storages } = useSuspenseQuery(orpc.storage.list.queryOptions());
  const [checking, setChecking] = useState<StorageRow | null>(null);
  const [editing, setEditing] = useState<StorageRow | null>(null);
  const [removing, setRemoving] = useState<StorageRow | null>(null);
  const [backfilling, setBackfilling] = useState<StorageRow | null>(null);
  // An ID, so the dialog follows the list after the setting changes.
  const [publicAccessId, setPublicAccessId] = useState<string | null>(null);
  const publicAccess = storages.find((s) => s.id === publicAccessId) ?? null;
  const { data: stuck } = useQuery(orpc.share.removalFailures.queryOptions({ staleTime: 0 }));
  const stuckAlert = stuck && stuck.length > 0 && <StuckCopiesAlert copies={stuck} />;

  if (storages.length === 0) {
    return stuckAlert ? (
      <div className="flex flex-col gap-4">
        {stuckAlert}
        <ConnectStorageButton />
      </div>
    ) : (
      <NoStorages />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-medium">Storages</h2>
        <ConnectStorageButton />
      </div>

      {stuckAlert}

      <ItemGroup className="gap-2">
        {storages.map((storage) => (
          <StorageRowItem
            key={storage.id}
            storage={storage}
            onCheck={() => setChecking(storage)}
            onEdit={() => setEditing(storage)}
            onPublicAccess={() => setPublicAccessId(storage.id)}
            onBackfill={() => setBackfilling(storage)}
            onRemove={() => setRemoving(storage)}
          />
        ))}
      </ItemGroup>

      <CheckStorageDialog checking={checking} onClose={() => setChecking(null)} />

      <EditStorageDialog editing={editing} onClose={() => setEditing(null)} />

      <PublicAccessDialog publicAccess={publicAccess} onClose={() => setPublicAccessId(null)} />

      <BackfillDialog storage={backfilling} onClose={() => setBackfilling(null)} />

      <RemoveStorageDialog removing={removing} onClose={() => setRemoving(null)} />
    </div>
  );
}
