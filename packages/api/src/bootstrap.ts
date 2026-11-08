import { migrateDb } from "@fileee/db/migrate";
import { encryptionKey } from "@fileee/storage";
import { startBackground } from "./lib/background.ts";
import { appOrigin } from "./lib/http.ts";
import { isSetupComplete } from "./lib/orpc.ts";

/** Runs once at server start: refuses to start misconfigured, applies migrations, starts background work. */
export async function bootstrap() {
  encryptionKey();
  appOrigin();
  await migrateDb();

  // Without it, whoever reaches a new instance first becomes its admin.
  if (!process.env.SETUP_TOKEN && !(await isSetupComplete())) {
    throw new Error("SETUP_TOKEN is required until setup is complete (openssl rand -hex 16)");
  }

  startBackground();
}
