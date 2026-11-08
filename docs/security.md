# Security

How fileee protects your data, and what it leaves to you. For setup steps, see [Deploying](deploying.md).

## Bucket credentials

- Encrypted with XChaCha20-Poly1305 through [minicrypt](https://git.tbdh.app/tbdsux/minicrypt), with a random 24-byte nonce and a key derived from `ENCRYPTION_KEY` by HKDF-SHA256. Credentials saved by earlier versions stay AES-256-GCM until their storage is edited.
- `ENCRYPTION_KEY` is never stored in the database or data volume, so a stolen database alone doesn't reveal them.
- The API never returns a secret. Settings show only the last 4 characters of the access key ID.
- A signed file URL contains the full access key ID, the bucket and the object key, so anyone given a share link can read those. They can't sign requests with them.
- Someone with both server access and the key can decrypt them, so give each storage a credential limited to one bucket.

There's no key rotation. If `ENCRYPTION_KEY` changes, credentials saved under the old key stop working until each storage's owner enters them again.

## Accounts and sessions

- Passwords are 12 to 128 characters, hashed with scrypt (N=2^17, r=8, p=1) and a per-password salt.
- A session is 32 random bytes in an `HttpOnly`, `SameSite=Lax` cookie, which is also `Secure` with a `__Host-` prefix when `APP_URL` is HTTPS. The database stores only its hash, so a leaked backup can't be used to sign in.
- Sessions expire after 30 idle days, and after 90 days regardless.
- A failed login gives the same answer and takes the same time whether or not the email exists.
- Every API call must carry an `Origin` matching `APP_URL`.

| Limit (per 15 minutes) | Attempts | Counted per         |
| ---------------------- | -------- | ------------------- |
| Login                  | 10       | Email and client IP |
| Login                  | 100      | Email               |
| Login                  | 50       | Client IP           |
| Share link password    | 10       | Link                |
| Setup token            | 10       | Client IP           |

One address guessing at an account locks out only itself. Locking the account for everyone takes at least 10 addresses.

API requests are limited to 1 MiB. File bytes go straight to the bucket, so this doesn't limit uploads.

Someone holding a password-protected link can lock it for 15 minutes by guessing wrong. That's the cost of a limit that can't be dodged by changing IP.

## File access

- Ownership checks run in shared API middleware. Another user's ID gets the same "not found" as one that doesn't exist.
- View and download URLs last 15 minutes, and upload URLs one hour.
- Sharing tokens are 32 random bytes and stored only as hashes. A share page sends no referrer, is never cached, and asks search engines not to index it.

## Untrusted files

A file could be HTML or script made to run on your domain, so fileee never serves user files from its own origin.

- Files load from the bucket's origin or the CDN's, and the CDN must be on a different host from the app.
- The content type comes from the file's name, never the browser's claim. Text previews are served as plain text.
- Public copies display inline only for images (except SVG), video, audio and PDF. Everything else downloads.
- Names are stripped of path separators and control characters before use in keys and headers.

Pages also send a `Content-Security-Policy` that only runs scripts from the app itself or carrying that response's nonce, and they can't be framed. Images, media and requests may go to any host, because buckets and CDNs can be anywhere.

## Server-side requests

A storage endpoint is a URL the server will call, so without limits a user could aim it at your internal network.

- Endpoints and CDN URLs must use HTTPS and can't be private, loopback or link-local addresses. Addresses are checked on every connection, so a hostname that later resolves to a private address still fails.
- `ALLOW_PRIVATE_ENDPOINTS=true` turns this off for every user. Only set it if you trust everyone with an account.

## Public copies

Publishing is opt-in per file. Before a storage can publish, a real test checks that a private object doesn't load through the CDN. The test repeats with each sync, and a failure blocks new publishing and warns the owner. Copies already published stay up.

Disabling a user removes their public copies for good. Enabling them again brings their share links back, but they have to publish again.

## What fileee doesn't do

Know these before relying on it:

- **No encryption of file contents.** Files are as private as your bucket and your provider. Use the provider's server-side encryption if you need it at rest.
- **No two-factor login, SSO or email.** Password resets go through an admin.
- **No audit log** of who viewed or downloaded what.
- **No malware scanning** of uploads.

## Before going public

- [ ] HTTPS in front, with `APP_URL` set to the `https://` address
- [ ] `SETUP_TOKEN` set in `.env`. The server won't start without it until setup is done
- [ ] Port 3000 bound to localhost, and `TRUST_PROXY` on only behind your proxy
- [ ] `ALLOW_PRIVATE_ENDPOINTS` off
- [ ] Credentials limited to one bucket
- [ ] `ENCRYPTION_KEY` and the database backed up, and stored apart
