const TYPES: Record<string, string> = {
  apng: "image/apng",
  avif: "image/avif",
  bmp: "image/bmp",
  gif: "image/gif",
  heic: "image/heic",
  ico: "image/x-icon",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  tif: "image/tiff",
  tiff: "image/tiff",
  webp: "image/webp",
  avi: "video/x-msvideo",
  m4v: "video/x-m4v",
  mkv: "video/x-matroska",
  mov: "video/quicktime",
  mp4: "video/mp4",
  ogv: "video/ogg",
  webm: "video/webm",
  aac: "audio/aac",
  flac: "audio/flac",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  oga: "audio/ogg",
  ogg: "audio/ogg",
  opus: "audio/ogg",
  wav: "audio/wav",
  weba: "audio/webm",
  pdf: "application/pdf",
  doc: "application/msword",
  xls: "application/vnd.ms-excel",
  ppt: "application/vnd.ms-powerpoint",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv: "text/csv",
  htm: "text/html",
  html: "text/html",
  log: "text/plain",
  md: "text/markdown",
  txt: "text/plain",
  css: "text/css",
  js: "text/javascript",
  json: "application/json",
  ts: "text/typescript",
  xml: "application/xml",
  yaml: "application/yaml",
  yml: "application/yaml",
  "7z": "application/x-7z-compressed",
  gz: "application/gzip",
  rar: "application/vnd.rar",
  tar: "application/x-tar",
  zip: "application/zip",
};

/** Listings have no content type, so this is a guess from the name. Only ever a display hint. */
export const guessMimeType = (name: string) => {
  const dot = name.lastIndexOf(".");

  return dot > 0 ? (TYPES[name.slice(dot + 1).toLowerCase()] ?? null) : null;
};

export type PreviewKind = "image" | "video" | "audio" | "pdf" | "text" | "none";

const IMAGES = new Set("apng avif bmp gif heic ico jpeg jpg png svg tif tiff webp".split(" "));
const VIDEOS = new Set("m4v mkv mov mp4 ogv webm".split(" "));
const AUDIOS = new Set("aac flac m4a mp3 oga ogg opus wav weba".split(" "));

// HTML and SVG source are only safe here because this kind is always served and shown as plain text.
const TEXTS = new Set(
  `astro bash bat c cc cfg cjs clj cmd conf cpp cs css csv dart diff dockerfile dockerignore editorconfig
  elm env erl ex exs fish gitattributes gitignore go gradle graphql groovy h hpp hs htm html ini java jl
  js json json5 jsonc jsx kt less license lock log lua makefile md mdx mjs ml mts nix npmrc nvmrc php
  pl patch properties proto ps1 py r rb readme rs rst sass scala scss sh sql srt svelte swift tex tf
  toml ts tsv tsx txt vtt vue xml yaml yml zig zsh`.split(/\s+/),
);

/**
 * How a file may be previewed and the only type its preview URL is served as.
 * Decided from the name, never the browser's MIME type. A wrong extension only breaks a preview:
 * HTML named `.png` fails in an <img>, and script in an SVG doesn't run there.
 */
export function previewOf(name: string): { kind: PreviewKind; contentType: string } {
  const ext = name.toLowerCase().split(".").at(-1)!;
  const guessed = TYPES[ext] ?? "application/octet-stream";

  if (IMAGES.has(ext)) return { kind: "image", contentType: guessed };
  if (VIDEOS.has(ext)) return { kind: "video", contentType: guessed };
  if (AUDIOS.has(ext)) return { kind: "audio", contentType: guessed };
  if (ext === "pdf") return { kind: "pdf", contentType: guessed };
  if (TEXTS.has(ext)) return { kind: "text", contentType: "text/plain" };

  return { kind: "none", contentType: "application/octet-stream" };
}

export const hasThumbnail = (kind: PreviewKind) =>
  kind === "image" || kind === "video" || kind === "pdf";

const INLINE_KINDS = new Set<PreviewKind>(["image", "video", "audio", "pdf"]);

/**
 * How a public copy is served, from its name and never the browser's MIME type. Only what a browser
 * shows without running it stays inline. SVG can hold script, and everything else, known or not, downloads.
 */
export function publicHeadersOf(name: string) {
  const { kind, contentType } = previewOf(name);
  const inline = INLINE_KINDS.has(kind) && contentType !== "image/svg+xml";

  return { contentType, inline };
}
