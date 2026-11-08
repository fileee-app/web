---
name: add-workspace-package
description: Add a new app or shared package to the monorepo. Use when creating a folder under apps/ or packages/.
---

1. Create `packages/<name>/package.json` (or `apps/<name>/`) named `@fileee/<name>`, with `"private": true` and `"type": "module"`. Copy `packages/db/package.json` as a starting point.
2. Library packages export source directly: `"exports": { ".": "./src/index.ts" }`, no build step.
3. Add a `tsconfig.json` extending `../../tsconfig.base.json` and a `"typecheck": "tsc"` script. Turborepo discovers scripts named `dev`, `build`, `typecheck` and `test`; add any new task name to `turbo.json`.
4. Add it to a consumer with `pnpm --filter @fileee/<consumer> add '@fileee/<name>@workspace:*'`.
5. Update the Layout section of `AGENTS.md`.
