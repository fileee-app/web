---
name: change-db-schema
description: Change the database schema with Drizzle and create a migration. Use when adding or altering tables or columns, or when working in packages/db.
---

1. Edit `packages/db/src/schema.ts`. Everything exported there is re-exported from `@fileee/db`.
2. Run `pnpm db:generate` and read the generated SQL in `packages/db/drizzle/`. Flag anything that drops or rewrites data.
3. Run `pnpm db:migrate` to apply it locally.
4. Commit the schema change and the generated migration together. Never edit an existing migration.
5. Run `pnpm typecheck && pnpm test`. Tests apply all migrations to a temporary Postgres database.
