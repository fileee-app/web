import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@fileee/ui/components/context-menu";
import { type ReactElement } from "react";
import { type BrowserItem } from "../../lib/item-actions.ts";
import { ItemMenuItems } from "./item-menu-items.tsx";
import { type ViewProps } from "./view-types.ts";

export function ItemContextMenu({
  item,
  props,
  children,
}: {
  item: BrowserItem;
  props: ViewProps;
  children: ReactElement;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger render={children} />

      <ContextMenuContent className="min-w-48">
        <ItemMenuItems
          item={item}
          targets={props.targetsOf(item)}
          actions={props.actions}
          Row={ContextMenuItem}
          Separator={ContextMenuSeparator}
          Shortcut={ContextMenuShortcut}
        />
      </ContextMenuContent>
    </ContextMenu>
  );
}
