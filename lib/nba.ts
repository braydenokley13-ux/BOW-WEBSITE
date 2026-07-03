/* ============================================================
 * NBA analytics reads — the server-side data access for /analytics.
 *
 * Joins the curated player list, hand-maintained contracts, and the
 * cached advanced-stat rows (snapshot CSV or nba_api ingest) into the
 * AnalyticsPlayer shape the AASV model consumes. Valuation itself is
 * pure math in lib/aasv (shared with the client for live sliders).
 *
 * Server-only. Do not import from a client component.
 * ============================================================ */

import { getDb } from "@/lib/db";
import type { AnalyticsPlayer, ApronStatus } from "@/lib/aasv";

/* eslint-disable @typescript-eslint/no-explicit-any */

function rowToPlayer(r: any): AnalyticsPlayer {
  return {
    slug: r.slug,
    name: r.name,
    team: r.team,
    capHit: Number(r.cap_hit) || 0,
    yearsRemaining: Number(r.years_remaining) || 0,
    totalRemaining: Number(r.total_remaining) || 0,
    apronStatus: (["below", "first", "second"].includes(r.apron_status) ? r.apron_status : "below") as ApronStatus,
    season: r.season ?? "",
    games: Number(r.games) || 0,
    minutes: Number(r.minutes) || 0,
    epm: r.epm == null ? null : Number(r.epm),
    bpm: r.bpm == null ? null : Number(r.bpm),
    statSource: r.source ?? "snapshot",
  };
}

/** Each player joined with his contract and latest-season stat row. */
const PLAYER_SELECT = `
  SELECT p.slug, p.name, p.team, c.cap_hit, c.years_remaining, c.total_remaining, c.apron_status,
         s.season, s.games, s.minutes, s.epm, s.bpm, s.source
  FROM nba_players p
  JOIN nba_contracts c ON c.player_slug = p.slug
  LEFT JOIN nba_player_stats s ON s.player_slug = p.slug
    AND s.season = (SELECT MAX(season) FROM nba_player_stats WHERE player_slug = p.slug)
`;

/** Full curated list, highest cap hit first. */
export function getAnalyticsPlayers(): AnalyticsPlayer[] {
  const rows = getDb().prepare(`${PLAYER_SELECT} ORDER BY c.cap_hit DESC`).all() as any[];
  return rows.map(rowToPlayer);
}

export function getAnalyticsPlayer(slug: string): AnalyticsPlayer | null {
  const row = getDb().prepare(`${PLAYER_SELECT} WHERE p.slug = ?`).get(slug) as any;
  return row ? rowToPlayer(row) : null;
}

/** Resolve a set of slugs (article embeds); unknown slugs are dropped. */
export function getAnalyticsPlayersBySlugs(slugs: string[]): AnalyticsPlayer[] {
  if (slugs.length === 0) return [];
  const ph = slugs.map(() => "?").join(", ");
  const rows = getDb().prepare(`${PLAYER_SELECT} WHERE p.slug IN (${ph})`).all(...slugs) as any[];
  const bySlug = new Map(rows.map((r) => [r.slug as string, rowToPlayer(r)]));
  // Preserve the order the author asked for.
  return slugs.map((s) => bySlug.get(s)).filter((p): p is AnalyticsPlayer => Boolean(p));
}

/** Freshness readout for the admin data-status strip. */
export interface StatsFreshness {
  players: number;
  liveRows: number;
  snapshotRows: number;
  lastUpdated: number | null;
  season: string | null;
}

export function getStatsFreshness(): StatsFreshness {
  const db = getDb();
  const players = (db.prepare("SELECT COUNT(*) AS n FROM nba_players").get() as any).n as number;
  const agg = db
    .prepare(
      `SELECT
         SUM(CASE WHEN source = 'nba_api' THEN 1 ELSE 0 END) AS live,
         SUM(CASE WHEN source != 'nba_api' THEN 1 ELSE 0 END) AS snap,
         MAX(updated_at) AS last, MAX(season) AS season
       FROM nba_player_stats`,
    )
    .get() as any;
  return {
    players,
    liveRows: Number(agg?.live) || 0,
    snapshotRows: Number(agg?.snap) || 0,
    lastUpdated: agg?.last ? Number(agg.last) : null,
    season: agg?.season ?? null,
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */
