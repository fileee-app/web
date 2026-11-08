import {
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "@fileee/ui/components/item";
import { Progress } from "@fileee/ui/components/progress";
import { CheckIcon, RotateCwIcon, XIcon } from "lucide-react";
import { formatBytes } from "../../lib/format.ts";
import { type UploadItem, retryUpload, cancelUpload, dismissUpload } from "../../lib/uploads.ts";
import { IconAction } from "./icon-action.tsx";

export function UploadRow({ item, wide }: { item: UploadItem; wide: boolean }) {
  const percent = item.size ? Math.round((item.loaded / item.size) * 100) : 100;

  const active =
    item.status === "queued" || item.status === "uploading" || item.status === "finishing";

  const label = {
    queued: "Waiting",
    uploading: `${percent}% of ${formatBytes(item.size)}`,
    finishing: "Finishing",
    done: formatBytes(item.size),
    error: item.error,
    canceled: "Canceled",
  }[item.status];

  return (
    <Item size="xs" className="flex-nowrap px-0">
      <ItemContent className="min-w-0">
        <ItemTitle className={wide ? "w-full break-all" : "w-full truncate"} title={item.name}>
          <span className={wide ? "" : "truncate"}>{item.name}</span>
        </ItemTitle>

        {active && (
          <Progress value={percent} aria-label={`Uploading ${item.name}`} className="my-1" />
        )}

        <ItemDescription className={item.status === "error" ? "text-destructive line-clamp-3" : ""}>
          {label}
        </ItemDescription>
      </ItemContent>

      <ItemActions>
        {item.status === "done" && <CheckIcon className="size-4 text-muted-foreground" />}

        {item.status === "error" && (
          <IconAction label="Retry" onClick={() => retryUpload(item.id)}>
            <RotateCwIcon />
          </IconAction>
        )}

        {active ? (
          <IconAction label="Cancel upload" onClick={() => cancelUpload(item.id)}>
            <XIcon />
          </IconAction>
        ) : (
          <IconAction label="Dismiss" onClick={() => dismissUpload(item.id)}>
            <XIcon />
          </IconAction>
        )}
      </ItemActions>
    </Item>
  );
}
