import { appSettings, db } from "@fileee/db";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { admin } from "../../lib/orpc.ts";
import { appNameSchema } from "../../schemas.ts";

export const update = admin
  .input(z.object({ appName: appNameSchema }))
  .handler(async ({ input }) => {
    await db
      .update(appSettings)
      .set({ appName: input.appName || null })
      .where(eq(appSettings.id, 1));

    return { ok: true };
  });
