import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@fileee/ui/components/sheet";
import { type FileRow } from "../../../lib/item-actions.ts";
import { type FileActions, FileDetails } from "./file-details.tsx";

export function DetailsSheet({
  file,
  onClose,
  ...actions
}: { file: FileRow | null; onClose: () => void } & FileActions) {
  return (
    <Sheet open={file !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="pr-8 break-words">{file?.name}</SheetTitle>
          <SheetDescription>File details</SheetDescription>
        </SheetHeader>

        {file && <FileDetails file={file} {...actions} />}
      </SheetContent>
    </Sheet>
  );
}
