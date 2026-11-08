import { Badge } from "@fileee/ui/components/badge";
import { Button } from "@fileee/ui/components/button";
import { ToggleGroup, ToggleGroupItem } from "@fileee/ui/components/toggle-group";
import { Link } from "@tanstack/react-router";
import { ListIcon, LayoutGridIcon, FolderPlusIcon } from "lucide-react";
import { ShortcutsPopover } from "./shortcuts-popover.tsx";
import type { ReactNode } from "react";

export type View = "list" | "grid";

export function FolderToolbar({
  storageId,
  missing,
  view,
  setView,
  onNewFolder,
  children,
}: {
  storageId: string;
  missing: number;
  view: View;
  setView: (view: View) => void;
  onNewFolder: () => void;
  children: ReactNode;
}) {
  return (
    <>
      {missing > 0 && (
        <Badge
          variant="destructive"
          render={<Link to="/s/$storageId/missing" params={{ storageId }} />}
        >
          {missing} missing
        </Badge>
      )}

      <ShortcutsPopover />

      <ToggleGroup
        value={[view]}
        onValueChange={(v) => v[0] && setView(v[0] as View)}
        variant="outline"
        size="sm"
        aria-label="View"
        className="max-sm:hidden"
      >
        <ToggleGroupItem value="list" aria-label="List view">
          <ListIcon />
        </ToggleGroupItem>

        <ToggleGroupItem value="grid" aria-label="Grid view">
          <LayoutGridIcon />
        </ToggleGroupItem>
      </ToggleGroup>

      <Button size="sm" variant="outline" onClick={() => onNewFolder()}>
        <FolderPlusIcon data-icon="inline-start" />
        <span className="max-sm:hidden">New folder</span>
      </Button>

      {children}
    </>
  );
}
