import { db, users } from "@fileee/db";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { previewOf } from "../../lib/mime.ts";
import { authed, requireFile } from "../../lib/orpc.ts";

/** Only ever the owner: metadata can hold GPS coordinates, so never reuse this for share links. */
export const get = authed
  .input(z.object({ fileId: z.string() }))
  .use(requireFile)
  .handler(async ({ context: { file } }) => {
    const [uploader] = file.uploaderId
      ? await db.select({ name: users.name }).from(users).where(eq(users.id, file.uploaderId))
      : [];

    return {
      ...file,
      uploaderName: uploader?.name ?? null,
      previewKind: previewOf(file.name).kind,
    };
  });
