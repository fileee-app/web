import { Checkbox } from "@fileee/ui/components/checkbox";
import { type BrowserItem } from "../../lib/item-actions.ts";
import { type ViewProps } from "./view-types.ts";
import { keyOf } from "./use-selection.ts";

export function RowCheckbox({ item, props }: { item: BrowserItem; props: ViewProps }) {
  return (
    <Checkbox
      aria-label={`Select ${item.name}`}
      checked={props.selected.has(keyOf(item))}
      onCheckedChange={() => props.onToggle(item)}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    />
  );
}
