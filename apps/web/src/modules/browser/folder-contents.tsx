import { Button } from "@fileee/ui/components/button";
import { useIsMobile } from "@fileee/ui/hooks/use-mobile";
import { useSuspenseQuery, useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { DetailsPanel } from "../../components/browser/details-sheet/details-panel.tsx";
import { DetailsSheet } from "../../components/browser/details-sheet/details-sheet.tsx";
import { PreviewDialog } from "../../components/browser/preview-dialog/preview-dialog.tsx";
import { PageHeader } from "../../components/page-header.tsx";
import { useItemActions, type BrowserItem } from "../../lib/item-actions.ts";
import { orpc } from "../../lib/orpc.ts";
import { useSyncStatus } from "../../lib/sync-status.ts";
import { GridView } from "./grid-view.tsx";
import { ListView } from "./list-view.tsx";
import { MoveDialog } from "./move-dialog.tsx";
import { NewFolderDialog } from "./new-folder-dialog.tsx";
import { RenameDialog } from "./rename-dialog.tsx";
import { EmptyFolder } from "./empty-folder.tsx";
import { FolderBreadcrumb } from "./folder-breadcrumb.tsx";
import { type View, FolderToolbar } from "./folder-toolbar.tsx";
import type { ViewActions } from "./view-types.ts";
import { PublicCheckAlert } from "./public-check-alert.tsx";
import { folderOptions, fileOptions } from "./queries.ts";
import { SelectionToolbar } from "./selection-toolbar.tsx";
import { ShareDialog } from "./share-dialog.tsx";
import { UploadMenu } from "./upload-menu.tsx";
import { useBrowserKeys } from "./use-browser-keys.ts";
import { useItemDrag } from "./use-item-drag.ts";
import { useSelection, keyOf } from "./use-selection.ts";
import { useUploads } from "./use-uploads.ts";

export function FolderContents({
  storageId,
  folderParam,
  view,
  setView,
}: {
  storageId: string;
  folderParam: string;
  view: View;
  setView: (view: View) => void;
}) {
  const { data: storages } = useSuspenseQuery(orpc.storage.list.queryOptions());
  const { data } = useSuspenseQuery(folderOptions(storageId, folderParam));
  const files = useSuspenseInfiniteQuery(fileOptions(storageId, data.folder.id));
  const navigate = useNavigate();
  const itemActions = useItemActions();
  const { data: sync } = useSyncStatus(storageId);
  const isMobile = useIsMobile();

  // IDs rather than rows, so the panels follow the list after a rename or a refetch.
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [renaming, setRenaming] = useState<BrowserItem | null>(null);
  const [moving, setMoving] = useState<BrowserItem[] | null>(null);
  const [sharing, setSharing] = useState<BrowserItem | null>(null);

  const storage = storages.find((s) => s.id === storageId);
  const target = { storageId, folderId: data.folder.id };

  const items: BrowserItem[] = [
    ...data.children.map((folder) => ({
      kind: "folder" as const,
      id: folder.id,
      name: folder.name,
      folder,
    })),
    ...files.data.pages.flatMap((page) =>
      page.items.map((file) => ({ kind: "file" as const, id: file.id, name: file.name, file })),
    ),
  ];

  const selection = useSelection(items);

  const { setSelected, selectedItems, liveSelected, targetsOf, clear, onRowClick, toggle } =
    selection;

  const open = (item: BrowserItem) => {
    if (item.kind === "folder") {
      void navigate({ to: "/s/$storageId/$", params: { storageId, _splat: item.id } });
    } else {
      setPreviewing(item.id);
    }
  };

  const actions: ViewActions = {
    open,
    // Wide screens show the selected item beside the list; phones have no room, so a sheet.
    details: (fileId) =>
      isMobile ? setDetailsId(fileId) : setSelected(new Set([`file:${fileId}`])),
    download: (fileId) => itemActions.download.mutate(fileId),
    rename: setRenaming,
    share: setSharing,
    move: setMoving,
    star: (targets, starred) => itemActions.star.mutate({ items: targets, starred }),
    trash: (targets) => {
      itemActions.trash.mutate(targets);
      clear();
    },
  };

  const moveItems = (moved: BrowserItem[], folderId: string) => {
    itemActions.move.mutate({ items: moved, folderId });
    setMoving(null);
    clear();
  };

  const { onDragStart, dropProps } = useItemDrag({ selection, moveItems });

  useBrowserKeys({ items, selection, actions, open, setRenaming, setMoving });

  const { draggingFiles, fileInput, folderInput, onPick, dropZone } = useUploads(target);

  const uploadMenu = (
    <UploadMenu
      onPickFiles={() => fileInput.current?.click()}
      onPickFolder={() => folderInput.current?.click()}
    />
  );

  const viewProps = {
    storageId,
    items,
    selected: liveSelected,
    onRowClick,
    onRowContextMenu: (item: BrowserItem) => {
      if (!liveSelected.has(keyOf(item))) setSelected(new Set([keyOf(item)]));
    },
    onToggle: toggle,
    onToggleAll: () =>
      setSelected(liveSelected.size === items.length ? new Set() : new Set(items.map(keyOf))),
    onDragStart,
    dropProps,
    targetsOf,
    actions,
  };

  const fileById = (id: string | null) =>
    items.find((i): i is BrowserItem & { kind: "file" } => i.kind === "file" && i.id === id)
      ?.file ?? null;

  return (
    <div className="relative flex flex-1 flex-col" {...dropZone}>
      <input
        ref={fileInput}
        type="file"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-label="Upload files"
        onChange={onPick}
      />

      <input
        ref={folderInput}
        type="file"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-label="Upload a folder"
        onChange={onPick}
      />

      <PageHeader
        actions={
          selectedItems.length > 0 ? (
            <SelectionToolbar
              selectedItems={selectedItems}
              actions={actions}
              onShare={setSharing}
              onMove={setMoving}
              onClear={clear}
            />
          ) : (
            <FolderToolbar
              storageId={storageId}
              missing={sync?.missing ?? 0}
              view={view}
              setView={setView}
              onNewFolder={() => setNewFolderOpen(true)}
            >
              {uploadMenu}
            </FolderToolbar>
          )
        }
      >
        <FolderBreadcrumb
          storageId={storageId}
          storageName={storage?.name}
          data={data}
          dropProps={dropProps}
        />
      </PageHeader>

      {storage?.publicCheckError && <PublicCheckAlert error={storage.publicCheckError} />}

      {items.length === 0 ? (
        <EmptyFolder>{uploadMenu}</EmptyFolder>
      ) : (
        <div className="flex flex-1 items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 md:p-6">
            {view === "list" ? <ListView {...viewProps} /> : <GridView {...viewProps} />}

            {files.hasNextPage && (
              <Button
                variant="outline"
                className="self-center"
                disabled={files.isFetchingNextPage}
                onClick={() => void files.fetchNextPage()}
              >
                {files.isFetchingNextPage ? "Loading…" : "Load more"}
              </Button>
            )}
          </div>

          {selectedItems.length === 1 && (
            <DetailsPanel
              item={selectedItems[0]!}
              onClose={clear}
              onDownload={(id) => itemActions.download.mutate(id)}
              onPreview={setPreviewing}
            />
          )}
        </div>
      )}

      {draggingFiles && (
        <div className="pointer-events-none absolute inset-2 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-background/80 text-sm font-medium">
          Drop to upload here
        </div>
      )}

      <NewFolderDialog
        open={newFolderOpen}
        onOpenChange={setNewFolderOpen}
        storageId={storageId}
        parentId={data.folder.id}
      />

      <RenameDialog
        item={renaming}
        onClose={() => setRenaming(null)}
        onRename={(item, name) => itemActions.rename.mutateAsync({ item, name })}
      />

      <MoveDialog
        items={moving}
        storageId={storageId}
        currentFolderId={data.folder.id}
        onClose={() => setMoving(null)}
        onMove={moveItems}
      />

      <ShareDialog item={sharing} onClose={() => setSharing(null)} />

      <PreviewDialog
        file={fileById(previewing)}
        onClose={() => setPreviewing(null)}
        onDownload={(id) => itemActions.download.mutate(id)}
        onDetails={(id) => {
          setPreviewing(null);
          actions.details(id);
        }}
      />

      <DetailsSheet
        file={fileById(detailsId)}
        onClose={() => setDetailsId(null)}
        onDownload={(id) => itemActions.download.mutate(id)}
        onPreview={(id) => {
          setDetailsId(null);
          setPreviewing(id);
        }}
      />
    </div>
  );
}
