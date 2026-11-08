import { searchInput } from "@fileee/api/schemas";
import type * as z from "zod";
import { orpc } from "../../lib/orpc.ts";

const FIELDS = Object.keys(searchInput.shape) as (keyof Search)[];

export type Search = z.input<typeof searchInput>;

/**
 * A hand-edited link shouldn't be an error page, so anything invalid just means no search.
 * The router keeps raw params beside what this returns, so a rejected one has to be overwritten.
 */
export function parseSearch(raw: Record<string, unknown>): Search {
  // Search params are parsed as JSON, so ?q=2024 arrives as a number.
  const parsed = searchInput.safeParse({ ...raw, q: raw.q === undefined ? "" : String(raw.q) });
  const none = Object.fromEntries(FIELDS.map((field) => [field, undefined]));
  const search = parsed.success ? parsed.data : { q: "" };

  return { ...none, ...search, q: search.q || undefined };
}

export const isEmpty = (search: Search) => FIELDS.every((field) => search[field] === undefined);

export const searchOptions = (search: Search) =>
  orpc.search.query.infiniteOptions({
    input: (cursor: { score: number; id: string } | undefined) => ({ ...search, cursor }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor,
    // Files change on other pages, and this page has to be right when you come back to it.
    staleTime: 0,
  });
