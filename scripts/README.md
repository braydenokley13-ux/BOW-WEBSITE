# Data pipeline — NBA value vs. contract analytics

The `/analytics` section runs on a **hybrid pipeline**: live advanced
stats cached from stats.nba.com, plus a hand-maintained contracts file.
Everything lands in the same SQLite database the rest of the site uses
(`data/bow.db`, opened via `lib/db.ts`'s `getDb()`).

This pipeline is fully TypeScript/Vercel-native — there is no Python or
`nba_api` dependency anywhere in this repo.

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

## 2. Live advanced stats — `lib/nba-ingest.ts`

```bash
npm run ingest                                        # refresh the current season
npm run ingest -- --season 2025-26
npm run ingest -- --seasons 2023-24,2024-25,2025-26   # backfill multiple seasons in one run
npm run ingest -- --dry-run                            # fetch + print, no writes
```

`scripts/nba-ingest.ts` is a thin CLI wrapper (run via `tsx`, a
devDependency — Node's built-in TypeScript support isn't used here
because it doesn't resolve the `@/*` import alias that `lib/db.ts` and
friends rely on) over the importable module `lib/nba-ingest.ts`, which:

1. resolves the curated player list — the database first
   (`nba_players`, seeded from `contracts.csv` at boot), falling back
   to reading `contracts.csv` directly for a fresh clone;
2. makes **one** league-wide request to stats.nba.com's estimated
   player metrics endpoint (`playerestimatedmetrics`) per season, with
   the browsery headers stats.nba.com requires to accept the request;
3. matches curated players to that response by normalized name (the
   same `slugify()` that keys every player in the database), rather
   than by a separate id-lookup step — the Python original used
   `nba_api`'s bundled offline player-id index for that step, which
   isn't available outside the Python package, so this port collapses
   id-resolution and stat-lookup into the single league-wide response
   that already carries both `PLAYER_ID` and `PLAYER_NAME`. Same one
   request per season, same output rows;
4. idempotently upserts per-player rows into `nba_player_stats` with
   `source='nba_api'`, via the app's own `getDb()` connection (no
   separate SQLite connection logic to keep in sync).

`E_NET_RATING` is stored in the `epm` column (estimated net impact per
100 possessions — the EPM-style input the AASV model wants).

Every failure mode — unreachable API, a curated list that can't be
resolved, a DB write error — is caught and reported in a structured
summary (`{ season, matched, updated, skipped, errors }`) instead of
thrown, so a bad run can never take the site down; it just leaves the
cache stale. Never scrapes Basketball Reference; never runs at
page-request time.

### Nightly refresh on Vercel — `app/api/cron/daily`

Vercel has no persistent background worker, so the nightly refresh is
a [Vercel Cron](https://vercel.com/docs/cron-jobs) hitting a route
handler that runs the identical `lib/nba-ingest.ts` logic. The Hobby
plan only allows cron schedules that fire at most once a day, so this
same route also runs the registration lifecycle sweep (expiring seat
reservations/waitlist offers and delivering pending family
notifications) that used to be a separate hourly cron:

```json
// vercel.json
{
  "crons": [{ "path": "/api/cron/daily", "schedule": "0 9 * * *" }]
}
```

The route (`app/api/cron/daily/route.ts`) requires
`Authorization: Bearer $CRON_SECRET` in production — set `CRON_SECRET`
in the Vercel project's environment variables (Vercel's cron
dispatcher sends this header automatically once the env var exists).
Outside production (`NODE_ENV !== "production"`) the check is skipped
so you can hit it locally, e.g.:

```bash
curl http://localhost:3000/api/cron/daily
curl "http://localhost:3000/api/cron/daily?dryRun=1&season=2025-26"
```

**Important reality check about Vercel + SQLite**: `data/bow.db` lives
on each serverless instance's local disk, which is **ephemeral and
per-instance** — it does not persist across deploys or get shared
across concurrently-running instances (see the comments in
`lib/db.ts`). That means the cron route's writes only warm the cache
of whatever instance(s) happen to serve requests afterward, and a
fresh cold-start instance boots with nothing but the seeded snapshot
until it either re-runs the cron logic or is warmed some other way.
The **durable fallback is still `data-seeds/stats-snapshot.csv`** —
update it by hand periodically (e.g. after `npm run ingest --dry-run`
prints fresh numbers) if you want the out-of-the-box experience to
stay current. The cron job is a nice-to-have cache warmer on top of
that snapshot, not a replacement for it.

## 3. Fallback snapshot — `data-seeds/stats-snapshot.csv`

Checked-in, hand-editable stat values (columns: `player,season,games,
minutes,epm,bpm`; leave `epm` empty to exercise the BPM fallback) so
the dashboard works on a fresh clone with no network and no cron ever
having run. Snapshot rows never overwrite rows the ingest module has
refreshed (`source='nba_api'` rows win).

## How the site consumes it

`lib/nba.ts` joins players + contracts + latest stats; `lib/aasv.ts`
turns them into production value, true (apron-adjusted) cost, and AASV
under user-adjustable assumptions. The dashboard at `/analytics` and
the article embeds render from that single data layer.
