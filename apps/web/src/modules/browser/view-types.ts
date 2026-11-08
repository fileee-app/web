import { type MouseEvent, type DragEvent, type HTMLAttributes } from "react";
import { type BrowserItem } from "../../lib/item-actions.ts";

export interface ViewActions {
  open: (item: BrowserItem) => void;
  details: (fileId: string) => void;
  download: (fileId: string) => void;
  rename: (item: BrowserItem) => void;
  share: (item: BrowserItem) => void;
  move: (items: BrowserItem[]) => void;
  star: (items: BrowserItem[], starred: boolean) => void;
  trash: (items: BrowserItem[]) => void;
}

export interface ViewProps {
  storageId: string;
  items: BrowserItem[];
  selected: Set<string>;
  /** Handles plain, cmd/ctrl and shift clicks. */
  onRowClick: (item: BrowserItem, e: MouseEvent) => void;
  /** Right-clicking outside the selection selects just that item, as file managers do. */
  onRowContextMenu: (item: BrowserItem) => void;
  onToggle: (item: BrowserItem) => void;
  onToggleAll: () => void;
  onDragStart: (item: BrowserItem, e: DragEvent) => void;
  /** Handlers making a folder accept dragged items. */
  dropProps: (folderId: string) => HTMLAttributes<HTMLElement> & { "data-drop"?: boolean };
  /** The items an action on this item applies to: the selection if it's part of it. */
  targetsOf: (item: BrowserItem) => BrowserItem[];
  actions: ViewActions;
}
