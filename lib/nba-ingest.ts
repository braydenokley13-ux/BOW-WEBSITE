/* ============================================================
 * NBA live-stat ingestion — TypeScript/Vercel-native port of the old
 * scripts/nba_ingest.py + nba_api pipeline.
 *
 * Pulls current-season impact metrics for the curated player list (the
 * players seeded from data-seeds/contracts.csv) from stats.nba.com's
 * public estimated-player-metrics endpoint, and caches them into the
 * site's SQLite database (data/bow.db, table `nba_player_stats`,
 * source='nba_api') via the same `getDb()` connection the rest of the
 * app uses (see lib/db.ts).
 *
 * The website never calls the NBA API at request time: it reads
 * whatever this module last cached (falling back to the checked-in
 * snapshot CSV), so the dashboard keeps working when stats.nba.com is
 * slow, blocked, or mid-lockout. Contracts/apron status are
 * deliberately NOT ingested here — there is no clean free API for cap
 * data, so data-seeds/contracts.csv stays the hand-maintained system
 * of record.
 *
 * Metric mapping
 * --------------
 * The model wants EPM-style impact (net points per 100 possessions vs
 * average). stats.nba.com exposes the league's own estimated player
 * metrics; we store E_NET_RATING in the `epm` column and label it in
 * the UI as the estimated plus-minus impact. If the estimated-metrics
 * endpoint is unavailable, rows keep their snapshot/BPM fallback
 * values — every failure mode here is caught and reported in the
 * returned summary rather than thrown, so a cron/CLI run (or a flaky
 * network) can never take the site down.
 *
 * This endpoint carries no BPM figure at all, so the upsert never
 * writes one: UPSERT_SQL preserves whatever bpm value the row already
 * had (COALESCE(excluded.bpm, nba_player_stats.bpm) — excluded.bpm is
 * always NULL here, so the existing column wins) instead of nulling
 * it out. That matters beyond this file: lib/tensions.ts's
 * detectMetricDisagreements() needs both epm and bpm populated on the
 * same row to flag a tracker disagreement, and a live ingest that
 * clobbered bpm on every run would make that detector permanently
 * empty.
 *
 * Player-id resolution
 * ---------------------
 * The Python original resolved stats.nba.com player ids offline via
 * nba_api's bundled static player index, then looked each id up in one
 * league-wide metrics response. That static index isn't available
 * outside the nba_api Python package, so this port collapses both
 * steps into one: the same league-wide metrics response already
 * carries PLAYER_NAME for every player, so curated players are matched
 * by normalized name (lib/slug.ts's slugify — the same function that
 * keys nba_players.slug) directly against that response. Still exactly
 * one network request per season; no behavior difference in the output
 * rows, just no separate id-lookup phase.
 *
 * Server-only (imports lib/db.ts). Node runtime only — uses node:fs
 * and node:sqlite (via getDb()) and the global `fetch`.
 * ============================================================ */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getDb } from "@/lib/db";
import { slugify } from "@/lib/slug";

const DEFAULT_CSV = path.join(process.cwd(), "data-seeds", "contracts.csv");
const STATS_API_BASE = "https://stats.nba.com/stats";

/**
 * stats.nba.com rejects requests that don't look like they came from a
 * browser hitting nba.com. These are ported from nba_api's STATS_HEADERS
 * (library/http.py) — same header set, same values where they matter.
 */
const STATS_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "x-nba-stats-origin": "stats",
  "x-nba-stats-token": "true",
  Referer: "https://www.nba.com/",
  Origin: "https://www.nba.com",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
};

export interface CuratedPlayer {
  slug: string;
  name: string;
}

/** One row of stats.nba.com's estimated-metrics resultSet, keyed by its raw column names. */
export interface EstimatedMetricsRow {
  PLAYER_ID?: number;
  PLAYER_NAME?: string;
  GP?: number;
  MIN?: number;
  E_NET_RATING?: number | null;
  [column: string]: unknown;
}

export interface IngestResult {
  season: string;
  /** curated players whose row was found in this season's league-wide metrics */
  matched: number;
  /** rows actually written to nba_player_stats (0 on dryRun or failure) */
  updated: number;
  /** curated players with no row this season (didn't play / name mismatch) */
  skipped: number;
  /** non-fatal-to-the-run problems: unreachable API, DB write failure, etc. */
  errors: string[];
}

export interface IngestOptions {
  /** fetch + compute but write nothing. */
  dryRun?: boolean;
  /** contracts.csv fallback path when the DB has no curated list yet. */
  csvPath?: string;
  /** fetch attempts before giving up (default 3, matching the Python original). */
  retries?: number;
  /** per-attempt timeout in ms (default 30_000, matching the Python original). */
  timeoutMs?: number;
  /** inject a fetch implementation (tests). Defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  /** reuse an already-resolved curated list instead of re-querying it. */
  players?: CuratedPlayer[];
}

/** NBA seasons run Oct→Jun and are labelled e.g. "2025-26". Mirrors scripts/nba_ingest.py's current_season(). */
export function currentSeason(today: Date = new Date()): string {
  const year = today.getFullYear();
  const month = today.getMonth() + 1; // 1-12
  const start = month >= 10 ? year : year - 1;
  const endYY = (start + 1) % 100;
  return `${start}-${String(endYY).padStart(2, "0")}`;
}

/**
 * Minimal CSV reader mirroring lib/db.ts's seed loader: plain CSV (no
 * quoted commas), header row + comma-separated values.
 */
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = (cells[i] ?? "").trim()));
    return row;
  });
}

/**
 * slug -> full name for the curated list. DB first (nba_players, seeded
 * from contracts.csv every time the site boots), CSV fallback for a
 * fresh clone or a DB that hasn't been created yet. Throws only if
 * neither source has anything — a genuine setup problem, not a
 * transient failure.
 */
export async function resolveCuratedPlayers(csvPath: string = DEFAULT_CSV): Promise<CuratedPlayer[]> {
  try {
    const db = getDb();
    const rows = (await db.prepare("SELECT slug, name FROM nba_players ORDER BY slug").all()) as {
      slug: string;
      name: string;
    }[];
    if (rows.length > 0) return rows.map((r) => ({ slug: r.slug, name: r.name }));
  } catch {
    // table missing / db unavailable -> fall through to the CSV
  }
  if (!existsSync(csvPath)) {
    throw new Error(`no curated list found (DB has no players and no CSV at ${csvPath})`);
  }
  const players: CuratedPlayer[] = [];
  for (const r of parseCsv(readFileSync(csvPath, "utf8"))) {
    if (!r.player) continue;
    players.push({ slug: slugify(r.player), name: r.player });
  }
  return players;
}

/**
 * One league-wide request for the NBA's estimated player metrics —
 * every player in the league for a season, in a single call. Retries
 * with exponential backoff (2^attempt seconds, same as the Python
 * original); throws only once every attempt is exhausted, so the
 * caller can decide how to degrade gracefully.
 */
export async function fetchEstimatedMetrics(
  season: string,
  opts: { retries?: number; timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<EstimatedMetricsRow[]> {
  const retries = opts.retries ?? 3;
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const doFetch = opts.fetchImpl ?? fetch;

  const url = new URL(`${STATS_API_BASE}/playerestimatedmetrics`);
  url.searchParams.set("LeagueID", "00");
  url.searchParams.set("Season", season);
  url.searchParams.set("SeasonType", "Regular Season");

  let lastErr: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await doFetch(url, { headers: STATS_HEADERS, signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const json = (await res.json()) as {
        resultSet?: { headers: string[]; rowSet: unknown[][] };
      };
      const result = json.resultSet;
      if (!result || !Array.isArray(result.rowSet) || !Array.isArray(result.headers)) {
        throw new Error("unexpected response shape: missing resultSet.headers/rowSet");
      }
      return result.rowSet.map((row) => {
        const obj: EstimatedMetricsRow = {};
        result.headers.forEach((h, i) => (obj[h] = row[i]));
        return obj;
      });
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        const waitMs = 2 ** attempt * 1000;
        await new Promise((r) => setTimeout(r, waitMs));
      }
    } finally {
      clearTimeout(timer);
    }
  }
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new Error(`could not reach stats.nba.com after ${retries} attempt(s): ${msg}`);
}

const UPSERT_SQL = `
  INSERT INTO nba_player_stats (player_slug, season, games, minutes, epm, bpm, source, updated_at)
  VALUES (?, ?, ?, ?, ?, NULL, 'nba_api', ?)
  ON CONFLICT(player_slug, season) DO UPDATE SET
    games = excluded.games,
    minutes = excluded.minutes,
    epm = excluded.epm,
    bpm = COALESCE(excluded.bpm, nba_player_stats.bpm),
    source = 'nba_api',
    updated_at = excluded.updated_at
`;

/**
 * Ingest one season for the curated player list: fetch the league-wide
 * estimated metrics, match curated players by normalized name, and
 * idempotently upsert rows into nba_player_stats. Never throws — every
 * failure mode (unresolvable curated list, unreachable API, DB write
 * failure) is caught and reported in the returned summary so the site
 * keeps serving cached/snapshot data regardless of what happens here.
 */
export async function ingestSeason(season: string, options: IngestOptions = {}): Promise<IngestResult> {
  const errors: string[] = [];

  let players: CuratedPlayer[];
  try {
    players = options.players ?? (await resolveCuratedPlayers(options.csvPath));
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return { season, matched: 0, updated: 0, skipped: 0, errors };
  }

  let metrics: EstimatedMetricsRow[];
  try {
    metrics = await fetchEstimatedMetrics(season, {
      retries: options.retries,
      timeoutMs: options.timeoutMs,
      fetchImpl: options.fetchImpl,
    });
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return { season, matched: 0, updated: 0, skipped: players.length, errors };
  }

  const byNameSlug = new Map<string, EstimatedMetricsRow>();
  for (const row of metrics) {
    const name = typeof row.PLAYER_NAME === "string" ? row.PLAYER_NAME : "";
    if (name) byNameSlug.set(slugify(name), row);
  }

  const now = Date.now();
  type Row = [string, string, number, number, number | null, number];
  const rows: Row[] = [];
  let skipped = 0;
  for (const { slug, name } of players) {
    const m = byNameSlug.get(slug);
    if (!m) {
      console.warn(`  ! ${name}: no ${season} row (hasn't played, or name mismatch) — skipped`);
      skipped++;
      continue;
    }
    const games = Number(m.GP) || 0;
    const minutesPerGame = Number(m.MIN) || 0;
    const minutes = Math.round(minutesPerGame * games * 10) / 10;
    const epm = m.E_NET_RATING == null ? null : Number(m.E_NET_RATING);
    rows.push([slug, season, games, minutes, epm, now]);
  }

  const matched = rows.length;

  if (options.dryRun) {
    for (const [slug, s, games, minutes, epm] of [...rows].sort((a, b) => a[0].localeCompare(b[0]))) {
      console.log(
        `  ${slug.padEnd(32)} ${s} gp=${String(games).padStart(3)} min=${minutes.toFixed(1).padStart(7)} epm=${epm ?? "null"}`,
      );
    }
    console.log(`dry run: ${rows.length} row(s) would be written, nothing written`);
    return { season, matched, updated: 0, skipped, errors };
  }

  try {
    const db = getDb();
    const stmt = db.prepare(UPSERT_SQL);
    for (const row of rows) (await stmt.run(...row));
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return { season, matched, updated: 0, skipped, errors };
  }

  return { season, matched, updated: rows.length, skipped, errors };
}

/**
 * Ingest multiple seasons in one run. The curated list is resolved once
 * and reused across every season (mirrors the Python --seasons flag).
 */
export async function ingestSeasons(seasons: string[], options: IngestOptions = {}): Promise<IngestResult[]> {
  let players = options.players;
  if (!players) {
    try {
      players = (await resolveCuratedPlayers(options.csvPath));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return seasons.map((season) => ({ season, matched: 0, updated: 0, skipped: 0, errors: [msg] }));
    }
  }
  const results: IngestResult[] = [];
  for (const season of seasons) {
    results.push(await ingestSeason(season, { ...options, players }));
  }
  return results;
}
