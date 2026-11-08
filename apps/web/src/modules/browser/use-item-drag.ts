import { type DragEvent, useRef, useState } from "react";
import { type BrowserItem } from "../../lib/item-actions.ts";
import { useSelection, keyOf } from "./use-selection.ts";

const isInternal = (e: DragEvent) => e.dataTransfer.types.includes("application/x-fileee-items");

export type DropProps = ReturnType<typeof useItemDrag>["dropProps"];

export function useItemDrag({
  selection,
  moveItems,
}: {
  selection: ReturnType<typeof useSelection>;
  moveItems: (moved: BrowserItem[], folderId: string) => void;
}) {
  const { liveSelected, setSelected, targetsOf } = selection;
  const dragged = useRef<BrowserItem[]>([]);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const onDragStart = (item: BrowserItem, e: DragEvent) => {
    if (!liveSelected.has(keyOf(item))) setSelected(new Set([keyOf(item)]));

    dragged.current = targetsOf(item);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("application/x-fileee-items", String(dragged.current.length));
  };

  const dropProps = (folderId: string) => {
    return {
      "data-drop": dropTarget === folderId,
      onDragOver: (e: DragEvent) => {
        // A folder can't take itself, and external files fall through to the page's upload handling.
        if (!isInternal(e) || dragged.current.some((i) => i.kind === "folder" && i.id === folderId))
          return;

        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDropTarget(folderId);
      },
      onDragLeave: () => setDropTarget(null),
      onDrop: (e: DragEvent) => {
        if (!isInternal(e)) return;

        e.preventDefault();
        e.stopPropagation();
        setDropTarget(null);
        moveItems(dragged.current, folderId);
      },
    };
  };

  return { onDragStart, dropProps };
}
