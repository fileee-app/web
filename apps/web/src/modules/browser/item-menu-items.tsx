import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@fileee/ui/components/context-menu";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from "@fileee/ui/components/dropdown-menu";
import {
  FolderOpenIcon,
  EyeIcon,
  InfoIcon,
  DownloadIcon,
  Link2Icon,
  PencilIcon,
  FolderInputIcon,
  StarOffIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react";
import { type BrowserItem } from "../../lib/item-actions.ts";
import { type ViewActions } from "./view-types.ts";

export function ItemMenuItems({
  item,
  targets,
  actions,
  Row,
  Separator,
  Shortcut,
}: {
  item: BrowserItem;
  targets: BrowserItem[];
  actions: ViewActions;
  Row: typeof DropdownMenuItem | typeof ContextMenuItem;
  Separator: typeof DropdownMenuSeparator | typeof ContextMenuSeparator;
  Shortcut: typeof DropdownMenuShortcut | typeof ContextMenuShortcut;
}) {
  const single = targets.length === 1;
  const files = targets.filter((t) => t.kind === "file");
  const allStarred = files.length > 0 && files.every((t) => t.kind === "file" && t.file.starred);

  return (
    <>
      {single && (
        <>
          <Row onClick={() => actions.open(item)}>
            {item.kind === "folder" ? <FolderOpenIcon /> : <EyeIcon />}
            {item.kind === "folder" ? "Open" : "Preview"}
            <Shortcut>↵</Shortcut>
          </Row>

          {item.kind === "file" && (
            <Row onClick={() => actions.details(item.id)}>
              <InfoIcon />
              Details
            </Row>
          )}

          {item.kind === "file" && (
            <Row disabled={item.file.status !== "ready"} onClick={() => actions.download(item.id)}>
              <DownloadIcon />
              Download
            </Row>
          )}

          <Row
            disabled={item.kind === "file" && item.file.status !== "ready"}
            onClick={() => actions.share(item)}
          >
            <Link2Icon />
            Share
          </Row>

          <Separator />

          <Row onClick={() => actions.rename(item)}>
            <PencilIcon />
            Rename
            <Shortcut>F2</Shortcut>
          </Row>
        </>
      )}

      <Row onClick={() => actions.move(targets)}>
        <FolderInputIcon />
        Move{single ? "" : ` ${targets.length} items`}
        <Shortcut>M</Shortcut>
      </Row>

      {files.length > 0 && (
        <Row onClick={() => actions.star(targets, !allStarred)}>
          {allStarred ? <StarOffIcon /> : <StarIcon />}
          {allStarred ? "Unstar" : "Star"}
          <Shortcut>S</Shortcut>
        </Row>
      )}

      <Separator />

      <Row variant="destructive" onClick={() => actions.trash(targets)}>
        <Trash2Icon />
        Move to trash
        <Shortcut>⌫</Shortcut>
      </Row>
    </>
  );
}
