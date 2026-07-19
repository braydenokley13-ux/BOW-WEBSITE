/* ============================================================
 * Ledger store — I/O for the Open Ledger (lib/ledger.ts is the math).
 *
 * One snapshot per UTC day, taken after the nightly ingest (the cron
 * route calls recordDailySnapshot) and lazily on first ledger read of
 * the day, so the ledger stays alive in dev and on days the cron
 * missed. Snapshots live in SQLite (fast reads within a warm
 * instance) and are mirrored to Vercel Blob (lib/blob-mirror.ts) so
 * history survives the serverless filesystem reset that research/07
 * flagged; an empty table rehydrates from the mirror before serving.
 *
 * Server-only. Do not import from a client component.
 * ============================================================ */

import { getDb } from "@/lib/db";
import { getAnalyticsPlayers, getAllPlayerSeasonHistories } from "@/lib/nba";
import { DEFAULT_ASSUMPTIONS } from "@/lib/aasv";
import {
  buildLedgerSnapshot,
  eventsFromHistory,
  type LedgerEvent,
  type LedgerSnapshot,
} from "@/lib/ledger";
import { blobDelete, blobGetJson, blobList, blobMirrorEnabled, blobPutJson } from "@/lib/blob-mirror";

/** Days of history kept, in SQLite and in the mirror alike. */
const MAX_SNAPSHOTS = 90;

const BLOB_PREFIX = "ledger/";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Table creation lives here (not lib/db.ts's schema block) on purpose:
 * existing deployments already have a bow.db without this table, and the
 * project has no migration runner — CREATE IF NOT EXISTS on first touch
 * is the pattern that works on both fresh and existing files.
 */
async function ensureTable(): Promise<void> {
  (await getDb().exec(`CREATE TABLE IF NOT EXISTS ledger_snapshots (
    day TEXT PRIMARY KEY,
    taken_at INTEGER NOT NULL,
    season TEXT NOT NULL DEFAULT '',
    payload TEXT NOT NULL
  )`));
}

function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function rowToSnapshot(r: any): LedgerSnapshot | null {
  try {
    const parsed = JSON.parse(r.payload) as LedgerSnapshot;
    return parsed && typeof parsed === "object" && parsed.players ? parsed : null;
  } catch {
    return null;
  }
}

/** All stored snapshots, oldest first (the order eventsFromHistory wants). */
async function readHistory(): Promise<LedgerSnapshot[]> {
  (await ensureTable());
  const rows = (await getDb().prepare("SELECT payload FROM ledger_snapshots ORDER BY taken_at ASC").all()) as any[];
  return rows.map(rowToSnapshot).filter((s): s is LedgerSnapshot => s !== null);
}

async function insertSnapshot(snapshot: LedgerSnapshot): Promise<void> {
  (await ensureTable());
  const db = getDb();
  (await db.prepare(`INSERT INTO ledger_snapshots (day, taken_at, season, payload) VALUES (?, ?, ?, ?)
    ON CONFLICT (day) DO UPDATE SET taken_at = excluded.taken_at, season = excluded.season, payload = excluded.payload`).run(
        utcDay(snapshot.takenAt),
        snapshot.takenAt,
        snapshot.season,
        JSON.stringify(snapshot),
      ));
  (await db.prepare(
        `DELETE FROM ledger_snapshots WHERE day NOT IN (
       SELECT day FROM ledger_snapshots ORDER BY taken_at DESC LIMIT ?
     )`,
      ).run(MAX_SNAPSHOTS));
}

/* ---------------- the Blob mirror ---------------- */

async function mirrorSnapshot(snapshot: LedgerSnapshot): Promise<void> {
  if (!blobMirrorEnabled()) return;
  await blobPutJson(`${BLOB_PREFIX}${utcDay(snapshot.takenAt)}.json`, snapshot);
  // Prune the mirror to the same retention window as the table.
  const entries = await blobList(BLOB_PREFIX);
  if (entries.length > MAX_SNAPSHOTS) {
    await blobDelete(entries.slice(0, entries.length - MAX_SNAPSHOTS).map((e) => e.url));
  }
}

/** Cold start with an empty table → pull the history back from the mirror. */
async function rehydrateFromMirror(): Promise<void> {
  if (!blobMirrorEnabled()) return;
  (await ensureTable());
  const count = (await getDb().prepare("SELECT COUNT(*) AS n FROM ledger_snapshots").get()) as any;
  if (Number(count?.n) > 0) return;
  const entries = await blobList(BLOB_PREFIX);
  for (const entry of entries.slice(-MAX_SNAPSHOTS)) {
    const snapshot = await blobGetJson<LedgerSnapshot>(entry.url);
    if (snapshot?.players && snapshot.takenAt) (await insertSnapshot(snapshot));
  }
}

/* ---------------- public surface ---------------- */

/** Freeze today's model read. Idempotent per UTC day unless `force`. */
export async function recordDailySnapshot(opts: { force?: boolean } = {}): Promise<{ snapshot: LedgerSnapshot; events: LedgerEvent[] } | null> {
  await rehydrateFromMirror();
  const today = utcDay(Date.now());
  (await ensureTable());
  const existing = (await getDb().prepare("SELECT day FROM ledger_snapshots WHERE day = ?").get(today)) as any;
  if (existing && !opts.force) return null;

  const players = (await getAnalyticsPlayers());
  if (players.length === 0) return null; // never freeze an unseeded database
  const snapshot = buildLedgerSnapshot(
    { players, histories: (await getAllPlayerSeasonHistories()), assumptions: DEFAULT_ASSUMPTIONS },
    Date.now(),
    players[0].season,
  );
  (await insertSnapshot(snapshot));
  await mirrorSnapshot(snapshot);

  const history = (await readHistory());
  const events = eventsFromHistory(history);
  return { snapshot, events: events.filter((e) => e.at === snapshot.takenAt) };
}

/**
 * The full event stream, newest day first. Takes today's snapshot
 * lazily if the cron hasn't yet, so the first visitor of the day is
 * the one who turns the page of the ledger.
 */
export async function getLedgerEvents(): Promise<LedgerEvent[]> {
  await recordDailySnapshot();
  return eventsFromHistory((await readHistory()));
}

/**
 * Synchronous event read over whatever history is already in SQLite —
 * no daily snapshot, no mirror rehydrate. For callers that live inside
 * sync read layers (the weekly challenge) and can tolerate seeing the
 * ledger as of the last page-turn.
 */
export async function getLedgerEventsSync(): Promise<LedgerEvent[]> {
  return eventsFromHistory((await readHistory()));
}

/** How many days of history the ledger currently holds. */
export async function getLedgerDepth(): Promise<number> {
  (await ensureTable());
  const row = (await getDb().prepare("SELECT COUNT(*) AS n FROM ledger_snapshots").get()) as any;
  return Number(row?.n) || 0;
}

/* eslint-enable @typescript-eslint/no-explicit-any */
