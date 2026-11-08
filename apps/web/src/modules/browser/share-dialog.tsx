import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@fileee/ui/components/dialog";
import { type BrowserItem } from "../../lib/item-actions.ts";
import { ShareTabs } from "./share-tabs.tsx";

export function ShareDialog({ item, onClose }: { item: BrowserItem | null; onClose: () => void }) {
  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        {item && (
          <>
            <DialogHeader>
              <DialogTitle className="truncate pr-6">Share "{item.name}"</DialogTitle>

              <DialogDescription>
                {item.kind === "folder"
                  ? "Anyone with the link can browse and download everything in this folder, including its subfolders and anything added later."
                  : "Anyone with the link can download this file."}
              </DialogDescription>
            </DialogHeader>

            <ShareTabs key={item.id} item={item} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
