---
name: add-rpc-procedure
description: Add or change an oRPC procedure and call it from the web app. Use when adding an API endpoint, query or mutation, or when working in packages/api.
---

1. Create `packages/api/src/routers/<feature>/<sub-feature>.ts` with one procedure, exported by name (see `routers/upload/sign-parts.ts`). A new feature also needs `routers/<feature>/_router.ts` exporting `<feature>Router`, registered in `routers/_router.ts`.
2. Start from a base in `lib/orpc.ts`: `pub` (setup complete), `authed` (signed in), `admin`. For a procedure on one storage or file, use `authed.input(...).use(requireStorage)` or `.use(requireFile)`, so the ownership check can't be forgotten.
3. Validate input with `.input(z.object({...}))`. Put a schema that a web form also needs in `schemas.ts`. Let output types infer from the handler.
4. Add a test next to it (see `routers/auth/auth.test.ts`), calling it through `browser()` from `test-utils.ts`.
5. Call it from the web app through `orpc` in `apps/web/src/lib/orpc.ts`: `ensureQueryData` in a route `loader` and `useSuspenseQuery` in the component for reads, `useMutation(orpc.x.y.mutationOptions(...))` followed by `invalidateQueries` for writes.

This repo uses oRPC v2 beta. Check https://orpc.dev/llms.txt before using an API you have not seen in this repo. v1 examples are often wrong here.
