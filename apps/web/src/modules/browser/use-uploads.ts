import { useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect, type DragEvent, type ChangeEvent } from "react";
import { startUploads, fromDrop, fromInput } from "../../lib/uploads.ts";
import type { UploadTarget } from "../../lib/uploads.ts";

export function useUploads(target: UploadTarget) {
  const queryClient = useQueryClient();
  const [draggingFiles, setDraggingFiles] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  // A non-standard attribute React won't pass through as a prop.
  useEffect(() => folderInput.current?.setAttribute("webkitdirectory", ""), []);

  const onDrop = async (e: DragEvent) => {
    setDraggingFiles(false);

    if (!e.dataTransfer.types.includes("Files")) return;

    e.preventDefault();
    startUploads(await fromDrop(e.dataTransfer), target, queryClient);
  };

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) startUploads(fromInput(e.target.files), target, queryClient);

    e.target.value = "";
  };

  const dropZone = {
    onDragOver: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes("Files")) return;

      e.preventDefault();
      setDraggingFiles(true);
    },
    onDragLeave: (e: DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setDraggingFiles(false);
    },
    onDrop,
  };

  return { draggingFiles, fileInput, folderInput, onPick, dropZone };
}
