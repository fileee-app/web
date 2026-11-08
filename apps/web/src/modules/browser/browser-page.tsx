import { getRouteApi } from "@tanstack/react-router";
import { useState } from "react";
import { FolderContents } from "./folder-contents.tsx";
import { type View } from "./folder-toolbar.tsx";

const route = getRouteApi("/_app/s/$storageId/$");

export function BrowserPage() {
  const { storageId, _splat = "" } = route.useParams();
  const [view, setView] = useState<View>("list");

  // The key resets selection and dialogs when entering another folder.
  return (
    <FolderContents
      key={`${storageId}/${_splat}`}
      storageId={storageId}
      folderParam={_splat}
      view={view}
      setView={setView}
    />
  );
}
