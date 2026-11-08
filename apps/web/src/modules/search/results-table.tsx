import { Badge } from "@fileee/ui/components/badge";
import { Button } from "@fileee/ui/components/button";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@fileee/ui/components/table";
import { Link } from "@tanstack/react-router";
import { FolderOpenIcon } from "lucide-react";
import { DateText } from "../../components/date-text.tsx";
import { FileThumb } from "../../components/file-icon.tsx";
import { formatBytes } from "../../lib/format.ts";
import { client } from "../../lib/orpc.ts";

export function ResultsTable({
  items,
  onPreview,
}: {
  items: Awaited<ReturnType<typeof client.search.query>>["items"];
  onPreview: (id: string) => void;
}) {
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
        {items.map((file) => (
          <TableRow key={file.id}>
            <TableCell className="max-w-64">
              <div className="flex items-center gap-2">
                <FileThumb
                  file={file}
                  thumbClassName="-my-0.5 size-6 shrink-0 rounded-sm object-cover"
                  iconClassName="size-4 shrink-0 text-muted-foreground"
                />

                <button
                  type="button"
                  className="truncate rounded-sm text-left hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  title={file.name}
                  onClick={() => onPreview(file.id)}
                >
                  {file.name}
                </button>

                {file.status === "missing" && <Badge variant="destructive">Missing</Badge>}
              </div>
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
              <Button
                variant="ghost"
                size="icon-sm"
                title="Go to folder"
                aria-label={`Go to the folder of ${file.name}`}
                nativeButton={false}
                render={
                  <Link
                    to="/s/$storageId/$"
                    params={{ storageId: file.storageId, _splat: file.folderId }}
                  />
                }
              >
                <FolderOpenIcon />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
