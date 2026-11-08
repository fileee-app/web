# Troubleshooting

Start with the logs: `docker compose logs fileee`. Expected failures such as a wrong password aren't logged, so anything there is worth reading.

## The server won't start

| Message in the logs                   | Fix                                                                          |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| `ENCRYPTION_KEY is not set`           | Add it to `.env` beside `docker-compose.yml`                                 |
| `ENCRYPTION_KEY must be 32 bytes`     | Use the full output of `openssl rand -base64 32`                             |
| `APP_URL is not set` or `Invalid URL` | Set a full URL, including `http://` or `https://`                            |
| `DATABASE_URL is not set`             | Outside Docker only. Set it, or copy `.env.example` to `.env` in development |

## Signing in

**Every action fails, or the API answers `403 Forbidden`.** The address in your browser doesn't match `APP_URL` exactly. `localhost` and `127.0.0.1` count as different, and so do `http` and `https`, or a different port. Change `APP_URL` or the address you use.

**"Too many attempts. Try again in 15 minutes."** The limit is stored in the database, so restarting doesn't clear it, and neither does `admin:reset-password`. Wait it out. If it happens to many people at once behind a proxy, `TRUST_PROXY` is probably off, so they all share the proxy's IP.

**Locked out of the admin account.** See [Recover access](deploying.md#recover-access).

**The setup page asks for a token you don't have.** It's the `SETUP_TOKEN` in your environment.

**The container exits with "password authentication failed".** `POSTGRES_PASSWORD` only takes effect when the database is first created, so changing it in `.env` later doesn't change the stored one. Put the original back, or change it with `ALTER USER` in `docker compose exec postgres psql -U fileee`.

## Connecting a storage

The **Connection** check names the step that failed and what to fix.

**"The URL must use HTTPS" or "Private addresses are not allowed."** Use a public HTTPS endpoint. For your own storage on a private network, see [Connect a bucket](installing.md#connect-a-bucket).

**The connection test passes but the browser can't reach the bucket.** Both your server and your browser need to reach the same endpoint, because signed URLs use it directly.

- Under Docker, `localhost` means the container, not your machine. A container name like `minio:9000` works for the server but not the browser. Use an address both can resolve.
- A browser blocks an `https` app from calling a plain `http` endpoint.

**"The public location must be empty."** Everything there becomes public, so fileee refuses a location that already holds files. Pick an empty prefix or bucket.

## Uploads

**"Couldn't reach the bucket."** Usually CORS. Open the storage's **Browser access (CORS)** check and use **Apply for me** or **How to set up**. The rule names `APP_URL`, so reapply it if the address changed.

**"The bucket refused the upload (HTTP 403)."** Check that the credential can write to the prefix, and that the server's clock is right, because signed URLs depend on it.

**"Only N of M parts arrived."** Retry the upload. It continues with the parts already there.

**An upload was interrupted.** Select the same file again from the pending uploads to resume. This works for up to 7 days on multipart uploads.

## Files

**A file shows as missing.** Its object is gone from the key fileee knows, usually because it was moved, renamed or deleted outside fileee. If the object returns to that key, the next sync restores the file.

**New files in the bucket don't appear.** Sync runs daily, so use **Sync now**. An object modified after a sync started waits for the next one.

**A sync failed.** Its error is shown on the storage, usually an expired credential. Nothing is marked missing by a failed sync. Fix the cause and use **Sync now**.

**No thumbnail.** Imported files don't get one automatically. Run **Backfill thumbnails** on the storage.

**Video won't seek, or large PDFs load slowly.** The provider needs to support range requests. The connection test checks this at its `ranged get` step.

**Files or folders are in a "Recovered" folder.** Sync found objects in fileee's own layout with no database row, as happens after a database loss.

## Sharing

**A link says it isn't available.** The answer is the same whether the link is revoked, expired, wrong, or its file was trashed or is missing. Restoring from trash doesn't bring links back, so create a new one.

**A link's password is refused even when correct.** After 10 wrong attempts the link is locked for 15 minutes.

**"Publishing is blocked because the CDN safety check is failing."** A check found that a private object loads through your CDN, or couldn't complete. Limit the CDN to the public location, then save the setting again. The message says what failed.

**A removed public file still loads.** The CDN has it cached. Public copies are sent with a one-hour cache lifetime, unless your CDN overrides it.

## A storage says "Re-enter credentials"

`ENCRYPTION_KEY` doesn't match the one used to save its credentials. Until that's fixed, opening its files can fail with a server error, and the logs show `invalid tag` (or `Unsupported state or unable to authenticate data` for credentials saved by earlier versions). Restore the original key if you have it. If it's lost, edit the storage in **Settings > Storages** and enter both the access key ID and secret.
