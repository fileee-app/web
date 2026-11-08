import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@fileee/ui/components/table";
import { Link } from "@tanstack/react-router";
import { DateText } from "../../components/date-text.tsx";
import { FileIcon } from "../../components/file-icon.tsx";
import { formatBytes } from "../../lib/format.ts";
import { client } from "../../lib/orpc.ts";
import { StarButton } from "./star-button.tsx";

export function FileTable({ files }: { files: Awaited<ReturnType<typeof client.file.recent>> }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead className="max-sm:hidden">Storage</TableHead>
          <TableHead className="text-right max-sm:hidden">Size</TableHead>
          <TableHead className="text-right max-sm:hidden">Modified</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>

      <TableBody>
        {files.map((file) => (
          <TableRow key={file.id}>
            <TableCell className="max-w-64">
              <Link
                to="/s/$storageId/$"
                params={{ storageId: file.storageId, _splat: file.folderId }}
                className="flex items-center gap-2 hover:underline"
              >
                <FileIcon
                  mimeType={file.mimeType}
                  className="size-4 shrink-0 text-muted-foreground"
                />

                <span className="truncate">{file.name}</span>
              </Link>
            </TableCell>

            <TableCell className="text-muted-foreground max-sm:hidden">
              {file.storageName}
            </TableCell>

            <TableCell className="text-right text-muted-foreground tabular-nums max-sm:hidden">
              {formatBytes(file.size)}
            </TableCell>

            <TableCell className="text-right text-muted-foreground max-sm:hidden">
              <DateText date={file.modifiedAt} />
            </TableCell>

            <TableCell>
              <StarButton fileId={file.id} name={file.name} starred={file.starred} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
