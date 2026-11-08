// oxlint-disable-next-line import/default
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PDFPageProxy } from "pdfjs-dist";

/** Loaded on demand: pdf.js is big, and it needs browser globals that SSR doesn't have. */
export async function openPdf(source: string | ArrayBuffer) {
  const pdfjs = await import("pdfjs-dist");

  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  return pdfjs.getDocument(typeof source === "string" ? { url: source } : { data: source }).promise;
}

export function drawPage(page: PDFPageProxy, canvas: HTMLCanvasElement, width: number) {
  const viewport = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width });

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  return page.render({ canvas, viewport });
}
