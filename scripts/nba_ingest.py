#!/usr/bin/env python3
"""
BOW NBA analytics — live advanced-stat ingestion.

Pulls current-season impact metrics for the curated player list (the
players seeded from data-seeds/contracts.csv) from stats.nba.com via
the `nba_api` wrapper, and caches them into the site's SQLite database
(data/bow.db, table `nba_player_stats`, source='nba_api').

The website never calls the NBA API at request time: it reads whatever
this script last cached (falling back to the checked-in snapshot CSV),
so the dashboard keeps working when stats.nba.com is slow, blocked, or
mid-lockout. Contracts/apron status are deliberately NOT ingested —
there is no clean free API for cap data, so data-seeds/contracts.csv
stays the hand-maintained system of record.

Metric mapping
--------------
The model wants EPM-style impact (net points per 100 possessions vs
average). stats.nba.com exposes the league's own estimated player
metrics; we store E_NET_RATING in the `epm` column and label it in the
UI as the estimated plus-minus impact. If the estimated-metrics
endpoint is unavailable, rows keep their snapshot/BPM fallback values.

Usage
-----
    pip install nba_api          # one-time
    python3 scripts/nba_ingest.py                 # current season
    python3 scripts/nba_ingest.py --season 2025-26
    python3 scripts/nba_ingest.py --seasons 2023-24,2024-25,2025-26  # backfill multiple seasons in one run
    python3 scripts/nba_ingest.py --dry-run       # fetch + print, no writes

Safe to re-run any time (idempotent upserts); wire it to cron for a
nightly refresh. Run from the repo root, or pass --db/--csv.
"""

from __future__ import annotations

import argparse
import csv
import re
import sqlite3
import sys
import time
import unicodedata
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DB = REPO_ROOT / "data" / "bow.db"
DEFAULT_CSV = REPO_ROOT / "data-seeds" / "contracts.csv"

# Mirrors the app schema (lib/db.ts) so the script can run before the
# site has ever booted (e.g. a fresh clone doing data work first).
STATS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS nba_player_stats (
  player_slug TEXT NOT NULL,
  season TEXT NOT NULL,
  games INTEGER NOT NULL DEFAULT 0,
  minutes REAL NOT NULL DEFAULT 0,
  epm REAL,
  bpm REAL,
  source TEXT NOT NULL DEFAULT 'snapshot',
  updated_at INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (player_slug, season)
)
"""

UPSERT_SQL = """
INSERT INTO nba_player_stats (player_slug, season, games, minutes, epm, bpm, source, updated_at)
VALUES (?, ?, ?, ?, ?, NULL, 'nba_api', ?)
ON CONFLICT(player_slug, season) DO UPDATE SET
  games = excluded.games,
  minutes = excluded.minutes,
  epm = excluded.epm,
  source = 'nba_api',
  updated_at = excluded.updated_at
"""


def slugify(name: str) -> str:
    """Must match lib/slug.ts so python rows land on the same players."""
    folded = unicodedata.normalize("NFKD", name)
    folded = "".join(c for c in folded if not unicodedata.combining(c))
    folded = folded.lower()
    folded = re.sub(r"['’.]", "", folded)
    folded = re.sub(r"[^a-z0-9]+", "-", folded)
    return folded.strip("-")


def current_season(today: date | None = None) -> str:
    """NBA seasons run Oct→Jun and are labelled '2025-26'."""
    d = today or date.today()
    start = d.year if d.month >= 10 else d.year - 1
    return f"{start}-{(start + 1) % 100:02d}"


def curated_players(db_path: Path, csv_path: Path) -> dict[str, str]:
    """slug -> full name for the curated list (DB first, CSV fallback)."""
    if db_path.exists():
        try:
            con = sqlite3.connect(db_path)
            rows = con.execute("SELECT slug, name FROM nba_players ORDER BY slug").fetchall()
            con.close()
            if rows:
                return {slug: name for slug, name in rows}
        except sqlite3.Error:
            pass  # table missing → fall through to CSV
    if not csv_path.exists():
        sys.exit(f"error: no curated list found (checked {db_path} and {csv_path})")
    with open(csv_path, newline="", encoding="utf-8") as f:
        return {slugify(r["player"]): r["player"] for r in csv.DictReader(f) if r.get("player")}


def fetch_estimated_metrics(season: str, retries: int = 3):
    """League-wide estimated metrics: one request covers every player."""
    try:
        from nba_api.stats.endpoints import playerestimatedmetrics
    except ImportError:
        sys.exit(
            "error: the nba_api package is not installed.\n"
            "       pip install nba_api\n"
            "       (the site keeps serving the cached/snapshot stats meanwhile)"
        )

    last_err: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            resp = playerestimatedmetrics.PlayerEstimatedMetrics(
                season=season, season_type="Regular Season", timeout=30
            )
            data = resp.get_dict()["resultSet"]
            headers = data["headers"]
            return [dict(zip(headers, row)) for row in data["rowSet"]]
        except Exception as e:  # network hiccups, throttling, schema drift
            last_err = e
            wait = 2**attempt
            print(f"  attempt {attempt}/{retries} failed ({e}); retrying in {wait}s", file=sys.stderr)
            time.sleep(wait)
    sys.exit(f"error: could not reach stats.nba.com after {retries} attempts: {last_err}")


def resolve_player_ids(names: dict[str, str]) -> dict[str, int]:
    """slug -> stats.nba.com player id, via nba_api's offline static index."""
    from nba_api.stats.static import players as static_players

    ids: dict[str, int] = {}
    for slug, name in names.items():
        matches = static_players.find_players_by_full_name(name)
        active = [m for m in matches if m.get("is_active")] or matches
        if active:
            ids[slug] = active[0]["id"]
        else:
            print(f"  ! no stats.nba.com id for '{name}' — skipped", file=sys.stderr)
    return ids


def ingest_season(season: str, players: dict[str, str], ids: dict[str, int]) -> list[tuple]:
    """Fetch + shape one season's rows for the curated player list."""
    print(f"fetching league estimated metrics for {season} …")
    metrics = fetch_estimated_metrics(season)
    by_id = {row["PLAYER_ID"]: row for row in metrics}

    rows = []
    now_ms = int(time.time() * 1000)
    for slug, pid in ids.items():
        m = by_id.get(pid)
        if m is None:
            print(f"  ! {players[slug]}: no {season} row (hasn't played?) — skipped", file=sys.stderr)
            continue
        games = int(m.get("GP") or 0)
        # MIN in this endpoint is minutes per game; the model wants totals.
        minutes = round(float(m.get("MIN") or 0.0) * games, 1)
        epm = m.get("E_NET_RATING")
        rows.append((slug, season, games, minutes, None if epm is None else float(epm), now_ms))
    return rows


def main() -> None:
    ap = argparse.ArgumentParser(description="Cache curated-player advanced stats from stats.nba.com into SQLite.")
    ap.add_argument("--season", default=current_season(), help="season label, e.g. 2025-26 (default: current)")
    ap.add_argument(
        "--seasons",
        help="comma-separated season labels to backfill in one run, e.g. 2023-24,2024-25,2025-26 (overrides --season)",
    )
    ap.add_argument("--db", type=Path, default=DEFAULT_DB, help=f"SQLite path (default {DEFAULT_DB})")
    ap.add_argument("--csv", type=Path, default=DEFAULT_CSV, help="contracts.csv fallback for the curated list")
    ap.add_argument("--dry-run", action="store_true", help="fetch and print, write nothing")
    args = ap.parse_args()

    seasons = [s.strip() for s in args.seasons.split(",") if s.strip()] if args.seasons else [args.season]

    players = curated_players(args.db, args.csv)
    print(f"curated list: {len(players)} players · season(s) {', '.join(seasons)}")

    ids = resolve_player_ids(players)
    print(f"resolved {len(ids)}/{len(players)} player ids")

    all_rows: list[tuple] = []
    for season in seasons:
        all_rows.extend(ingest_season(season, players, ids))

    if args.dry_run:
        for slug, season, games, minutes, epm, _ in sorted(all_rows):
            print(f"  {slug:32s} {season} gp={games:3d} min={minutes:7.1f} epm={epm}")
        print(f"dry run: {len(all_rows)} rows, nothing written")
        return

    args.db.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(args.db)
    con.execute("PRAGMA journal_mode = WAL")
    con.execute("PRAGMA busy_timeout = 8000")
    con.execute(STATS_TABLE_SQL)
    con.executemany(UPSERT_SQL, all_rows)
    con.commit()
    con.close()
    print(f"cached {len(all_rows)} stat rows into {args.db} (source=nba_api)")


if __name__ == "__main__":
    main()
