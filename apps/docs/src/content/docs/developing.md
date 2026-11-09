---
title: Developing
---

Code conventions and architecture rules are in [AGENTS.md](https://github.com/fileee-app/web/blob/main/AGENTS.md). This page gets you running.

## Set up

You need Node 24 or newer, Docker (for local Postgres and S3), and pnpm. The repo pins pnpm's version, and `corepack enable` picks it up.

```bash
cp .env.example .env
```

Set `ENCRYPTION_KEY` in `.env` to the output of `openssl rand -base64 32`, then:

```bash
pnpm install
docker compose -f docker-compose.dev.yml up -d --wait
pnpm db:migrate
pnpm dev
```

Open http://localhost:3000 and complete the setup page. Restart `pnpm dev` after changing `.env`.

## Connect local S3

In **Settings > Storages**, add a **MinIO** storage:

| Field      | Value                   |
| ---------- | ----------------------- |
| Endpoint   | `http://localhost:9000` |
| Region     | `us-east-1`             |
| Bucket     | `fileee`                |
| Access key | `minioadmin`            |
| Secret key | `minioadmin`            |

`ALLOW_PRIVATE_ENDPOINTS=true` in `.env` is what permits a localhost endpoint. The MinIO console is at http://localhost:9001, and its CORS is already open, so the browser check needs no rule.

## Check a change

Run this before finishing a change:

```bash
pnpm format && pnpm lint && pnpm typecheck && pnpm test
```

Tests that need a real bucket are skipped unless local S3 is running and you point them at it:

```bash
S3_TEST_ENDPOINT=http://localhost:9000 pnpm test
```

## Change the database

Edit the schema in `packages/db/src`, then generate and apply a migration. Never hand-edit `packages/db/drizzle/`.

```bash
pnpm db:generate
pnpm db:migrate
```

To start over with an empty database, stop the dev server, run `docker compose -f docker-compose.dev.yml down -v`, bring it back up, and run `pnpm db:migrate`. That also empties local S3.

## Test a storage provider

The conformance script runs the connection test against a real bucket. Run it for each provider before a release:

```bash
S3_ENDPOINT=https://... S3_REGION=... S3_BUCKET=... S3_ACCESS_KEY_ID=... S3_SECRET_ACCESS_KEY=... pnpm --filter @fileee/storage conformance
```

Optional variables are `S3_PREFIX` and `S3_FORCE_PATH_STYLE=true`. Add `CDN_BASE_URL` (and `PUBLIC_BUCKET` or `PUBLIC_PREFIX`) to also run the CDN safety check. Leave out `S3_ENDPOINT` for AWS S3.

## Try the production build

`pnpm start` doesn't read `.env`, so load it yourself. If setup isn't done yet, `.env` also needs a `SETUP_TOKEN`. Run this from `apps/web`, because the database path in `.env` is relative to it:

```bash
pnpm build
cd apps/web && node --env-file=../../.env start.ts
```
