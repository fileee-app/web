import { Button } from "@fileee/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@fileee/ui/components/dropdown-menu";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@fileee/ui/components/table";
import { FolderIcon, MoreHorizontalIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { DateText } from "../../components/date-text.tsx";
import { FileIcon } from "../../components/file-icon.tsx";
import { formatBytes } from "../../lib/format.ts";

export interface TrashRow {
  kind: "file" | "folder";
  id: string;
  name: string;
  size?: number;
  mimeType?: string | null;
  storageName: string;
  trashedAt: Date | null;
}

export function TrashTable({
  rows,
  onRestore,
  onPurge,
}: {
  rows: TrashRow[];
  onRestore: (row: TrashRow) => void;
  onPurge: (row: TrashRow) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead className="max-sm:hidden">Storage</TableHead>
          <TableHead className="text-right max-sm:hidden">Size</TableHead>
          <TableHead className="text-right max-sm:hidden">Trashed</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>

      <TableBody>
        {rows.map((row) => (
          <TableRow key={`${row.kind}:${row.id}`}>
            <TableCell className="max-w-0">
              <div className="flex items-center gap-2">
                {row.kind === "folder" ? (
                  <FolderIcon className="size-4 shrink-0 fill-sky-500/20 text-sky-500" />
                ) : (
                  <FileIcon
                    mimeType={row.mimeType ?? null}
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                )}

                <span className="truncate" title={row.name}>
                  {row.name}
                </span>
              </div>
            </TableCell>

            <TableCell className="text-muted-foreground max-sm:hidden">{row.storageName}</TableCell>

            <TableCell className="text-right text-muted-foreground tabular-nums max-sm:hidden">
              {row.size === undefined ? "—" : formatBytes(row.size)}
            </TableCell>

            <TableCell className="text-right text-muted-foreground max-sm:hidden">
              {row.trashedAt && <DateText date={row.trashedAt} />}
            </TableCell>

            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button size="icon-sm" variant="ghost" aria-label={`Actions for ${row.name}`} />
                  }
                >
                  <MoreHorizontalIcon />
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="min-w-44">
                  <DropdownMenuItem onClick={() => onRestore(row)}>
                    <RotateCcwIcon />
                    Restore
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem variant="destructive" onClick={() => onPurge(row)}>
                    <Trash2Icon />
                    Delete forever
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
