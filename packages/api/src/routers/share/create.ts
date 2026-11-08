import { randomBytes } from "node:crypto";
import { db, shareLinks } from "@fileee/db";
import { encryptToken } from "@fileee/storage";
import { ORPCError } from "@orpc/server";
import * as z from "zod";
import { hashToken } from "../../auth/session.ts";
import { appOrigin } from "../../lib/http.ts";
import { authed, requireShareTarget } from "../../lib/orpc.ts";
import { newPasswordHash } from "../../lib/shares.ts";
import { SHARE_EXPIRY_HOURS, shareInput } from "../../schemas.ts";

export const create = authed
  .input(
    shareInput.extend({
      fileId: z.string().max(64).optional(),
      folderId: z.string().max(64).optional(),
    }),
  )
  .use(requireShareTarget)
  .handler(async ({ input, context: { targetFile, targetFolder } }) => {
    if (
      targetFile ? targetFile.status !== "ready" || targetFile.trashedAt : targetFolder!.trashedAt
    ) {
      throw new ORPCError("CONFLICT", { message: "This item can't be shared right now." });
    }

    const token = randomBytes(32).toString("base64url");
    const hours = SHARE_EXPIRY_HOURS[input.expiry];

    const [link] = await db
      .insert(shareLinks)
      .values({
        fileId: targetFile?.id,
        folderId: targetFolder?.id,
        tokenHash: hashToken(token),
        encryptedToken: await encryptToken(token),
        passwordHash: await newPasswordHash(input.password),
        expiresAt: hours === null ? null : new Date(Date.now() + hours * 3_600_000),
      })
      .returning({ id: shareLinks.id });

    return { id: link!.id, url: `${appOrigin()}/share/${token}` };
  });
