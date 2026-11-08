import { db, shareLinks } from "@fileee/db";
import { decryptToken } from "@fileee/storage";
import { desc, eq } from "drizzle-orm";
import * as z from "zod";
import { appOrigin } from "../../lib/http.ts";
import { authed, requireShareTarget } from "../../lib/orpc.ts";

export const list = authed
  .input(z.object({ fileId: z.string().optional(), folderId: z.string().optional() }))
  .use(requireShareTarget)
  .handler(async ({ context: { targetFile, targetFolder } }) => {
    const rows = await db
      .select()
      .from(shareLinks)
      .where(
        targetFile
          ? eq(shareLinks.fileId, targetFile.id)
          : eq(shareLinks.folderId, targetFolder!.id),
      )
      .orderBy(desc(shareLinks.createdAt));

    const now = new Date();

    return Promise.all(
      rows.map(async (link) => {
        const live = !link.revokedAt && (!link.expiresAt || link.expiresAt > now);

        return {
          id: link.id,
          url:
            live && link.encryptedToken
              ? `${appOrigin()}/share/${await decryptToken(link.encryptedToken)}`
              : null,
          hasPassword: link.passwordHash !== null,
          expiresAt: link.expiresAt,
          revokedAt: link.revokedAt,
          downloadCount: link.downloadCount,
          createdAt: link.createdAt,
        };
      }),
    );
  });
