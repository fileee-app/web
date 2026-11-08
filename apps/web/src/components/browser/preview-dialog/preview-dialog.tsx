import { Button } from "@fileee/ui/components/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@fileee/ui/components/dialog";
import { InfoIcon, DownloadIcon } from "lucide-react";
import { client } from "../../../lib/orpc.ts";
import { type LoadUrl, type PreviewFile, FilePreview } from "./file-preview.tsx";

const loadOwnUrl: LoadUrl = (fileId) => client.file.previewUrl({ fileId });

export function PreviewDialog({
  file,
  onClose,
  onDownload,
  onDetails,
  loadUrl = loadOwnUrl,
}: {
  file: PreviewFile | null;
  onClose: () => void;
  onDownload: (fileId: string) => void;
  onDetails?: (fileId: string) => void;
  /** Where the preview URL comes from, when it isn't the signed-in user's own file. */
  loadUrl?: LoadUrl;
}) {
  return (
    <Dialog open={file !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100svh-2rem)] sm:max-w-[min(72rem,calc(100%-2rem))]">
        {file && (
          <>
            <DialogHeader className="flex-row items-center gap-2 pr-8">
              <DialogTitle className="min-w-0 flex-1 truncate">{file.name}</DialogTitle>

              {onDetails && (
                <Button size="sm" variant="outline" onClick={() => onDetails(file.id)}>
                  <InfoIcon data-icon="inline-start" />
                  Details
                </Button>
              )}

              <Button
                size="sm"
                variant="outline"
                disabled={file.status !== "ready"}
                onClick={() => onDownload(file.id)}
              >
                <DownloadIcon data-icon="inline-start" />
                Download
              </Button>
            </DialogHeader>

            <div className="min-h-0">
              <FilePreview
                key={file.id}
                file={file}
                loadUrl={loadUrl}
                onDownload={() => onDownload(file.id)}
              />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
