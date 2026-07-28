-- ============================================================
-- 017_nba_analytics.sql — the curated NBA reference data behind
-- /analytics and the cap/contract lessons.
--
-- Same class of gap as 000/015: the tables existed only in production. On a
-- database built from the repo, `npm run build` fails outright — the
-- sitemap route enumerates players and dies on
-- `relation "nba_players" does not exist`, which aborts the export.
--
-- Rows are loaded by `npm run ingest` (scripts/nba-ingest.ts) and the
-- committed snapshot in data-seeds/; this file only owns the shape. The
-- composite unique key on nba_player_stats is required, not cosmetic:
-- lib/nba-ingest.ts upserts with ON CONFLICT(player_slug, season).
--
-- All CREATE ... IF NOT EXISTS, so it is a no-op where the tables exist.
-- ============================================================

CREATE TABLE IF NOT EXISTS nba_players (
  slug text PRIMARY KEY,
  name text NOT NULL,
  team text,
  as_of text
);

CREATE TABLE IF NOT EXISTS nba_contracts (
  player_slug text PRIMARY KEY,
  cap_hit double precision,
  years_remaining integer,
  total_remaining double precision,
  apron_status text
);

CREATE TABLE IF NOT EXISTS nba_player_stats (
  player_slug text NOT NULL,
  season text NOT NULL,
  games integer,
  minutes double precision,
  epm double precision,
  bpm double precision,
  source text NOT NULL DEFAULT 'snapshot',
  updated_at bigint,
  PRIMARY KEY (player_slug, season)
);

CREATE INDEX IF NOT EXISTS idx_nba_player_stats_slug ON nba_player_stats (player_slug);
