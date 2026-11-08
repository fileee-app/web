import type { QueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { processFile } from "./extract.ts";
import { client, orpc } from "./orpc.ts";

export interface UploadTarget {
  storageId: string;
  folderId: string;
}

export interface UploadItem {
  id: string;
  /** Set once the server knows about it. */
  fileId?: string;
  name: string;
  size: number;
  loaded: number;
  status: "queued" | "uploading" | "finishing" | "done" | "error" | "canceled";
  error?: string;
}

interface Job {
  item: UploadItem;
  file: File;
  target: UploadTarget;
  /** Folders to create under the target, for folder uploads. */
  dirs: string[];
  fileId?: string;
  controller?: AbortController;
}

const FILE_CONCURRENCY = 3;
const PART_CONCURRENCY = 4;
const PART_ATTEMPTS = 3;

let items: UploadItem[] = [];
const jobs = new Map<string, Job>();
const listeners = new Set<() => void>();
let queryClient: QueryClient | undefined;
let running = 0;

function publish() {
  items = [...jobs.values()].map((job) => job.item);

  for (const listener of listeners) listener();
}

function patch(job: Job, change: Partial<UploadItem>) {
  job.item = { ...job.item, ...change };
  publish();
}

const EMPTY: UploadItem[] = [];

export const useUploads = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },
    () => items,
    () => EMPTY,
  );

/** XHR rather than fetch: fetch can't report upload progress. */
function put(url: string, body: Blob, signal: AbortSignal, onProgress: (loaded: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open("PUT", url);
    xhr.upload.addEventListener("progress", (e) => onProgress(e.loaded));

    xhr.addEventListener("load", () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`The bucket refused the upload (HTTP ${xhr.status}).`)),
    );

    xhr.addEventListener("error", () =>
      reject(
        new Error(
          "Couldn't reach the bucket. This is usually its CORS rule: check it in storage settings.",
        ),
      ),
    );

    xhr.addEventListener("abort", () => reject(new DOMException("Canceled", "AbortError")));
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(body);
  });
}

async function uploadParts(job: Job, partSize: number, uploaded: number[], signal: AbortSignal) {
  const { file, fileId } = job;
  const count = Math.ceil(file.size / partSize);
  const done = new Set(uploaded);
  const remaining = Array.from({ length: count }, (_, i) => i + 1).filter((n) => !done.has(n));
  const progress = new Map<number, number>();
  // Only the last part can be shorter than partSize.
  const sizeOf = (part: number) => (part === count ? file.size - partSize * (count - 1) : partSize);
  const finished = uploaded.reduce((sum, part) => sum + sizeOf(part), 0);

  const report = () =>
    patch(job, { loaded: finished + [...progress.values()].reduce((a, b) => a + b, 0) });

  report();

  const worker = async () => {
    for (let part = remaining.shift(); part; part = remaining.shift()) {
      const blob = file.slice(partSize * (part - 1), partSize * part);

      for (let attempt = 1; ; attempt++) {
        try {
          const [signed] = await client.upload.signParts({ fileId: fileId!, partNumbers: [part] });

          await put(signed!.url, blob, signal, (loaded) => {
            progress.set(part!, loaded);
            report();
          });

          progress.set(part, blob.size);

          break;
        } catch (error) {
          progress.delete(part);
          report();

          if (signal.aborted || attempt === PART_ATTEMPTS) throw error;

          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
  };

  await Promise.all(Array.from({ length: PART_CONCURRENCY }, worker));
}

async function runJob(job: Job) {
  const { file, target, item } = job;
  const controller = new AbortController();

  job.controller = controller;

  const { signal } = controller;

  patch(job, { status: "uploading", loaded: 0, error: undefined });

  let plan:
    | Awaited<ReturnType<typeof client.upload.start>>
    | Awaited<ReturnType<typeof client.upload.resume>>;

  if (job.fileId) {
    plan = await client.upload.resume({ fileId: job.fileId });
  } else {
    const folderId = job.dirs.length
      ? (
          await client.folder.ensurePath({
            storageId: target.storageId,
            parentId: target.folderId,
            segments: job.dirs,
          })
        ).folderId
      : target.folderId;

    plan = await client.upload.start({
      storageId: target.storageId,
      folderId,
      name: item.name,
      size: file.size,
      mimeType: file.type,
    });

    job.fileId = plan.fileId;
    patch(job, { fileId: plan.fileId });
    void queryClient?.invalidateQueries({ queryKey: orpc.upload.listPending.key() });
  }

  signal.throwIfAborted();

  if (plan.kind === "single") {
    await put(plan.url, file, signal, (loaded) => patch(job, { loaded }));
  } else {
    await uploadParts(
      job,
      plan.partSize,
      "uploadedParts" in plan ? plan.uploadedParts : [],
      signal,
    );
  }

  signal.throwIfAborted();
  patch(job, { status: "finishing", loaded: file.size });
  await client.upload.complete({ fileId: job.fileId! });
  patch(job, { status: "done" });

  await Promise.all([
    queryClient?.invalidateQueries({ queryKey: orpc.file.key() }),
    queryClient?.invalidateQueries({ queryKey: orpc.folder.key() }),
    queryClient?.invalidateQueries({ queryKey: orpc.upload.listPending.key() }),
  ]);

  // The file is safe by now, so a failure here only costs it a thumbnail, which backfill can redo.
  // Awaited to keep big folder uploads from decoding hundreds of files at once.
  await processFile(job.fileId!, file)
    .catch(() => {})
    .then(() => queryClient?.invalidateQueries({ queryKey: orpc.file.key() }));
}

function pump() {
  while (running < FILE_CONCURRENCY) {
    const next = [...jobs.values()].find((job) => job.item.status === "queued");

    if (!next) return;

    running++;

    runJob(next)
      .catch((error) => {
        if (next.item.status !== "canceled") {
          patch(next, {
            status: "error",
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })
      .finally(() => {
        running--;
        pump();
      });
  }
}

function enqueue(file: File, target: UploadTarget, dirs: string[], fileId?: string) {
  const id = crypto.randomUUID();

  jobs.set(id, {
    file,
    target,
    dirs,
    fileId,
    item: { id, fileId, name: file.name, size: file.size, loaded: 0, status: "queued" },
  });
}

export interface PickedFile {
  file: File;
  /** Path of folders inside the upload, empty for a plain file. */
  dirs: string[];
}

export function startUploads(picked: PickedFile[], target: UploadTarget, qc: QueryClient) {
  queryClient = qc;

  for (const { file, dirs } of picked) enqueue(file, target, dirs);

  publish();
  pump();
}

/** Continues an upload that a reload interrupted, once the user has picked its file again. */
export function resumeUpload(
  file: File,
  pending: UploadTarget & { fileId: string },
  qc: QueryClient,
) {
  queryClient = qc;
  enqueue(file, pending, [], pending.fileId);
  publish();
  pump();
}

export function cancelUpload(id: string) {
  const job = jobs.get(id);

  if (!job) return;

  patch(job, { status: "canceled" });
  job.controller?.abort();

  if (job.fileId) {
    void client.upload
      .abort({ fileId: job.fileId })
      .catch(() => {}) // the cleanup job handles it when its time expires
      .finally(() => queryClient?.invalidateQueries({ queryKey: orpc.upload.listPending.key() }));
  }
}

export function retryUpload(id: string) {
  const job = jobs.get(id);

  if (!job) return;

  patch(job, { status: "queued", error: undefined });
  pump();
}

export function dismissUpload(id: string) {
  jobs.delete(id);
  publish();
}

export function clearFinishedUploads() {
  for (const [id, job] of jobs) {
    if (job.item.status === "done" || job.item.status === "canceled") jobs.delete(id);
  }

  publish();
}

export const fromInput = (files: FileList): PickedFile[] =>
  Array.from(files, (file) => ({
    file,
    // webkitRelativePath is `root/sub/name` for folder uploads and empty otherwise.
    dirs: file.webkitRelativePath.split("/").slice(0, -1),
  }));

/** Walks dropped files and folders. The entries must be read synchronously, before the drop event ends. */
export async function fromDrop(data: DataTransfer): Promise<PickedFile[]> {
  const entries = Array.from(data.items, (item) => item.webkitGetAsEntry()).filter(
    (e) => e !== null,
  );

  const walk = async (entry: FileSystemEntry, dirs: string[]): Promise<PickedFile[]> => {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) =>
        (entry as FileSystemFileEntry).file(resolve, reject),
      );

      return [{ file, dirs }];
    }

    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const children: FileSystemEntry[] = [];

    // readEntries returns a batch at a time, then an empty one.
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
        reader.readEntries(resolve, reject),
      );

      if (batch.length === 0) break;

      children.push(...batch);
    }

    const results = await Promise.all(children.map((child) => walk(child, [...dirs, entry.name])));

    return results.flat();
  };

  return (await Promise.all(entries.map((entry) => walk(entry, [])))).flat();
}
