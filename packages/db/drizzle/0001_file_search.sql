-- Search index. Drizzle doesn't model these functions or the generated column, so this migration is written by hand.
-- Every file row is indexed whatever its status: search.query decides what's visible, so trash, restore and sync need no index writes.
-- Functions name their schema because pg_dump restores with an empty search_path.
CREATE EXTENSION IF NOT EXISTS unaccent;--> statement-breakpoint
-- Declared immutable, which unaccent isn't, because a generated column needs it. Changing the dictionary means reindexing.
-- Punctuation becomes spaces first, or the parser reads report_2024.pdf as one file-name token.
CREATE FUNCTION public.search_text(input text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
RETURN regexp_replace(public.unaccent('public.unaccent'::regdictionary, input), '[^[:alnum:]]+', ' ', 'g');--> statement-breakpoint
-- One search term: its words as a phrase, the last one a prefix.
CREATE FUNCTION public.search_term(term text) RETURNS tsquery
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
RETURN (
  SELECT CASE WHEN numnode(q) = 0 THEN q ELSE (q::text || ':*')::tsquery END
  FROM phraseto_tsquery('simple'::regconfig, public.search_text(term)) AS q
);--> statement-breakpoint
ALTER TABLE "file" ADD COLUMN "search" tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('simple'::regconfig, public.search_text("name")), 'A')
  || setweight(to_tsvector('simple'::regconfig, public.search_text(coalesce("metadata" ->> 'title', '') || ' ' || coalesce("metadata" ->> 'author', '') || ' ' || coalesce("metadata" ->> 'camera', ''))), 'D')
) STORED;--> statement-breakpoint
CREATE INDEX "file_search_idx" ON "file" USING gin ("search");
