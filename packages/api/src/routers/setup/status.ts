import { appSettings, db } from "@fileee/db";
import { base } from "../../lib/orpc.ts";

/** The app name is public because the login page needs it. It's the only setting exposed without signing in. */
export const status = base.handler(async () => {
  const [settings] = await db.select().from(appSettings).limit(1);

  return {
    complete: Boolean(settings),
    appName: settings?.appName || "Fileee",
    setupTokenRequired: !settings && Boolean(process.env.SETUP_TOKEN),
  };
});
