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
import { Trash2Icon } from "lucide-react";
import { DateText } from "../../components/date-text.tsx";
import { FileIcon } from "../../components/file-icon.tsx";
import { useItemActions } from "../../lib/item-actions.ts";
import { client } from "../../lib/orpc.ts";

export function MissingTable({
  rows,
  storageId,
}: {
  rows: Awaited<ReturnType<typeof client.file.listMissing>>["items"];
  storageId: string;
}) {
  const actions = useItemActions();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead className="max-sm:hidden">Key in bucket</TableHead>
          <TableHead className="text-right max-sm:hidden">Last seen</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>

      <TableBody>
        {rows.map((file) => (
          <TableRow key={file.id}>
            <TableCell className="max-w-0">
              <Link
                to="/s/$storageId/$"
                params={{ storageId, _splat: file.folderId }}
                className="flex items-center gap-2 hover:underline"
              >
                <FileIcon
                  mimeType={file.mimeType}
                  className="size-4 shrink-0 text-muted-foreground"
                />

                <span className="truncate">{file.name}</span>
              </Link>
            </TableCell>

            <TableCell
              className="max-w-0 truncate font-mono text-xs text-muted-foreground max-sm:hidden"
              title={file.objectKey}
            >
              {file.objectKey}
            </TableCell>

            <TableCell className="text-right text-muted-foreground max-sm:hidden">
              {file.lastSeenAt ? <DateText date={file.lastSeenAt} /> : "Never"}
            </TableCell>

            <TableCell>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Move ${file.name} to trash`}
                onClick={() =>
                  actions.trash.mutate([
                    {
                      kind: "file",
                      id: file.id,
                      name: file.name,
                      file: { ...file, thumbnailUrl: null },
                    },
                  ])
                }
              >
                <Trash2Icon />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
