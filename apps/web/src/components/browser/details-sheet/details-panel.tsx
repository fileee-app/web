import { Button } from "@fileee/ui/components/button";
import { XIcon, FolderIcon } from "lucide-react";
import { type BrowserItem } from "../../../lib/item-actions.ts";
import { FileThumb } from "../../file-icon.tsx";
import { DetailRows } from "./detail-rows.tsx";
import { type FileActions, FileDetails } from "./file-details.tsx";

/** Beside the list on wide screens, for the one selected file or folder. Its height leaves out the header and the inset shell's 0.5rem margins. */
export function DetailsPanel({
  item,
  onClose,
  ...actions
}: { item: BrowserItem; onClose: () => void } & FileActions) {
  return (
    <aside
      aria-label="Details"
      className="sticky top-14 flex h-[calc(100svh-4.5rem)] w-80 shrink-0 flex-col overflow-y-auto border-l max-md:hidden"
    >
      <div className="flex items-start gap-2 p-4">
        <h2 className="min-w-0 flex-1 font-medium break-words">{item.name}</h2>

        <Button size="icon-sm" variant="ghost" aria-label="Close details" onClick={onClose}>
          <XIcon />
        </Button>
      </div>

      <div className="flex h-40 items-center justify-center px-4">
        {item.kind === "folder" ? (
          <FolderIcon className="size-16 fill-sky-500/20 text-sky-500" strokeWidth={1.25} />
        ) : (
          <FileThumb
            file={item.file}
            thumbClassName="size-full rounded-md object-contain"
            iconClassName="size-16 text-muted-foreground"
          />
        )}
      </div>

      {item.kind === "folder" ? (
        <DetailRows
          rows={[
            ["Type", "Folder"],
            ["Modified", item.folder.updatedAt.toLocaleString()],
            ["Created", item.folder.createdAt.toLocaleString()],
          ]}
        />
      ) : (
        <FileDetails key={item.id} file={item.file} {...actions} />
      )}
    </aside>
  );
}
