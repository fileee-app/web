import { db, files, storages } from "@fileee/db";
import { and, asc, eq, isNull } from "drizzle-orm";
import { authed } from "../../lib/orpc.ts";
import { summary } from "./columns.ts";

export const starred = authed.handler(({ context }) =>
  db
    .select(summary)
    .from(files)
    .innerJoin(storages, eq(files.storageId, storages.id))
    .where(
      and(
        eq(storages.userId, context.user.id),
        eq(files.starred, true),
        eq(files.status, "ready"),
        isNull(files.trashedAt),
      ),
    )
    .orderBy(asc(files.name))
    .limit(100),
);
