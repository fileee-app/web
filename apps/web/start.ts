// Production entry: `pnpm start`. Refuses to start misconfigured and applies pending migrations first.
import { bootstrap } from "@fileee/api/bootstrap";

await bootstrap();
// @ts-expect-error built output, has no types
await import("./.output/server/index.mjs");
