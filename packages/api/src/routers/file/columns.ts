import { files, storages } from "@fileee/db";

/** What the cross-storage views (recent, starred) show. */
export const summary = {
  id: files.id,
  name: files.name,
  size: files.size,
  mimeType: files.mimeType,
  modifiedAt: files.modifiedAt,
  starred: files.starred,
  storageId: files.storageId,
  folderId: files.folderId,
  storageName: storages.name,
};
