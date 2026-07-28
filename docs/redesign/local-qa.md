# Local QA environment

How to build a working BOW database and sign into the portal locally.

## Schema is now in the repo

Previous passes had to hand-create tables with uncommitted SQL because the
repo had no DDL for most of the operations schema. That gap is closed. A
fresh database is built entirely from committed migrations:

```bash
export POSTGRES_URL_NON_POOLING=postgres://postgres@127.0.0.1:5432/bow
export POSTGRES_URL=$POSTGRES_URL_NON_POOLING
npm run db:setup -- --seed
```

`db:setup` runs the four steps in the only order that works:

1. `scripts/dev-bootstrap.sql` — legacy tables (users, organizations, cohorts…)
2. migrations through `000` — operations, classes, instructor workforce, growth
3. `scripts/migrate-people-work-os.ts` — role assignments, openings, applications
4. the remaining migrations — `001`–`017`

Steps 2 and 3 interleave because `008_people_weekly_operations.sql` extends
`role_assignments`, which step 3 creates, and step 3 needs `tasks`, which
step 2 creates. `scripts/run-migrations.ts --through <n>` exists for this.

Both `db:setup` and `db:seed` refuse to run against a non-loopback host
unless `ALLOW_REMOTE_DB_SETUP=1`.

### The migrations that closed the gap

| migration | what it covers |
|---|---|
| `000_operations_core.sql` | tasks, programs, curricula, locations, regions, partner orgs, classes/sessions/enrolments/instructors, students, instructor workforce, training, growth + acquisition |
| `015_student_surfaces.sql` | quiz, self-paced, discussion, simulation, feed, player card, profile sharing, articles |
| `016_inquiries_operations_columns.sql` | the operations columns on `inquiries`, plus `submitted_at` |
| `017_nba_analytics.sql` | `nba_players` / `nba_contracts` / `nba_player_stats` |

All statements are `CREATE ... IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`,
so applying them to a database that already has these tables — production
included — is a no-op.

## Seed data

`npm run db:seed` (`scripts/seed-dev.ts`) is idempotent and date-relative, so
re-running refreshes the fixture and the "today"/"overdue"/"upcoming" cases
stay meaningful. It seeds the states each portal has to render:

- **founder** — an applicant awaiting a decision after interview, an overdue
  founder handoff, a class with no lead instructor, a completed program due
  for renewal, an over-budget campaign, a behind-pace goal, a leaderless
  location, a student with incomplete forms
- **instructor** — an active/eligible instructor with a session today, a past
  session missing its report, and a second instructor mid-onboarding with a
  required training module still incomplete
- **student** — an enrolled student with attendance history and an upcoming
  session

Accounts (all use `SEED_PASSWORD`):

| email | role |
|---|---|
| dana@bowsportscapital.org | admin / founder |
| jordan@bowsportscapital.org | growth |
| marcus.reyes@lincolnhs.edu | instructor (active) |
| priya.anand@example.com | instructor (onboarding) |
| jalen.b@lincolnhs.edu | student |

## Auth

Auth is Supabase-backed, so signing in locally needs a GoTrue instance. The
seed provisions identities through the admin API when
`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `SEED_PASSWORD`
are all set; otherwise it seeds domain data and skips that step. No
application auth code has a local-only branch.

```bash
# Postgres for GoTrue's own schema. The search_path matters: GoTrue queries
# `users`/`identities` unqualified.
createdb gotrue
psql -d gotrue -c "CREATE SCHEMA auth; CREATE EXTENSION IF NOT EXISTS pgcrypto;"
psql -c "ALTER DATABASE gotrue SET search_path TO auth, public;"

docker run -d --name gotrue --network host \
  -e GOTRUE_DB_DRIVER=postgres \
  -e GOTRUE_DB_DATABASE_URL="postgres://postgres@127.0.0.1:5432/gotrue?sslmode=disable" \
  -e GOTRUE_API_HOST=0.0.0.0 -e PORT=9999 \
  -e GOTRUE_SITE_URL=http://127.0.0.1:3000 \
  -e GOTRUE_JWT_SECRET="<same secret the anon/service JWTs are signed with>" \
  -e GOTRUE_JWT_EXP=3600 -e GOTRUE_JWT_AUD=authenticated \
  -e GOTRUE_DISABLE_SIGNUP=false -e GOTRUE_MAILER_AUTOCONFIRM=true \
  -e API_EXTERNAL_URL=http://127.0.0.1:54321 \
  supabase/gotrue:v2.143.0
```

Two things that will otherwise cost an hour:

- **Pin the image.** `v2.170.0`'s migration chain fails on a fresh Postgres
  (`type "auth.factor_type" does not exist`). `v2.143.0` applies cleanly.
- **supabase-js calls `/auth/v1/*`; standalone GoTrue serves those routes at
  `/`.** Put a tiny reverse proxy on the port `NEXT_PUBLIC_SUPABASE_URL`
  points at that strips the `/auth/v1` prefix and forwards to `:9999`.

`.env.local` (gitignored) holds `POSTGRES_URL(_NON_POOLING)`,
`NEXT_PUBLIC_SUPABASE_URL`, a locally-minted HS256 anon/service-role JWT pair
signed with `GOTRUE_JWT_SECRET`, `SEED_PASSWORD`, and `BOW_LEARN_CUTOVER=on`.

## Verified from clean

Against an empty database, in one command: 17 migrations apply, seed loads,
each role authenticates, and the founder / instructor / student homes render
real data. `npm run build` completes 96/96 pages.
