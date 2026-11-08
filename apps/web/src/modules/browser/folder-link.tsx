import { Link } from "@tanstack/react-router";
import { type BrowserItem } from "../../lib/item-actions.ts";

export function FolderLink({
  item,
  storageId,
  className,
}: {
  item: BrowserItem;
  storageId: string;
  className?: string;
}) {
  return (
    <Link
      to="/s/$storageId/$"
      params={{ storageId, _splat: item.id }}
      draggable={false}
      className={className}
      onClick={(e) => {
        if (!e.metaKey && !e.ctrlKey && !e.shiftKey) e.stopPropagation();
        else e.preventDefault();
      }}
    >
      <span className="truncate">{item.name}</span>
    </Link>
  );
}
