import { db, shareLinks } from "@fileee/db";
import { desc, eq } from "drizzle-orm";
import * as z from "zod";
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

    return rows.map((link) => ({
      id: link.id,
      hasPassword: link.passwordHash !== null,
      expiresAt: link.expiresAt,
      revokedAt: link.revokedAt,
      downloadCount: link.downloadCount,
      createdAt: link.createdAt,
    }));
  });
