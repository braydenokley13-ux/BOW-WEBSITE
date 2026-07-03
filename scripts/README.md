# Data pipeline — NBA value vs. contract analytics

The `/analytics` section runs on a **hybrid pipeline**: live advanced
stats cached from stats.nba.com, plus a hand-maintained contracts file.
Everything lands in the same SQLite database the rest of the site uses
(`data/bow.db`).

## 1. Contracts & apron status — `data-seeds/contracts.csv`

There is no clean free API for salary/cap/apron data, so this CSV is
the **system of record** and is meant to be edited by hand.

| column | meaning |
| --- | --- |
| `player` | full name (also derives the URL slug) |
| `team` | three-letter team code |
| `cap_hit` | this season's cap hit, **in $ millions** (e.g. `53.1`) |
| `years_remaining` | seasons left on the deal, counting this one |
| `total_remaining` | money left on the deal, **in $ millions** |
| `apron_status` | `below`, `first`, or `second` — the team's apron tier |

Edits flow into the database automatically the next time the app boots
(the seed re-reads the CSV on every startup and prunes players you
remove). Keep it to the curated ~30–40 players the apron story is
actually about.

## 2. Live advanced stats — `scripts/nba_ingest.py`

```bash
pip install nba_api          # one-time
python3 scripts/nba_ingest.py            # refresh the current season
python3 scripts/nba_ingest.py --dry-run  # inspect without writing
```

The script reads the curated list (from the DB, or the CSV on a fresh
clone), resolves stats.nba.com player ids offline, makes **one**
league-wide request for the NBA's estimated player metrics, and upserts
per-player rows into `nba_player_stats` with `source='nba_api'`.
`E_NET_RATING` is stored in the `epm` column (estimated net impact per
100 possessions — the EPM-style input the AASV model wants).

Never scrapes Basketball Reference; never runs at page-request time.

## 3. Fallback snapshot — `data-seeds/stats-snapshot.csv`

Checked-in, hand-editable stat values (columns: `player,season,games,
minutes,epm,bpm`; leave `epm` empty to exercise the BPM fallback) so
the dashboard works on a fresh clone with no network and no Python.
Snapshot rows never overwrite rows the ingest script has refreshed.

## How the site consumes it

`lib/nba.ts` joins players + contracts + latest stats; `lib/aasv.ts`
turns them into production value, true (apron-adjusted) cost, and AASV
under user-adjustable assumptions. The dashboard at `/analytics` and
the article embeds render from that single data layer.
