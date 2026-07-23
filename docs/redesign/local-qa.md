# Local QA environment (sandbox)

How the logged-in portal was made browsable in the sandbox, for redesign
screenshots/QA, without touching application code, `lib/`, `proxy.ts`, or
auth semantics. Everything below lives outside the repo (Postgres data
directory, Supabase Auth container, `.env.local`) except this file.

## What's running

| Component | How | Where |
|---|---|---|
| Postgres 16 | `initdb` cluster, port `5433` | scratchpad `pgdata/` |
| Supabase Auth (GoTrue) | Docker `supabase/gotrue:v2.170.0`, `--network host`, port `9999` | its own `gotrue` database in the same Postgres cluster |
| Auth path proxy | tiny Node http proxy, port `54321` | maps `NEXT_PUBLIC_SUPABASE_URL` (`/auth/v1/*`) to GoTrue's un-prefixed routes (`/*`) — supabase-js always calls `/auth/v1/...`, but the standalone GoTrue image serves routes at root |
| Next.js dev server | `npm run dev`, port `3000` | repo root |

`.env.local` (gitignored — verified with `git check-ignore -v .env.local`)
holds all of this wiring: `POSTGRES_URL(_NON_POOLING)`,
`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`, a locally-minted
HS256 anon/service-role JWT pair, `SEED_PASSWORD`, `BOW_LEARN_CUTOVER=on`.

## Restarting after a container restart

```bash
SCRATCH=<this session's scratchpad>   # e.g. .../scratchpad
export PATH=/usr/lib/postgresql/16/bin:$PATH

# 1. Postgres
su postgres -c "pg_ctl -D $SCRATCH/pgdata -l $SCRATCH/pgdata/pg.log -o '-p 5433' start"

# 2. Docker daemon + GoTrue container (container name: gotrue)
dockerd &                      # if not already running
docker start gotrue            # was created with `docker run --name gotrue --network host ...`

# 3. Auth path proxy (maps /auth/v1/* -> GoTrue root)
node $SCRATCH/qa/auth-proxy.js &

# 4. App
cd /home/user/BOW-WEBSITE && npm run dev
```

`docker logs gotrue` should show `GoTrue API started on: 0.0.0.0:9999`.
`curl http://127.0.0.1:54321/auth/v1/health` should return GoTrue's health
JSON through the proxy.

## Schema

`scripts/dev-bootstrap.sql` and `scripts/migrations/001`–`011` were applied
in order, plus `scripts/migrate-people-work-os.ts` (needed before migration
`008`, which extends `role_assignments`). Two local-only supplemental SQL
files (scratchpad `qa/000_local_tasks_supplement.sql` and
`qa/001_local_operations_supplement.sql` + `qa/002_local_growth_supplement.sql`,
never committed) were required to get a clean boot: several tables that
`lib/operations.ts`, `lib/flywheel.ts`, and `lib/growth.ts` query
(`tasks`, `programs`, `locations`, `classes`, `growth_campaigns`,
`student_acquisition_touchpoints`, etc.) have no committed Postgres DDL
anywhere in the repo — they were historically created only by the
one-off SQLite→Supabase migration script or hand-created directly in
Supabase Studio in production, and were never captured in
`scripts/migrations/`. `scripts/dev-bootstrap.sql` already documents this
same class of gap for a few tables ("Stubs for the hiring/growth dashboard
widgets ... Empty is fine"); the supplements just extend that same
established pattern to the rest. All added tables are empty stubs (0 rows
is a correct, honest state for a fresh sandbox) — no row data was invented.
**This is real, pre-existing schema/migration debt in the repo, not
something introduced by this QA pass** — flagging it here since a "real"
local or staging Postgres for this app would hit the exact same gap.

## Demo accounts

Four `users` rows (dana@bowsportscapital.org / admin, jordan@bowsportscapital.org /
growth, marcus.reyes@lincolnhs.edu / instructor, jalen.b@lincolnhs.edu /
student — the same identities in `lib/account.ts`'s in-code seed array,
which is not actually loaded into the database by any script) were
inserted directly into `users`, and matching Supabase Auth identities were
created via GoTrue's admin API (`email_confirm: true`). `lib/session.ts`
backfills each row's `auth_user_id` by email on first successful sign-in.
Password for all: see `docs/redesign/local-qa.md`'s sibling
`CREDENTIALS.txt` in the scratchpad (not committed, since it's
environment-specific, sandbox-only, and not a secret worth version
control — regenerate it any time by re-running the GoTrue admin API calls
in this session's history with a new `SEED_PASSWORD`).

## Proof

Screenshots taken with Playwright (`executablePath: /opt/pw-browsers/chromium`)
against the running dev server, signed in as each demo account, saved to
this session's scratchpad `qa/`:

- `admin-app.png` / `admin-app-mobile.png` — `/app` (Founder cockpit), desktop 1280×800 and mobile 375×812
- `admin-programs.png` — `/app/programs`
- `admin-people.png` — `/app/people`
- `admin-tasks.png` — `/app/tasks`
- `instructor-teach.png` — instructor session (`/app/teach` client-redirects to `/app/settings` — unrelated to this environment, an app-level redirect for this seed instructor's data)
- `student-dashboard.png` — `/dashboard`, signed in as the student demo account

All pages render real application content (not error boundaries) after the
schema supplements above.

## Blockers encountered (resolved)

- **Docker daemon wasn't running** — started with `dockerd &` (root shell).
- **`supabase/gotrue:latest` doesn't exist on Docker Hub** — pulled a
  pinned version (`v2.170.0`) instead.
- **GoTrue serves routes at `/`, supabase-js calls `/auth/v1/*`** — solved
  with the small Node reverse proxy in `qa/auth-proxy.js`.
- **Missing schema for `tasks`/`programs`/growth-engine tables** — see
  Schema section above; resolved with local-only stub DDL.

No blocker required a workaround outside these files — GoTrue itself came
up cleanly once the correct image tag was pulled.
