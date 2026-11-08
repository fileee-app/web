import { Alert, AlertTitle, AlertDescription } from "@fileee/ui/components/alert";
import { Button } from "@fileee/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { TriangleAlertIcon, EyeIcon, DownloadIcon } from "lucide-react";
import { formatBytes } from "../../../lib/format.ts";
import { type FileRow } from "../../../lib/item-actions.ts";
import { orpc } from "../../../lib/orpc.ts";
import { DetailRows } from "./detail-rows.tsx";
import { metadataRows } from "./metadata-rows.ts";

export interface FileActions {
  onDownload: (fileId: string) => void;
  onPreview: (fileId: string) => void;
}

export function FileDetails({ file, onDownload, onPreview }: { file: FileRow } & FileActions) {
  const { data } = useQuery(orpc.file.get.queryOptions({ input: { fileId: file.id } }));
  const details = data?.id === file.id ? data : undefined;

  const rows: [string, string][] = [
    ["Size", formatBytes(file.size)],
    ["Type", file.mimeType ?? "Unknown"],
    ...metadataRows(details?.metadata ?? file.metadata),
    ["Modified", file.modifiedAt.toLocaleString()],
    ["Uploaded", file.createdAt.toLocaleString()],
    ...(details?.uploaderName ? ([["Uploader", details.uploaderName]] as [string, string][]) : []),
    ["ETag", file.etag ?? "—"],
    ...(file.sha256 ? ([["SHA-256", file.sha256]] as [string, string][]) : []),
    ["Key in bucket", file.objectKey],
  ];

  return (
    <>
      {file.status === "missing" && (
        <div className="px-4">
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertTitle>Not in the bucket</AlertTitle>

            <AlertDescription>
              The last sync couldn't find this object. It may have been moved, renamed or deleted
              outside fileee. If it comes back, the next sync restores it here.
            </AlertDescription>
          </Alert>
        </div>
      )}

      <DetailRows rows={rows} />

      <div className="flex flex-col gap-2 p-4">
        <Button
          variant="outline"
          className="w-full"
          disabled={file.status !== "ready"}
          onClick={() => onPreview(file.id)}
        >
          <EyeIcon data-icon="inline-start" />
          Preview
        </Button>

        <Button
          className="w-full"
          disabled={file.status !== "ready"}
          onClick={() => onDownload(file.id)}
        >
          <DownloadIcon data-icon="inline-start" />
          Download
        </Button>
      </div>
    </>
  );
}
