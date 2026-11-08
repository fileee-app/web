# Installing

This gets an instance running. To put it on a public address, follow [Deploying](deploying.md) too.

## With Docker

You need Git and Docker with Compose. The image is built from source on your machine, and Compose runs Postgres beside it.

```bash
git clone <this repository> fileee
cd fileee
```

Create a `.env` file beside `docker-compose.yml`. Compose reads it on every run, so the key survives restarts and upgrades.

```bash
cat > .env <<EOF
APP_URL=http://localhost:3000
ENCRYPTION_KEY=$(openssl rand -base64 32)
SETUP_TOKEN=$(openssl rand -hex 16)
POSTGRES_PASSWORD=$(openssl rand -hex 24)
EOF
```

```bash
docker compose up -d --build
```

Open `APP_URL`. Migrations run on start. If `APP_URL` or `ENCRYPTION_KEY` is invalid, or `SETUP_TOKEN` is missing on a new instance, the container refuses to start and `docker compose logs fileee` says why.

The database lives in the `postgres-data` Docker volume. Back up `.env` now: without `ENCRYPTION_KEY`, the instance can't read its stored bucket credentials.

## First-run setup

The setup page creates the admin account, with a password of at least 12 characters. It asks for the `SETUP_TOKEN` from `.env`, so a stranger who reaches it first can't become admin.

## Connect a bucket

In **Settings > Storages**, add a storage and pick your provider. The form fills in what it can:

| Provider            | Endpoint                                     | Region      |
| ------------------- | -------------------------------------------- | ----------- |
| AWS S3              | none                                         | your region |
| Cloudflare R2       | `https://<account>.r2.cloudflarestorage.com` | `auto`      |
| Backblaze B2        | `https://s3.<region>.backblazeb2.com`        | your region |
| Wasabi              | `https://s3.<region>.wasabisys.com`          | your region |
| Tigris              | `https://t3.storage.dev`                     | `auto`      |
| DigitalOcean Spaces | `https://<region>.digitaloceanspaces.com`    | your region |
| Hetzner             | `https://<region>.your-objectstorage.com`    | your region |
| Scaleway            | `https://s3.<region>.scw.cloud`              | your region |
| Akamai (Linode)     | `https://<region>.linodeobjects.com`         | your region |
| Vultr               | `https://<region>.vultrobjects.com`          | your region |
| OVHcloud            | `https://s3.<region>.io.cloud.ovh.net`       | your region |
| MinIO               | your server's URL                            | `us-east-1` |
| S3-compatible       | your provider's URL                          | as required |

Then run the two checks the storage page offers:

1. **Connection** writes, reads and deletes a small test object, and says what to fix if a step fails.
2. **Browser access (CORS)** tests that this browser can reach the bucket directly, which uploads and previews need. **Apply for me** adds the rule if the credential allows it, and **How to set up** gives you the rule to add by hand and an IAM policy for your bucket.

An endpoint on a private address (such as MinIO on your LAN) is refused unless you add `ALLOW_PRIVATE_ENDPOINTS: "true"` to `environment` in `docker-compose.yml`. Endpoints must also use HTTPS without it.

Use a credential limited to one bucket. This AWS policy covers everything fileee does; the two CORS actions are only needed for **Apply for me**. Other providers have equivalent settings.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket", "s3:GetBucketCORS", "s3:PutBucketCORS"],
      "Resource": "arn:aws:s3:::YOUR-BUCKET"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:AbortMultipartUpload",
        "s3:ListMultipartUploadParts"
      ],
      "Resource": "arn:aws:s3:::YOUR-BUCKET/*"
    }
  ]
}
```

On Tigris, attach this policy to the access key if the connection check reports `AccessDenied`, as a bucket role alone may not be enough. **How to set up** shows it with your bucket filled in. In the [Tigris console](https://console.storage.dev), create it under **IAM Policies** with the JSON Editor, then add the key under **Manage IAM Policy > Linked Access Keys**.

## Without Docker

You need Node 24 or newer, `corepack enable` to get the pinned pnpm, and Postgres 13 or newer. The database user must be able to create the `unaccent` extension, which any database owner can.

```bash
pnpm install --frozen-lockfile
pnpm build
```

`pnpm start` doesn't read `.env`, so set its environment yourself. Keep the process supervised (systemd or similar). It applies migrations on start. `PORT` changes the port from 3000.

```bash
NODE_ENV=production \
DATABASE_URL=postgres://fileee:password@localhost:5432/fileee \
APP_URL=https://files.example.com \
ENCRYPTION_KEY=... \
pnpm start
```
