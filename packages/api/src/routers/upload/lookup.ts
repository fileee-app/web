import { db, uploads } from "@fileee/db";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";

export async function findUpload(fileId: string) {
  const [upload] = await db.select().from(uploads).where(eq(uploads.fileId, fileId));

  if (!upload) throw new ORPCError("CONFLICT", { message: "This upload is no longer active." });

  return upload;
}
