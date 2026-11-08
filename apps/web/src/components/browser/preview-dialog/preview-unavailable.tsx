import { Button } from "@fileee/ui/components/button";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@fileee/ui/components/empty";
import { FileIcon, DownloadIcon } from "lucide-react";

export function PreviewUnavailable({
  title,
  onDownload,
}: {
  title: string;
  onDownload: () => void;
}) {
  return (
    <Empty className="min-h-64">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileIcon />
        </EmptyMedia>

        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>You can still download it.</EmptyDescription>
      </EmptyHeader>

      <EmptyContent>
        <Button onClick={onDownload}>
          <DownloadIcon data-icon="inline-start" />
          Download
        </Button>
      </EmptyContent>
    </Empty>
  );
}
