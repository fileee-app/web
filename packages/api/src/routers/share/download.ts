import { db, shareLinks } from "@fileee/db";
import { signDownload } from "@fileee/storage";
import { eq, sql } from "drizzle-orm";
import * as z from "zod";
import { pub } from "../../lib/orpc.ts";
import { passwordAttempt, signSharedFile, tokenSchema } from "../../lib/shares.ts";

/**
 * A POST from the page's button rather than a redirect on GET, so link previews and crawlers neither
 * count as downloads nor receive a URL. Always `attachment`, so HTML and SVG download instead of rendering.
 */
export const download = pub
  .input(z.object({ token: tokenSchema, password: passwordAttempt, fileId: z.string().max(64) }))
  .handler(async ({ input }) => {
    const { link, url } = await signSharedFile(input, (client, bucket, file) =>
      signDownload(client, bucket, file.objectKey, file.name),
    );

    await db
      .update(shareLinks)
      .set({ downloadCount: sql`${shareLinks.downloadCount} + 1` })
      .where(eq(shareLinks.id, link.id));

    return { url };
  });
