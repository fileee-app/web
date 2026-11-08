import { Button } from "@fileee/ui/components/button";
import { Kbd } from "@fileee/ui/components/kbd";
import { Popover, PopoverTrigger, PopoverContent } from "@fileee/ui/components/popover";
import { KeyboardIcon } from "lucide-react";

const SHORTCUTS: [string, string][] = [
  ["↑ ↓", "Move selection"],
  ["Shift + click", "Select a range"],
  ["⌘ / Ctrl + A", "Select all"],
  ["Enter", "Open"],
  ["F2", "Rename"],
  ["M", "Move"],
  ["S", "Star"],
  ["Delete", "Move to trash"],
  ["Esc", "Clear selection"],
];

export function ShortcutsPopover() {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Keyboard shortcuts"
            className="max-sm:hidden"
          />
        }
      >
        <KeyboardIcon />
      </PopoverTrigger>

      <PopoverContent align="end" className="w-64">
        <dl className="flex flex-col gap-2 text-sm">
          {SHORTCUTS.map(([keys, label]) => (
            <div key={keys} className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">{label}</dt>

              <dd>
                <Kbd>{keys}</Kbd>
              </dd>
            </div>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
  );
}
