import { formatDuration } from "../../../lib/format.ts";
import { type FileRow } from "../../../lib/item-actions.ts";

/** Only the rows this file has. */
export function metadataRows(meta: FileRow["metadata"]): [string, string][] {
  if (!meta) return [];

  const rows: [string, string | undefined | false][] = [
    ["Dimensions", !!meta.width && !!meta.height && `${meta.width} × ${meta.height}`],
    ["Duration", meta.duration !== undefined && formatDuration(meta.duration)],
    ["Pages", meta.pages?.toLocaleString()],
    ["Title", meta.title],
    ["Author", meta.author],
    [
      "Lines",
      meta.lines !== undefined &&
        `${meta.lines.toLocaleString()}${meta.linesPartial ? "+ (first 1 MiB)" : ""}`,
    ],
    ["Encoding", meta.encoding],
    ["Camera", meta.camera],
    ["Taken", meta.takenAt && new Date(meta.takenAt).toLocaleString()],
    [
      "Location",
      meta.latitude !== undefined &&
        meta.longitude !== undefined &&
        `${meta.latitude.toFixed(5)}, ${meta.longitude.toFixed(5)}`,
    ],
  ];

  return rows.filter((row): row is [string, string] => !!row[1]);
}
