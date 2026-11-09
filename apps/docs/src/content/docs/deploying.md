---
title: Deploying
---

Start with [Installing](/installing/). This page covers what a public instance needs and how to run it over time.

Run exactly one instance. Fileee runs background jobs in-process, so replicas aren't supported. The server only handles metadata (browsers upload and download directly from the bucket), so it needs little CPU or bandwidth, and a proxy needs no body-size changes for uploads.

## Configuration

| Variable                  | Required      | Purpose                                                                                                                                  |
| ------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_URL`                 | Yes           | Public URL. Must match the browser's address exactly: it drives origin checks, CORS rules, share links, and `Secure` cookies on `https`. |
| `ENCRYPTION_KEY`          | Yes           | 32 bytes, base64 (`openssl rand -base64 32`). Encrypts stored bucket credentials.                                                        |
| `DATABASE_URL`            | Not in Docker | Postgres connection URL. Compose builds it from `POSTGRES_PASSWORD`.                                                                     |
| `POSTGRES_PASSWORD`       | Docker only   | Password for the bundled Postgres (`openssl rand -hex 24`). Only read when the database is first created.                                |
| `SETUP_TOKEN`             | Until setup   | The first-run setup page requires it. The server won't start without it until setup is done.                                             |
| `TRUST_PROXY`             | No            | `true` reads the client IP from `X-Forwarded-For`. Only use it behind a proxy that sets the header.                                      |
| `ALLOW_PRIVATE_ENDPOINTS` | No            | `true` allows bucket endpoints on private addresses or plain HTTP. Leave it off unless you run your own storage.                         |
| `PORT`                    | No            | Listen port. Defaults to 3000.                                                                                                           |

`docker-compose.yml` only passes on the variables listed in its `environment` block. Adding a value to `.env` isn't enough for `TRUST_PROXY` or `ALLOW_PRIVATE_ENDPOINTS`: uncomment or add the line there too.

## Put it behind HTTPS

Set this in `.env`:

```bash
APP_URL=https://files.example.com
```

Then in `docker-compose.yml`, uncomment `TRUST_PROXY`, and publish the port on localhost only:

```yaml
ports:
  - "127.0.0.1:3000:3000"
```

The localhost binding matters. If port 3000 stays reachable, anyone can send a forged `X-Forwarded-For` straight to it and dodge login rate limits. Docker's published ports can bypass host firewalls such as `ufw`.

Any reverse proxy works. With [Caddy](https://caddyserver.com), which handles certificates and `X-Forwarded-For` itself:

```
files.example.com {
	reverse_proxy 127.0.0.1:3000
}
```

For nginx, [nginx/fileee.conf](https://github.com/fileee-app/web/blob/main/nginx/fileee.conf) is a ready example. Get a certificate first, because nginx won't load a site whose certificate is missing. Then copy the file, change `files.example.com` to your domain in the copy, and enable it:

```bash
sudo certbot certonly --nginx -d files.example.com
sudo cp nginx/fileee.conf /etc/nginx/sites-available/fileee
sudo ln -s /etc/nginx/sites-available/fileee /etc/nginx/sites-enabled/fileee
sudo nginx -t && sudo systemctl reload nginx
```

Fileee trusts the rightmost `X-Forwarded-For` entry. Behind a chain of proxies (a CDN in front of Caddy, say), that's the outer proxy's address, so all clients would share one rate limit. Have the last proxy overwrite the header with the real client IP.

Apply changes with `docker compose up -d`, then complete the setup page with the token.

## Upgrade

Back up first: migrations only go forward, and the way to roll back is restoring a backup of the previous version.

```bash
git pull
docker compose up -d --build
```

Migrations run on start.

## Back up

Back up the database and `.env` (for `ENCRYPTION_KEY`), and store them apart. Anyone with the database and the key can decrypt your bucket credentials. Files themselves are in your buckets, so back those up with your provider.

This is safe while the app is running:

```bash
docker compose exec -T postgres pg_dump -U fileee -Fc fileee > fileee-backup.dump
```

## Restore

Keep the same `ENCRYPTION_KEY`. Stop the app, load the backup over the existing database, and start it again:

```bash
docker compose stop fileee
docker compose exec -T postgres pg_restore -U fileee -d fileee --clean --if-exists < fileee-backup.dump
docker compose start fileee
```

| What's lost      | Effect                                                                                                                                                                                    |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ENCRYPTION_KEY` | Bucket files, users and shares are unaffected. Set a new key and restart. Storages then show **Re-enter credentials**, and each owner edits theirs and enters both the key ID and secret. |
| The database     | Bucket files are unaffected. Set up again on an empty database, reconnect the buckets and sync. Users, stars, share links and the folder tree are gone.                                   |

After losing the key, public copies still waiting to be deleted from a storage that was already removed can't be reached. Their removal shows as failing, and you'd delete those by hand.

After losing the database, files Fileee uploaded appear in a **Recovered** folder under their own names. Public copies stay online with nothing tracking them, so delete them from the public location yourself.

## Recover access

There's no email. An admin resets other users' passwords in **Settings > Users**. A locked-out admin runs this, which prints a new password and signs that user out everywhere:

```bash
docker compose exec fileee pnpm admin:reset-password admin@example.com
```

## Change the address

Update `APP_URL`, then run `docker compose up -d`. CORS rules name the old origin, so re-apply the rule on each storage's **Browser access (CORS)** check. Share links already sent out keep pointing at the old address.

## Public CDN links

Files are private unless you publish them. In **Settings > Storages > Public access**, give a storage a CDN URL and a public location. Publishing copies a file there.

The CDN must reach only that location. Saving the setting, and each sync after it, tests that a private object doesn't load through the CDN, and the setting is refused if one does. Providers that expose a whole bucket through a custom domain or public setting need a separate public bucket. The settings page has a note for each provider, and the [conformance script](/developing/#test-a-storage-provider) can check one.

Set a short cache lifetime on the CDN, such as one hour. A removed file stays reachable until its cached copies expire.
