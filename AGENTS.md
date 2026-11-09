# fileee

pnpm + Turborepo monorepo. Node >= 24.

## Layout

- `apps/web`: TanStack Start (React) app. Serves the oRPC API at `/api/rpc`.
- `apps/docs`: Astro Starlight docs site. Pages are Markdown in `src/content/docs/`; add new ones to `sidebar` in `astro.config.ts`.
- `packages/api`: oRPC router (`@fileee/api`). Validates all input. Server-only, except `@fileee/api/schemas`.
- `packages/storage`: S3 client, presigning, connection tests and credential encryption (`@fileee/storage`). Server-only.
- `packages/ui`: shadcn/ui components and Tailwind theme (`@fileee/ui`). Browser-safe; no app logic.
- `packages/db`: Drizzle schema and client on Postgres (`@fileee/db`). Server-only.

Dependencies point one way: `web -> api -> db`, `api -> storage`, and `web -> ui`. Internal packages export TypeScript source and have no build step.

## Setup

```bash
cp .env.example .env
pnpm install
docker compose -f docker-compose.dev.yml up -d
pnpm db:migrate
```

## API layout

```
packages/api/src/
  routers/
    _router.ts            # combines every feature router; the TanStack Start server imports this
    <feature>/
      _router.ts          # exports <feature>Router
      <sub-feature>.ts    # one procedure per file, e.g. routers/upload/sign-parts.ts
  lib/                    # code shared across routers (base procedures and middleware in lib/orpc.ts)
  auth/                   # passwords, sessions, rate limits
  schemas.ts              # Zod only, browser-safe, shared with web forms
```

## Background work

Jobs live in the `job` table and run in-process (`packages/api/src/lib/jobs.ts`). Only one job runs at a time per storage, and leases let a job cut off by a restart be picked up again. Timers start in `start.ts` in production and on the first RPC call in dev (`lib/background.ts`).

Public copies (`public_file`, `lib/public.ts`) stay public until their object is deleted, so a row outlives its file, storage and user, and only the `unpublish` job removes it. Retire copies in the same transaction as whatever causes it, then call `runJobs`. Deleting a storage or user needs `detachCopies` first, so the job keeps a way to reach the bucket.

## Web conventions

- Routes: files in `apps/web/src/routes/` hold only `createFileRoute` config (loader, head, guards). The page and its sub-components live in `apps/web/src/modules/<route>/`, one component per file; pages read params and context with `getRouteApi`, never by importing from `routes/`. Components used by more than one route stay in `apps/web/src/components/`.
- Component folders: a component with its own sub-components gets a folder named after it, with the main component at `<name>/<name>.tsx` and its sub-components beside it, as in `apps/web/src/components/browser/preview-dialog/`. Import by full file path; no `index.ts` barrels.
- Forms: `@tanstack/react-form` with `validators: { onChange: schema }`, never `onBlur` validators, built from shadcn `Field` parts as in `apps/web/src/components/form-fields.tsx`.
- Data: `@tanstack/react-query` through `orpc` in `apps/web/src/lib/orpc.ts` (`queryOptions`, `mutationOptions`, `infiniteOptions`). Route loaders call `ensureQueryData`; components call `useSuspenseQuery`. Route guards use `fetchQuery`, so they respect staleness and invalidation.
- Mutation errors toast globally from `apps/web/src/router.tsx`; don't add per-form error toasts.
- Uploads go directly to the bucket with presigned URLs (`apps/web/src/lib/uploads.ts`). The server never carries file bytes.

## Commands

Run from the repo root:

```bash
pnpm dev            # http://localhost:3000, docs on http://localhost:4321
pnpm build
pnpm typecheck
pnpm test
pnpm lint           # oxlint
pnpm format         # oxfmt (write); format:check to verify
pnpm db:generate    # create a migration from schema changes
pnpm db:migrate     # apply migrations
pnpm start          # production server, after pnpm build
```

Local Postgres and S3: `docker compose -f docker-compose.dev.yml up -d`. Tests need that Postgres (or `TEST_DATABASE_URL`) and make a database per test file. API tests that need S3 run when `S3_TEST_ENDPOINT=http://localhost:9000` is set.

Before finishing a change, run `pnpm format && pnpm lint && pnpm typecheck && pnpm test`.

## Rules

- oRPC is pinned to an exact v2 beta. Follow the v2 docs, not v1 examples: https://orpc.dev/llms.txt
- Other docs: https://tanstack.com/llms.txt, https://orm.drizzle.team/llms.txt
- From the web app, call procedures only through `client` or `orpc` in `apps/web/src/lib/orpc.ts`. They run in-process during SSR and over HTTP in the browser.
- Route loaders run on both server and client. Never import `@fileee/db` from `apps/web`, and only use `@fileee/api` values in server-only branches or server routes. `@fileee/api/schemas` is the exception: it holds only Zod schemas and is safe in the browser.
- Validate every procedure's input with Zod in `packages/api`.
- Inside a `db.transaction` callback, only use its `tx`. Transactions take turns through an advisory lock (`packages/db/src/index.ts`), so keep them short. A failed statement aborts the whole transaction, so anything that catches one and carries on (such as `withFreeName`) needs `tx.transaction` for a savepoint.
- Search is the generated `file.search` column, which Drizzle doesn't model (`packages/db/drizzle/0001_file_search.sql`). Migrations touching the columns it reads must keep it in step. Hand-written SQL goes in a migration from `drizzle-kit generate --custom`.
- Columns are camelCase, so raw SQL must quote them (`"trashedAt"`). Prefer `${table.column}`. `user` is a reserved word; use `${users}`.
- Never hand-edit `apps/web/src/routeTree.gen.ts` or `packages/db/drizzle/`. Both are generated.
- Add shadcn components from the repo root with `pnpm dlx shadcn@latest add <name> -c apps/web`. They land in `packages/ui/src/components`; import them as `@fileee/ui/components/<name>`. Theme tokens live in `packages/ui/src/styles/globals.css`.
- Prefer existing dependencies and platform features. Do not add wrappers or options nobody needs yet.

## Skills and agents

- Project skills are in `.claude/skills/`. `pnpm-*` entries there are links to skills shipped by dependencies, created by `pnpm install`; do not edit them.
- `.claude/agents/reviewer.md` reviews a change against these rules.
