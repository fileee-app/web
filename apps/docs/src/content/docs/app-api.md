---
title: App API
description: The HTTP API the Fileee desktop and mobile apps use.
---

The desktop and mobile apps talk to a Fileee server through `/api/app`. It serves the same procedures as the web app's `/api/rpc`, with two differences:

- You sign in with a **bearer token**, not a cookie. Cookies sent to `/api/app` are ignored.
- There's no `Origin` check, so native clients can call it. Without cookies, a web page on another site has nothing to ride on.

It's internal: it follows the web app, and a procedure can change in any release. Ship the app and server together.

## Calls

Every procedure is a `POST` to `/api/app/<router>/<procedure>`. Send the input as `{"json": <input>}`. Procedures without input take an empty body.

```bash
curl -X POST https://files.example.com/api/app/auth/login \
  -H 'content-type: application/json' \
  -d '{"json":{"email":"ada@example.com","password":"correct horse battery"}}'
```

A success is HTTP 200 with the output in `json`. Dates are ISO 8601 strings. `meta` says which values were dates; you can ignore it.

```json
{ "json": { "id": "…", "name": "Ada", "email": "ada@example.com", "role": "admin", "createdAt": "2026-11-11T10:00:00.000Z", "token": "…" }, "meta": […] }
```

A failure has a 4xx or 5xx status and the error in `json`. Show `message` to the user; it's written for them.

```json
{ "json": { "defined": false, "code": "UNAUTHORIZED", "message": "Wrong email or password." } }
```

| Code                  | Status | Means                                                               |
| --------------------- | ------ | ------------------------------------------------------------------- |
| `BAD_REQUEST`         | 400    | The input failed validation.                                        |
| `UNAUTHORIZED`        | 401    | Wrong password, or the token expired or was revoked. Sign in again. |
| `FORBIDDEN`           | 403    | Admins only.                                                        |
| `NOT_FOUND`           | 404    | The item doesn't exist or isn't yours.                              |
| `CONFLICT`            | 409    | The item's state doesn't allow it (e.g. still uploading).           |
| `PRECONDITION_FAILED` | 412    | The server hasn't been set up. Call `setup/complete` first.         |
| `TOO_MANY_REQUESTS`   | 429    | Too many login attempts. Wait 15 minutes.                           |
| `BAD_GATEWAY`         | 502    | The storage provider returned an error.                             |

## Signing in

1. Call `setup/status` (no token) to check the address is a Fileee server and get its name. If `complete` is `false`, call `setup/complete` with the server's name and the first admin's details (and `setupToken` when `setupTokenRequired`). On `/api/app` it returns a `token` for that admin, as login does.
2. Call `auth/login` with `email` and `password`. On `/api/app` the reply includes `token`. Store it in the platform's secure storage.
3. Send `Authorization: Bearer <token>` with every other call.
4. `auth/logout` ends the session on the server. Delete the token too.

A token lasts like a browser session: 30 idle days, 90 days at most. Any `UNAUTHORIZED` means it's gone, so return to the login screen. Resetting a user's password or disabling them ends their app sessions too.

## Files

The server never carries file bytes. It signs short-lived URLs, and the app talks to the bucket directly. Native apps aren't subject to CORS, so the bucket's CORS rule doesn't matter to them.

- **Download**: `file/downloadUrl` returns a URL that downloads the file with its name. Open it in the system browser, or `GET` it.
- **Preview**: `file/previewUrl` returns `kind` (`image`, `video`, `audio`, `pdf`, `text` or `none`) and a URL that displays inline.
- **Thumbnails**: listings include `thumbnailUrl` when the file has one. Clients make thumbnails and read file details themselves: `file/signThumbnail` returns where to `PUT` a thumbnail, and `file/saveExtracted` stores it with the details. `storage/backfillCandidates` lists files still missing them. For what a native client can't decode (PDFs, video, audio), it can load `/thumbnailer` in a hidden web view: post it `{"id", "kind", "url", "size"}` with a presigned preview URL, and it posts back `{"id", "metadata", "thumbnail"}` (a JPEG data URL, or `null`) or `{"id", "error"}`. It runs on the server's origin, so the bucket's CORS rule lets it read the file. It holds no session and calls no procedure.

### Uploading

1. `upload/start` with `storageId`, `folderId`, `name`, `size` and `mimeType`. It returns `kind`:
   - `single`: `PUT` the whole file to `url`.
   - `multipart`: split the file into parts of `partSize` bytes (the last can be shorter). Sign up to 100 at a time with `upload/signParts` (`fileId`, `partNumbers` from 1) and `PUT` each part to its URL.
2. `upload/complete` with `fileId`. It's safe to retry.
3. To cancel, call `upload/abort` with `fileId`. Unfinished uploads expire on their own.

`upload/listPending` lists uploads that didn't finish, and `upload/resume` returns what an interrupted one still needs.

## Procedures

Inputs are validated with the Zod schemas in `packages/api/src/schemas.ts` and each procedure's file in `packages/api/src/routers/`. Those files are the reference; this is the map.

| Procedure                                                                           | Does                                                                            |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `setup/status`, `setup/complete`                                                    | Whether setup is done, and the server's name; first-run setup. No token.        |
| `auth/login`, `auth/logout`, `auth/me`                                              | Sign in (returns `token`), sign out, the current user (`null` when signed out). |
| `auth/updateProfile`, `auth/changePassword`                                         | Change your name or password.                                                   |
| `storage/list`, `storage/create`, `storage/update`, `storage/remove`                | Manage your storages. A blank secret on update keeps the stored one.            |
| `storage/test`, `storage/sync`, `storage/syncStatus`                                | Check the connection, pick up changes made outside Fileee, and its progress.    |
| `storage/corsInfo`, `storage/applyCors`                                             | The bucket's CORS rule, for the web app.                                        |
| `storage/setPublicAccess`, `storage/publicSummary`                                  | The CDN for public copies.                                                      |
| `folder/get`                                                                        | A folder (the root when `folderId` is left out), its path and subfolders.       |
| `folder/create`, `folder/rename`, `folder/move`, `folder/ensurePath`                | Change folders. Clashing names get a suffix.                                    |
| `folder/trash`, `folder/restore`, `folder/purge`                                    | Trash, restore, or delete for good from trash.                                  |
| `file/list`                                                                         | A folder's files, 50 at a time; pass `nextCursor` back as `cursor`.             |
| `file/recent`, `file/starred`                                                       | The 20 newest files, and your starred files, across storages.                   |
| `file/get`                                                                          | A file's details and metadata.                                                  |
| `file/rename`, `file/move`, `file/star`                                             | Change a file.                                                                  |
| `file/trash`, `file/restore`, `file/purge`                                          | Trash, restore, or delete for good from trash.                                  |
| `file/listMissing`                                                                  | Files sync couldn't find in the bucket.                                         |
| `file/signThumbnail`, `file/saveExtracted`                                          | Store a thumbnail and searchable text the client made.                          |
| `upload/*`                                                                          | See [Uploading](#uploading).                                                    |
| `search/query`                                                                      | Search names and metadata, with optional filters; paged like `file/list`.       |
| `trash/list`, `trash/empty`                                                         | What's in trash, and empty it.                                                  |
| `share/create`, `share/list`, `share/revoke`                                        | Share links for a file or folder.                                               |
| `share/publish`, `share/unpublish`, `share/publicStatus`                            | A file's public copy on the CDN.                                                |
| `settings/update`                                                                   | The server's name. Admins only.                                                 |
| `user/list`, `user/create`, `user/resetPassword`, `user/setDisabled`, `user/remove` | Manage users. Admins only.                                                      |

`share/resolve`, `share/download` and `share/preview` serve share links to anyone holding one. The app doesn't need them.
