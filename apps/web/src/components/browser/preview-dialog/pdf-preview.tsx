import { Button } from "@fileee/ui/components/button";
import { Spinner } from "@fileee/ui/components/spinner";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { openPdf, drawPage } from "../../../lib/pdf.ts";
import { Centered } from "./centered.tsx";

type Pdf = Awaited<ReturnType<typeof openPdf>>;

export function PdfPreview({ url, onFail }: { url: string; onFail: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<Pdf | null>(null);
  const [pageNumber, setPageNumber] = useState(1);

  useEffect(() => {
    const closed = new AbortController();
    const opening = openPdf(url);

    opening.then((doc) => {
      if (!closed.signal.aborted) setPdf(doc);
    }, onFail);

    return () => {
      closed.abort();

      void opening.then(
        (doc) => doc.loadingTask.destroy(),
        () => {},
      );
    };
  }, [url, onFail]);

  useEffect(() => {
    if (!pdf) return;

    const turned = new AbortController();

    const rendering = pdf.getPage(pageNumber).then((page) => {
      if (turned.signal.aborted || !canvas.current) return;

      const width = canvas.current.parentElement!.clientWidth;
      const task = drawPage(page, canvas.current, Math.min(width, 1000) * devicePixelRatio);

      task.promise.catch(() => {}); // cancelled by turning the page

      return task;
    });

    return () => {
      turned.abort();
      void rendering.then((task) => task?.cancel());
    };
  }, [pdf, pageNumber]);

  return (
    <div className="flex h-[80svh] flex-col gap-2">
      <div className="min-h-0 flex-1 overflow-auto text-center">
        {!pdf && (
          <Centered>
            <Spinner />
          </Centered>
        )}

        <canvas ref={canvas} className="mx-auto max-w-full" hidden={!pdf} />
      </div>

      {pdf && (
        <div className="flex items-center justify-center gap-2 tabular-nums">
          <Button
            size="icon-sm"
            variant="outline"
            aria-label="Previous page"
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber(pageNumber - 1)}
          >
            <ChevronLeftIcon />
          </Button>

          <span aria-live="polite">
            Page {pageNumber} of {pdf.numPages}
          </span>

          <Button
            size="icon-sm"
            variant="outline"
            aria-label="Next page"
            disabled={pageNumber >= pdf.numPages}
            onClick={() => setPageNumber(pageNumber + 1)}
          >
            <ChevronRightIcon />
          </Button>
        </div>
      )}
    </div>
  );
}
