import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@fileee/ui/components/empty";
import { DatabaseIcon } from "lucide-react";
import { ConnectStorageButton } from "./connect-storage-button.tsx";

export function NoStorages() {
  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <DatabaseIcon />
        </EmptyMedia>

        <EmptyTitle>No storages yet</EmptyTitle>
        <EmptyDescription>Connect a bucket to start uploading.</EmptyDescription>
      </EmptyHeader>

      <EmptyContent>
        <ConnectStorageButton />
      </EmptyContent>
    </Empty>
  );
}
