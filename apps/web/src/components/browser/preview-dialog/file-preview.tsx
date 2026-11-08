import { Spinner } from "@fileee/ui/components/spinner";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useState, useCallback, useEffect } from "react";
import { type FileRow } from "../../../lib/item-actions.ts";
import { client, orpc } from "../../../lib/orpc.ts";
import { Centered } from "./centered.tsx";
import { MediaPreview } from "./media-preview.tsx";
import { PdfPreview } from "./pdf-preview.tsx";
import { PreviewUnavailable } from "./preview-unavailable.tsx";
import { TextPreview } from "./text-preview.tsx";

export type PreviewFile = Pick<FileRow, "id" | "name" | "size" | "status">;
export type LoadUrl = (fileId: string) => ReturnType<typeof client.file.previewUrl>;

/** The viewer itself, for a dialog or a page. */
export function FilePreview({
  file,
  loadUrl,
  onDownload,
}: {
  file: PreviewFile;
  loadUrl: LoadUrl;
  onDownload: () => void;
}) {
  const queryClient = useQueryClient();
  const [failed, setFailed] = useState(false);
  const fail = useCallback(() => setFailed(true), []);

  // One URL per opening: a refetch would restart whatever is playing.
  const query = useQuery({
    queryKey: ["preview-url", file.id],
    queryFn: () => loadUrl(file.id),
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  });

  useEffect(() => {
    // The check may just have found the object gone, which the list should show.
    if (query.isError) void queryClient.invalidateQueries({ queryKey: orpc.file.key() });
  }, [query.isError, queryClient]);

  if (query.isError)
    return <PreviewUnavailable title={query.error.message} onDownload={onDownload} />;

  if (!query.data) {
    return (
      <Centered>
        <Spinner />
      </Centered>
    );
  }

  const { kind, url } = query.data;

  if (kind === "none" || !url) {
    return <PreviewUnavailable title="No preview for this type of file" onDownload={onDownload} />;
  }

  if (failed) {
    return (
      <PreviewUnavailable title="This browser can't preview this file" onDownload={onDownload} />
    );
  }

  if (kind === "image") {
    // An <img> from the bucket: even an SVG can't run script here.
    return (
      <Centered>
        <img
          src={url}
          alt={file.name}
          className="max-h-[80svh] max-w-full object-contain"
          onError={fail}
        />
      </Centered>
    );
  }

  if (kind === "video" || kind === "audio") {
    return (
      <MediaPreview
        tag={kind}
        url={url}
        loadedAt={query.dataUpdatedAt}
        refresh={() => void query.refetch()}
        onFail={fail}
      />
    );
  }

  if (kind === "pdf") return <PdfPreview url={url} onFail={fail} />;

  return <TextPreview url={url} name={file.name} size={file.size} onFail={fail} />;
}
