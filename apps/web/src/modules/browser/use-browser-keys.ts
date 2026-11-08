import { useEffect } from "react";
import { type BrowserItem } from "../../lib/item-actions.ts";
import { type ViewActions } from "./view-types.ts";
import { useSelection, keyOf } from "./use-selection.ts";

export function useBrowserKeys({
  items,
  selection,
  actions,
  open,
  setRenaming,
  setMoving,
}: {
  items: BrowserItem[];
  selection: ReturnType<typeof useSelection>;
  actions: ViewActions;
  open: (item: BrowserItem) => void;
  setRenaming: (item: BrowserItem) => void;
  setMoving: (items: BrowserItem[]) => void;
}) {
  const { selectedItems, anchor, setSelected, clear } = selection;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;

      if (el.closest("input, textarea, select, [contenteditable]")) return;
      if (document.querySelector("[role=dialog], [role=alertdialog], [role=menu]")) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelected(new Set(items.map(keyOf)));
      } else if (e.key === "Escape") {
        clear();
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (items.length === 0) return;

        e.preventDefault();

        const step = e.key === "ArrowDown" ? 1 : -1;
        const next = Math.min(items.length - 1, Math.max(0, anchor.current + step));

        anchor.current = next;
        setSelected(new Set([keyOf(items[next]!)]));
      } else if (e.metaKey || e.ctrlKey || e.altKey || selectedItems.length === 0) {
        return;
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        actions.trash(selectedItems);
      } else if (e.key === "Enter" && selectedItems.length === 1) {
        open(selectedItems[0]!);
      } else if (e.key === "F2" && selectedItems.length === 1) {
        e.preventDefault();
        setRenaming(selectedItems[0]!);
      } else if (e.key.toLowerCase() === "m") {
        setMoving(selectedItems);
      } else if (e.key.toLowerCase() === "s") {
        const chosen = selectedItems.filter((i) => i.kind === "file");

        if (chosen.length) actions.star(chosen, !chosen.every((i) => i.file.starred));
      }
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  });
}
