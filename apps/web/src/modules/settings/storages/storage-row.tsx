import { Badge } from "@fileee/ui/components/badge";
import { Button } from "@fileee/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@fileee/ui/components/dropdown-menu";
import {
  Item,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "@fileee/ui/components/item";
import {
  DatabaseIcon,
  MoreHorizontalIcon,
  ActivityIcon,
  PencilIcon,
  GlobeIcon,
  ImagesIcon,
  Trash2Icon,
} from "lucide-react";
import { SyncLine, SyncNowButton } from "../../../components/sync-status.tsx";
import { type StorageRow } from "./types.ts";

const STATUS = {
  ok: { label: "Connected", variant: "secondary" },
  error: { label: "Check failed", variant: "destructive" },
  unchecked: { label: "Not tested", variant: "outline" },
} as const;

export function StorageRowItem({
  storage,
  onCheck,
  onEdit,
  onPublicAccess,
  onBackfill,
  onRemove,
}: {
  storage: StorageRow;
  onCheck: () => void;
  onEdit: () => void;
  onPublicAccess: () => void;
  onBackfill: () => void;
  onRemove: () => void;
}) {
  return (
    <Item variant="outline">
      <ItemMedia variant="icon">
        <DatabaseIcon />
      </ItemMedia>

      <ItemContent className="min-w-0">
        <ItemTitle>
          {storage.name}

          {storage.accessKeyHint ? (
            <Badge variant={STATUS[storage.status].variant}>{STATUS[storage.status].label}</Badge>
          ) : (
            <Badge variant="destructive">Re-enter credentials</Badge>
          )}

          {storage.cdnBaseUrl && (
            <Badge variant={storage.publicCheckError ? "destructive" : "outline"}>
              {storage.publicCheckError ? "CDN check failing" : "Public links on"}
            </Badge>
          )}
        </ItemTitle>

        <ItemDescription className="truncate">
          {storage.bucket}
          {storage.prefix && `/${storage.prefix}`}
          {storage.accessKeyHint && ` · key ending ${storage.accessKeyHint}`}
        </ItemDescription>

        <SyncLine storageId={storage.id} />
      </ItemContent>

      <ItemActions>
        <SyncNowButton storageId={storage.id} />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button size="icon-sm" variant="ghost" aria-label={`Actions for ${storage.name}`} />
            }
          >
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuItem onClick={onCheck}>
              <ActivityIcon />
              Check connection
            </DropdownMenuItem>

            <DropdownMenuItem onClick={onEdit}>
              <PencilIcon />
              Edit
            </DropdownMenuItem>

            <DropdownMenuItem onClick={onPublicAccess}>
              <GlobeIcon />
              Public access
            </DropdownMenuItem>

            <DropdownMenuItem onClick={onBackfill}>
              <ImagesIcon />
              Backfill thumbnails
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem variant="destructive" onClick={onRemove}>
              <Trash2Icon />
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </ItemActions>
    </Item>
  );
}
