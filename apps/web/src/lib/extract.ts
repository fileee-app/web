import { client } from "./orpc.ts";
import { drawPage, openPdf } from "./pdf.ts";
import { decodeText, TEXT_LIMIT } from "./text.ts";

type Metadata = NonNullable<Parameters<typeof client.file.saveExtracted>[0]["metadata"]>;

interface Extracted {
  metadata: Metadata;
  canvas?: HTMLCanvasElement;
}

/** A file just picked by the user, or a presigned URL for one already in the bucket. */
type Source = Blob | string;

const THUMB_SIZE = 320;
const MAX_DECODE = 256 * 1024 * 1024; // images, PDFs and hashing need the whole file in memory
const TIMEOUT = 60_000;

const short = (value: unknown, max: number) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;

async function fetchBlob(url: string, init?: RequestInit) {
  const res = await fetch(url, init);

  if (!res.ok) throw new Error(`The bucket answered HTTP ${res.status}.`);

  return res.blob();
}

function thumbCanvas(source: CanvasImageSource, width: number, height: number) {
  const scale = Math.min(1, THUMB_SIZE / Math.max(width, height));
  const canvas = document.createElement("canvas");

  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height);

  return canvas;
}

async function readExif(blob: Blob): Promise<Metadata> {
  const { default: exifr } = await import("exifr");
  const tags = await exifr.parse(blob, { tiff: true, exif: true, gps: true });

  if (!tags) return {};

  const taken = tags.DateTimeOriginal instanceof Date ? tags.DateTimeOriginal : null;

  return {
    camera: short([tags.Make, tags.Model].filter(Boolean).join(" "), 200),
    takenAt: taken && !Number.isNaN(taken.getTime()) ? taken.toISOString() : undefined,
    ...(Number.isFinite(tags.latitude) && Number.isFinite(tags.longitude)
      ? { latitude: tags.latitude, longitude: tags.longitude }
      : {}),
  };
}

async function readImage(source: Source): Promise<Extracted> {
  const blob = typeof source === "string" ? await fetchBlob(source) : source;
  const exif = await readExif(blob).catch(() => ({}));
  // An <img> never runs script in an SVG, and this object URL is never navigated to.
  const url = URL.createObjectURL(blob);

  try {
    const img = new Image();

    img.src = url;
    await img.decode();

    const [width, height] = [img.naturalWidth, img.naturalHeight];

    return {
      metadata: { ...exif, ...(width && height ? { width, height } : {}) },
      canvas: thumbCanvas(img, width || THUMB_SIZE, height || THUMB_SIZE),
    };
  } catch {
    return { metadata: exif }; // a format this browser can't decode
  } finally {
    URL.revokeObjectURL(url);
  }
}

function once(el: HTMLMediaElement, event: string) {
  return new Promise<void>((resolve, reject) => {
    el.addEventListener(event, () => resolve(), { once: true });

    el.addEventListener("error", () => reject(new Error("The browser can't play this file.")), {
      once: true,
    });
  });
}

const durationOf = (el: HTMLMediaElement) =>
  Number.isFinite(el.duration) ? { duration: el.duration } : {};

async function readMedia(source: Source, tag: "video" | "audio"): Promise<Extracted> {
  const el = document.createElement(tag);
  const url = typeof source === "string" ? source : URL.createObjectURL(source);

  el.muted = true;
  el.preload = "auto";
  el.crossOrigin = "anonymous"; // or the canvas can't be read afterwards

  const loaded = once(el, "loadedmetadata");

  el.src = url;

  try {
    await loaded;

    if (!(el instanceof HTMLVideoElement) || !el.videoWidth) {
      return { metadata: durationOf(el) };
    }

    const seeked = once(el, "seeked");

    el.currentTime = Math.min(1, (el.duration || 0) / 10);
    await seeked;

    return {
      metadata: { ...durationOf(el), width: el.videoWidth, height: el.videoHeight },
      canvas: thumbCanvas(el, el.videoWidth, el.videoHeight),
    };
  } finally {
    el.removeAttribute("src");
    el.load();

    if (typeof source !== "string") URL.revokeObjectURL(url);
  }
}

async function readPdf(source: Source): Promise<Extracted> {
  const pdf = await openPdf(typeof source === "string" ? source : await source.arrayBuffer());

  try {
    const { info } = await pdf.getMetadata();
    const { Title, Author } = info as { Title?: unknown; Author?: unknown };
    const canvas = document.createElement("canvas");

    await drawPage(await pdf.getPage(1), canvas, THUMB_SIZE).promise;

    return {
      metadata: { pages: pdf.numPages, title: short(Title, 500), author: short(Author, 500) },
      canvas,
    };
  } finally {
    await pdf.loadingTask.destroy();
  }
}

async function readText(source: Source, size: number): Promise<Extracted> {
  const blob =
    typeof source === "string"
      ? await fetchBlob(source, { headers: { Range: `bytes=0-${TEXT_LIMIT - 1}` } })
      : source.slice(0, TEXT_LIMIT);

  const decoded = decodeText(new Uint8Array(await blob.arrayBuffer()));

  if (!decoded) return { metadata: {} };

  const lines = decoded.text ? decoded.text.split("\n").length : 0;

  return {
    metadata: {
      lines,
      encoding: decoded.encoding,
      ...(size > TEXT_LIMIT ? { linesPartial: true } : {}),
    },
  };
}

async function sha256(file: Blob) {
  if (!crypto.subtle || file.size > MAX_DECODE) return undefined; // subtle needs https or localhost

  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());

  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function withTimeout<T>(work: Promise<T>) {
  let timer: ReturnType<typeof setTimeout>;

  return Promise.race([
    work,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Processing took too long.")), TIMEOUT);
    }),
  ]).finally(() => clearTimeout(timer));
}

type Kind = Awaited<ReturnType<typeof client.file.signThumbnail>>["kind"];

/** Decodes a file from a presigned URL, as `processFile` does for one in the bucket. */
function extractUrl(kind: Kind, url: string, size: number): Promise<Extracted> {
  if (kind === "none") return Promise.resolve({ metadata: {} });
  if ((kind === "image" || kind === "pdf") && size > MAX_DECODE)
    return Promise.resolve({ metadata: {} });
  if (kind === "image") return readImage(url);
  if (kind === "video" || kind === "audio") return readMedia(url, kind);
  if (kind === "pdf") return readPdf(url);

  return readText(url, size);
}

/**
 * The thumbnailer page's work for the desktop and mobile apps: what this browser decodes that they
 * can't (PDFs, video, audio), as metadata and a JPEG data URL. They store it themselves.
 */
export async function extractForApp(kind: Kind, url: string, size: number) {
  const result = await withTimeout(extractUrl(kind, url, size));

  return {
    metadata: result.metadata,
    thumbnail: result.canvas?.toDataURL("image/jpeg", 0.8) ?? null,
  };
}

/**
 * Extracts metadata and a thumbnail in this browser and stores them; the server never sees the bytes.
 * Rejects if extraction failed, leaving the file for backfill to try again.
 */
export async function processFile(fileId: string, local?: File) {
  const { kind, size, url: thumbnailUrl } = await client.file.signThumbnail({ fileId });
  const hash = local ? await sha256(local).catch(() => undefined) : undefined;

  const extract = async (): Promise<Extracted> => {
    if (kind === "none") return { metadata: {} };
    if ((kind === "image" || kind === "pdf") && size > MAX_DECODE) return { metadata: {} };
    if (!local) return extractUrl(kind, (await client.file.previewUrl({ fileId })).url!, size);
    if (kind === "image") return readImage(local);
    if (kind === "video" || kind === "audio") return readMedia(local, kind);
    if (kind === "pdf") return readPdf(local);

    return readText(local, size);
  };

  let result: Extracted | undefined;
  let failure: unknown;

  try {
    result = await withTimeout(extract());
  } catch (error) {
    failure = error;
  }

  let thumbnail = false;

  if (result?.canvas && thumbnailUrl) {
    // Browsers without a WebP encoder give a PNG here; <img> goes by the bytes, so it still shows.
    const blob = await new Promise<Blob | null>((resolve) =>
      result!.canvas!.toBlob(resolve, "image/webp", 0.8),
    );

    if (blob) thumbnail = (await fetch(thumbnailUrl, { method: "PUT", body: blob })).ok;
  }

  if (result || hash) {
    await client.file.saveExtracted({
      fileId,
      metadata: result?.metadata,
      thumbnail,
      sha256: hash,
    });
  }

  if (failure) throw failure;
}

/** Runs in the browser because that's where the decoders are. Stops at `signal`. */
export async function backfill(
  storageId: string,
  signal: AbortSignal,
  onProgress: (done: number, failed: number) => void,
) {
  let [done, failed] = [0, 0];
  let cursor: string | undefined;

  do {
    const page = await client.storage.backfillCandidates({ storageId, cursor });
    const queue = [...page.fileIds];

    const worker = async () => {
      for (let id = queue.shift(); id && !signal.aborted; id = queue.shift()) {
        await processFile(id).then(
          () => done++,
          () => failed++,
        );

        onProgress(done, failed);
      }
    };

    await Promise.all(Array.from({ length: 3 }, worker));
    cursor = page.nextCursor;
  } while (cursor && !signal.aborted);

  return { done, failed };
}
