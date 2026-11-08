import { Button } from "@fileee/ui/components/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
  CardContent,
} from "@fileee/ui/components/card";
import { ArrowLeftIcon } from "lucide-react";
import { FilePreview } from "../../components/browser/preview-dialog/file-preview.tsx";
import { FileIcon } from "../../components/file-icon.tsx";
import { formatBytes } from "../../lib/format.ts";
import { client } from "../../lib/orpc.ts";
import { DownloadButton } from "./download-button.tsx";
import { type SharedFile } from "./queries.ts";

// Shown right in the page when the browser can preview it, otherwise just a download card.
export function SharedFileView({
  file,
  token,
  password,
  saving,
  save,
  onBack,
}: {
  file: SharedFile;
  token: string;
  password: string | undefined;
  saving: (file: SharedFile) => boolean;
  save: (file: SharedFile) => void;
  onBack?: () => void;
}) {
  return file.preview === "none" ? (
    <Card className="w-full max-w-sm">
      <CardHeader className="justify-items-center text-center">
        <FileIcon mimeType={file.mimeType} className="size-10 text-muted-foreground" />
        <CardTitle className="break-words">{file.name}</CardTitle>
        <CardDescription>{formatBytes(file.size)}</CardDescription>
      </CardHeader>

      <CardFooter>
        <DownloadButton file={file} className="w-full" saving={saving} save={save} />
      </CardFooter>
    </Card>
  ) : (
    <Card className="w-full max-w-5xl">
      <CardHeader className="flex items-center gap-2">
        {onBack && (
          <Button size="icon-sm" variant="ghost" aria-label="Back to folder" onClick={onBack}>
            <ArrowLeftIcon />
          </Button>
        )}

        <div className="min-w-0 flex-1">
          <CardTitle className="truncate">{file.name}</CardTitle>
          <CardDescription>{formatBytes(file.size)}</CardDescription>
        </div>
      </CardHeader>

      <CardContent>
        <FilePreview
          key={file.id}
          file={{ ...file, status: "ready" }}
          loadUrl={(fileId) => client.share.preview({ token, password, fileId })}
          onDownload={() => save(file)}
        />
      </CardContent>

      <CardFooter className="justify-center">
        <DownloadButton file={file} saving={saving} save={save} />
      </CardFooter>
    </Card>
  );
}
