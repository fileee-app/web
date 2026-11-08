import { db, files } from "@fileee/db";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { withFreeName } from "../../lib/names.ts";
import { authed, requireFile } from "../../lib/orpc.ts";
import { itemNameSchema } from "../../schemas.ts";

/** Only the database changes. The object key never does; downloads use the current name. */
export const rename = authed
  .input(z.object({ fileId: z.string(), name: itemNameSchema }))
  .use(requireFile)
  .handler(({ input, context: { file } }) => {
    if (file.status === "pending" || file.trashedAt) {
      throw new ORPCError("CONFLICT", { message: "This file can't be renamed right now." });
    }

    return withFreeName(input.name, async (name) => {
      await db.update(files).set({ name }).where(eq(files.id, file.id));

      return { ...file, name };
    });
  });
