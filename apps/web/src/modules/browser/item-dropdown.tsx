import { Button } from "@fileee/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from "@fileee/ui/components/dropdown-menu";
import { MoreHorizontalIcon } from "lucide-react";
import { type BrowserItem } from "../../lib/item-actions.ts";
import { ItemMenuItems } from "./item-menu-items.tsx";
import { type ViewProps } from "./view-types.ts";

export function ItemDropdown({ item, props }: { item: BrowserItem; props: ViewProps }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Actions for ${item.name}`}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          />
        }
      >
        <MoreHorizontalIcon />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-48">
        <ItemMenuItems
          item={item}
          targets={props.targetsOf(item)}
          actions={props.actions}
          Row={DropdownMenuItem}
          Separator={DropdownMenuSeparator}
          Shortcut={DropdownMenuShortcut}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
