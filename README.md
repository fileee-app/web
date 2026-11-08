# fileee

A self-hosted, Google Drive-style file manager. Your files stay in S3-compatible storage you own (AWS S3, Cloudflare R2, Backblaze B2, MinIO and others). fileee keeps only metadata and encrypted credentials, and browsers upload and download directly from the bucket.

## Quick start

```bash
cat > .env <<EOF
APP_URL=http://localhost:3000
ENCRYPTION_KEY=$(openssl rand -base64 32)
SETUP_TOKEN=$(openssl rand -hex 16)
POSTGRES_PASSWORD=$(openssl rand -hex 24)
EOF
docker compose up -d --build
```

Visit `APP_URL`, complete the setup page, and connect a bucket in settings. On a public address, read [Deploying](docs/deploying.md) first: until setup is complete, whoever reaches the instance first becomes admin.

## Documentation

- [Installing](docs/installing.md): Docker or from source, first-run setup, connecting a bucket
- [Deploying](docs/deploying.md): configuration, HTTPS, upgrades, backups, recovery, public CDN links
- [How it works](docs/how-it-works.md): where data lives, uploads, sync, trash, sharing, background jobs
- [Security](docs/security.md): what's protected, what isn't, and a pre-launch checklist
- [Troubleshooting](docs/troubleshooting.md): common errors and their fixes
- [Developing](docs/developing.md): local setup, tests, migrations
- [AGENTS.md](AGENTS.md): architecture and code conventions
