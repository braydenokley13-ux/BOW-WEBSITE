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
`008`, which extends `role_assignments`). Local-only supplemental SQL
files (scratchpad `qa/000_local_tasks_supplement.sql`,
`qa/001_local_operations_supplement.sql`, `qa/002_local_growth_supplement.sql`,
`qa/003_local_stage2_demo_data.sql` — never committed) were required to get
a clean boot: several tables that `lib/operations.ts`, `lib/flywheel.ts`,
`lib/growth.ts`, and `lib/hiring.ts` query (`tasks`, `programs`,
`locations`, `classes`, `growth_campaigns`,
`student_acquisition_touchpoints`, `training_modules`,
`training_module_completions`, `training_module_views`, etc.) have no
committed Postgres DDL anywhere in the repo — they were historically
created only by the one-off SQLite→Supabase migration script or
hand-created directly in Supabase Studio in production, and were never
captured in `scripts/migrations/`. `scripts/dev-bootstrap.sql` already
documents this same class of gap for a few tables ("Stubs for the
hiring/growth dashboard widgets ... Empty is fine"); the supplements just
extend that same established pattern to the rest. Stage 2 additionally
found `practice_evaluations` existed but was missing most of the columns
`getInstructorDetail()`/`rowToPracticeEvaluation()` expect
(`evaluated_at`, the three rating columns, etc.) — `003_local_stage2_demo_data.sql`
adds them with `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. **This is real,
pre-existing schema/migration debt in the repo, not something introduced
by this QA pass** — flagging it here since a "real" local or staging
Postgres for this app would hit the exact same gap.

`003_local_stage2_demo_data.sql` (idempotent, re-runnable) seeds
representative operational demo data on top of the earlier stub-only
supplements: 2 partner organizations, 2 locations (one with no
`primary_leader_user_id`, intentionally, to exercise the growth
"leadership imbalance" exception), 1 curriculum, 3 programs across
lifecycle stages (`active`, `launching`, `completed`/renewal-pending), 2
classes with `class_sessions` (one already past with no session report —
a follow-up-due case — one scheduled for "today" at seed time, two
upcoming), an active/eligible instructor dossier for
`marcus.reyes@lincolnhs.edu` (`instr-marcus`, stage `active`,
`eligibility_status = eligible`, onboarding + training modules complete)
so `requireInstructorSelf`/`requireActiveInstructorSelf` resolve to the
delivering-instructor experience, a second instructor mid-onboarding
(`instr-priya` / `person-priya`, stage `training`, one required training
module still incomplete), 3 students with class enrollments, 3 tasks
(one overdue, one founder handoff, one instructor follow-up), 2 growth
inquiries, and growth-exceptions fixtures (an over-budget active
campaign, a behind-pace operating goal, the leaderless Omaha location).

## Demo accounts

`users` rows for dana@bowsportscapital.org / admin,
jordan@bowsportscapital.org / growth, marcus.reyes@lincolnhs.edu /
instructor, jalen.b@lincolnhs.edu / student (the same identities in
`lib/account.ts`'s in-code seed array, which is not actually loaded into
the database by any script), plus one added for Stage 2,
priya.anand@example.com / instructor (mid-onboarding, no corresponding
`people.user_id` login was needed before Stage 2's stage-aware `/app/teach`
work), were inserted directly into `users`, and matching Supabase Auth
identities were created via GoTrue's admin API (`email_confirm: true`).
`lib/session.ts` backfills each row's `auth_user_id` by email on first
successful sign-in. Password for all: see `docs/redesign/local-qa.md`'s
sibling `CREDENTIALS.txt` in the scratchpad (not committed, since it's
environment-specific, sandbox-only, and not a secret worth version
control — regenerate it any time by re-running the GoTrue admin API calls
in this session's history with a new `SEED_PASSWORD`).

## Restarting after a container restart, redux (seed order)

After the steps in "Restarting after a container restart" above, re-apply
the local-only supplements in order if the Postgres data directory was
ever recreated from scratch (a restart of the same `pgdata/` does NOT
need this — the data persists on disk):

```bash
export PATH=/usr/lib/postgresql/16/bin:$PATH
for f in qa/000_local_tasks_supplement.sql qa/001_local_operations_supplement.sql \
         qa/002_local_growth_supplement.sql qa/003_local_stage2_demo_data.sql; do
  PGPASSWORD=postgres psql -h 127.0.0.1 -p 5433 -U postgres -d bow -f "$SCRATCH/$f"
done
```

## Proof

Screenshots taken with Playwright (`executablePath: /opt/pw-browsers/chromium`)
against the running dev server, signed in as each demo account. Stage 0/1
shots are in this session's scratchpad `qa/`; Stage 2 shots are in
scratchpad `stage2/`:

- `stage2/staff-home.png` / `stage2/staff-home-mobile.png` — `/app` (new attention-first Home), desktop 1280×800 and mobile 375×812, with seeded attention-queue items visible
- `stage2/instructor-active-teach.png` — `/app/teach` signed in as marcus.reyes@lincolnhs.edu (active/eligible instructor) — the "Today" view
- `stage2/instructor-onboarding-teach.png` — `/app/teach` signed in as priya.anand@example.com (mid-onboarding instructor) — the checklist/training view
- `stage2/redirect-check-instructor-redirect.png` / `stage2/redirect-check-student-redirect.png` — confirm `/app/instructor` → `/app/teach` and `/app/student` → `/dashboard`

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
