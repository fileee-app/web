import { db, shareLinks } from "@fileee/db";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { authed, requireShareLink } from "../../lib/orpc.ts";

export const revoke = authed
  .input(z.object({ linkId: z.string() }))
  .use(requireShareLink)
  .handler(async ({ context: { link } }) => {
    if (!link.revokedAt) {
      await db.update(shareLinks).set({ revokedAt: new Date() }).where(eq(shareLinks.id, link.id));
    }

    return { ok: true };
  });
