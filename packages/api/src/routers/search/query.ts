import { db, files, storages } from "@fileee/db";
import {
  and,
  eq,
  getTableColumns,
  gte,
  inArray,
  ilike,
  isNull,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";
import * as z from "zod";
import { authed } from "../../lib/orpc.ts";
import { withThumbnailUrls } from "../../lib/previews.ts";
import { FILE_TYPES, searchInput } from "../../schemas.ts";

const PAGE = 50;
const DAY = 86_400_000;

const TYPE_PATTERNS: Record<(typeof FILE_TYPES)[number], string[]> = {
  image: ["image/%"],
  video: ["video/%"],
  audio: ["audio/%"],
  pdf: ["application/pdf"],
  document: [
    "application/msword",
    "application/vnd.ms-%",
    "application/vnd.openxmlformats-%",
    "application/vnd.oasis.opendocument.%",
  ],
  text: ["text/%", "application/json", "application/xml", "application/yaml"],
  archive: [
    "application/zip",
    "application/x-zip-compressed",
    "application/gzip",
    "application/x-tar",
    "application/x-7z-compressed",
    "application/x-rar-compressed",
    "application/vnd.rar",
  ],
};

/**
 * Each term goes to `search_term` as a parameter, so nothing the user types is tsquery syntax. Each is a prefix, and all must match.
 * Terms with no letters or digits would tokenize to nothing, so they're dropped.
 */
export const toTerms = (q: string) =>
  q.split(/[\s\p{Cc}]+/u).filter((term) => /[\p{L}\p{N}\p{Co}]/u.test(term));

export const query = authed
  .input(
    searchInput.extend({
      cursor: z.object({ score: z.number(), id: z.string().max(64) }).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const terms = toTerms(input.q);
    const owned = await db.select().from(storages).where(eq(storages.userId, context.user.id));
    const searched = owned.filter((s) => !input.storageId || s.id === input.storageId);

    // Text that's only punctuation matches nothing, rather than falling through to everything.
    if (!searched.length || (input.q && !terms.length)) return { items: [], nextCursor: undefined };

    const match = sql.join(
      terms.map((term) => sql`search_term(${term})`),
      sql` && `,
    );

    // Sorts ascending. The name has weight A, so a match there beats one in the metadata. float8 so a cursor round-trips exactly.
    const score = terms.length
      ? sql<number>`(-ts_rank(${files}.search, ${match}))::float8`
      : sql<number>`(-extract(epoch from ${files.modifiedAt}) * 1000)::float8`;

    const { cursor, type, minSize, maxSize, modifiedFrom, modifiedTo } = input;

    const visible = and(
      inArray(
        files.storageId,
        searched.map((s) => s.id),
      ),
      // Missing files stay findable, as they do in their folder: the row is all that's left of them, and the UI marks them.
      inArray(files.status, ["ready", "missing"]),
      isNull(files.trashedAt),
      type && or(...TYPE_PATTERNS[type].map((pattern) => ilike(files.mimeType, pattern))),
      minSize === undefined ? undefined : gte(files.size, minSize),
      maxSize === undefined ? undefined : lte(files.size, maxSize),
      // shortcut: days are UTC so the server and the browser agree on a URL, switch if users near midnight notice.
      modifiedFrom ? gte(files.modifiedAt, new Date(modifiedFrom)) : undefined,
      modifiedTo ? lt(files.modifiedAt, new Date(Date.parse(modifiedTo) + DAY)) : undefined,
      // shortcut: scores shift as the index changes, so a page can rarely repeat or skip a file during a big sync; harmless for a search list.
      cursor && sql`(${score}, ${files.id}) > (${cursor.score}::float8, ${cursor.id})`,
      terms.length ? sql`${files}.search @@ (${match})` : undefined,
    );

    const rows = await db
      .select({ ...getTableColumns(files), score })
      .from(files)
      .where(visible)
      .orderBy(sql`${score}`, files.id)
      .limit(PAGE + 1);

    const page = rows.slice(0, PAGE);

    const signed = await Promise.all(
      searched.map((storage) =>
        withThumbnailUrls(
          storage,
          page.filter((row) => row.storageId === storage.id),
        ),
      ),
    );

    const byId = new Map(signed.flat().map((row) => [row.id, row]));
    const last = page.at(-1);

    return {
      items: page.map((row) => ({
        ...byId.get(row.id)!,
        storageName: searched.find((s) => s.id === row.storageId)!.name,
      })),
      nextCursor: rows.length > PAGE ? { score: last!.score, id: last!.id } : undefined,
    };
  });
