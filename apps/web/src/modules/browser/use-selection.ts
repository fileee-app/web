import { useState, useRef, type MouseEvent } from "react";
import { type BrowserItem } from "../../lib/item-actions.ts";

export const keyOf = (item: BrowserItem) => `${item.kind}:${item.id}`;

export function useSelection(items: BrowserItem[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const anchor = useRef<number>(-1);

  // Derived, so items that were moved or trashed drop out of the selection by themselves.
  const selectedItems = items.filter((item) => selected.has(keyOf(item)));
  const liveSelected = new Set(selectedItems.map(keyOf));
  const targetsOf = (item: BrowserItem) => (liveSelected.has(keyOf(item)) ? selectedItems : [item]);
  const clear = () => setSelected(new Set());

  const onRowClick = (item: BrowserItem, e: MouseEvent) => {
    // Clicks in a row's menu bubble through React's tree from the portal.
    if (!e.currentTarget.contains(e.target as Node)) return;

    const index = items.findIndex((other) => keyOf(other) === keyOf(item));

    if (e.shiftKey && anchor.current >= 0) {
      const [from, to] = [anchor.current, index].toSorted((a, b) => a - b);

      setSelected(new Set(items.slice(from, to! + 1).map(keyOf)));

      return;
    }

    anchor.current = index;

    if (e.metaKey || e.ctrlKey) {
      toggle(item);
    } else {
      setSelected(new Set([keyOf(item)]));
    }
  };

  const toggle = (item: BrowserItem) => {
    const next = new Set(liveSelected);

    if (!next.delete(keyOf(item))) next.add(keyOf(item));

    setSelected(next);
  };

  return { setSelected, anchor, selectedItems, liveSelected, targetsOf, clear, onRowClick, toggle };
}
