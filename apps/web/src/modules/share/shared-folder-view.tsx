import { Button } from "@fileee/ui/components/button";
import { Card, CardHeader, CardContent } from "@fileee/ui/components/card";
import {
  ItemGroup,
  Item,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "@fileee/ui/components/item";
import { Spinner } from "@fileee/ui/components/spinner";
import { FolderIcon, ChevronRightIcon, EyeIcon, DownloadIcon } from "lucide-react";
import { FileIcon } from "../../components/file-icon.tsx";
import { formatBytes } from "../../lib/format.ts";
import { type Resolved, type Crumb, type SharedFile } from "./queries.ts";
import { ShareBreadcrumb } from "./share-breadcrumb.tsx";

export function SharedFolderView({
  view,
  trail,
  busy,
  browse,
  onPreview,
  saving,
  save,
}: {
  view: Extract<Resolved, { kind: "folder"; needsPassword: false }>;
  trail: Crumb[];
  busy: boolean;
  browse: (next: Crumb[]) => void;
  onPreview: (file: SharedFile) => void;
  saving: (file: SharedFile) => boolean;
  save: (file: SharedFile) => void;
}) {
  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <ShareBreadcrumb name={view.name} trail={trail} browse={browse} />
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {view.folders.length + view.files.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">This folder is empty.</p>
        ) : (
          <ItemGroup className="gap-1">
            {view.folders.map((folder) => (
              <Item
                key={folder.id}
                size="xs"
                className="hover:bg-muted"
                render={
                  <button
                    type="button"
                    aria-label={`Open ${folder.name}`}
                    className="w-full text-left"
                    disabled={busy}
                    onClick={() => browse([...trail, folder])}
                  />
                }
              >
                <ItemMedia>
                  <FolderIcon className="size-4 fill-sky-500/20 text-sky-500" />
                </ItemMedia>

                <ItemContent className="min-w-0">
                  <ItemTitle className="w-full truncate font-normal">{folder.name}</ItemTitle>
                </ItemContent>

                <ChevronRightIcon className="size-4 text-muted-foreground" />
              </Item>
            ))}

            {view.files.map((file) => (
              <Item key={file.id} size="xs">
                <ItemMedia>
                  <FileIcon mimeType={file.mimeType} className="size-4 text-muted-foreground" />
                </ItemMedia>

                <ItemContent className="min-w-0">
                  <ItemTitle className="w-full truncate font-normal">{file.name}</ItemTitle>
                  <ItemDescription>{formatBytes(file.size)}</ItemDescription>
                </ItemContent>

                <ItemActions>
                  {file.preview !== "none" && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Preview ${file.name}`}
                      onClick={() => onPreview(file)}
                    >
                      <EyeIcon />
                    </Button>
                  )}

                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Download ${file.name}`}
                    disabled={saving(file)}
                    onClick={() => save(file)}
                  >
                    {saving(file) ? <Spinner /> : <DownloadIcon />}
                  </Button>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        )}

        {view.truncated && (
          <p className="text-sm text-muted-foreground">Only the first 500 items are shown here.</p>
        )}
      </CardContent>
    </Card>
  );
}
