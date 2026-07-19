# SQLite → Supabase Postgres Migration Runbook

This document is the single source of truth for finishing the migration of
BOW-WEBSITE off Node's built-in `node:sqlite` (`lib/db.ts`) onto Supabase
Postgres. It is written so a developer or a fresh AI session can execute
Phases 2–6 with **no additional architectural guidance** — just follow the
steps, run the greps to re-verify file lists (the codebase will have moved on
since this was written), and check the boxes.

Read this whole file before touching code. Do not skip the dialect cheat
sheet — nearly every bug in this kind of migration is a silent dialect
mismatch, not a compile error.

---

## 1. Overview + current state

### Architecture today

- **Runtime DB**: `node:sqlite` `DatabaseSync` — a fully synchronous,
  in-process SQLite driver. Single file at `data/bow.db` (`lib/db.ts:69-71`,
  `DB_PATH` / `DATA_DIR`).
- **Access pattern**: one big module, `lib/db.ts` (~5,900 lines), exports
  `getDb(): DatabaseSync` (`lib/db.ts:5688`) plus schema DDL, migrations, and
  seed data run at startup via `init()`. Callers do
  `getDb().prepare(sql).get/.all/.run(...args)` — ~299 call sites across
  `lib/db.ts` itself and ~82 other files.
- **No ORM.** Every query is hand-written SQL with `?` positional
  placeholders.
- **Auth**: hand-rolled cookie sessions. `lib/session.ts` reads/writes a
  `sessions` table (token digested with SHA-256, `expires_at` epoch-ms).
  `proxy.ts` is the request-level session/auth middleware.
- **Vercel guard**: `lib/db.ts:5554` — `init()` throws in production when
  `process.env.VERCEL` is set, because SQLite-on-one-file is incompatible
  with Vercel's ephemeral, horizontally-scaled functions. This is why the app
  cannot currently deploy to Vercel at all; removing this guard is the last
  step of the migration (Phase 6), not the first.
- **Booleans** are `INTEGER` 0/1. **Dates** are epoch-milliseconds
  `INTEGER`, produced in JS with `Date.now()`, and read back via SQLite
  date functions (`unixepoch`, `julianday`) inside SQL.
- **JSON** columns are `TEXT`, read via `json_extract(col, '$.path')`.

### Target architecture

- **Vercel** (Next.js 16 App Router — see `AGENTS.md`, this is a version with
  breaking API changes vs. training-data Next.js; check
  `node_modules/next/dist/docs/` before writing framework code) hosting the
  app.
- **Supabase Postgres** as the durable store, accessed through Supabase's
  connection pooler in **transaction mode** (port 6543) — required because
  Vercel serverless functions open/close connections per-invocation and
  Postgres cannot sustain one direct connection per invocation at scale.
- **Same cookie-based auth** (`lib/session.ts`, `proxy.ts`) — just pointed at
  the `sessions` table in Postgres instead of SQLite. No auth redesign, no
  Supabase Auth adoption.
- **Same hand-written-SQL style**, converted to async Postgres calls via
  `postgres.js` (see §4) rather than introducing an ORM. This keeps the
  diff mechanical and low-risk given the codebase's existing shape.

### Phase list

- [ ] **Phase 1 — Schema DDL** (in progress, concurrently, by other agents):
      `supabase/migrations/0001_schema_a_i.sql` and
      `supabase/migrations/0002_schema_j_z.sql`. Do not rewrite these here;
      reference them. If they are not yet merged when you start Phase 2,
      coordinate — Phase 2 code assumes the Postgres schema they define
      already exists in the target database.
- [ ] **Phase 2 — Module-by-module query conversion** (§3): rewrite each
      `lib/*.ts` / `app/**/*.ts` file's SQL + call sites from sync
      `node:sqlite` to async `postgres.js`, module by module, verifying with
      `npx tsc --noEmit` after each module.
- [ ] **Phase 3 — Wire-up completion**: once all modules compile, delete the
      `node:sqlite` import path, retire `lib/db.ts`'s `DatabaseSync` internals
      (schema/seed DDL becomes dead code superseded by the Phase 1
      migrations), and make `lib/db-pg.ts` (§4) the only DB entry point.
- [ ] **Phase 4 — Data migration**: export `data/bow.db` and import into
      Supabase, with type conversions (§5).
- [ ] **Phase 5 — Auth verification**: confirm `lib/session.ts` / `proxy.ts`
      work unchanged against Postgres (§6).
- [ ] **Phase 6 — Vercel deploy**: remove the `VERCEL` guard, set env vars,
      verify the cron job (§7).
- [ ] **Verification** (§8).

---

## 2. Dialect cheat sheet

Every pattern below was confirmed present in this codebase by grep as of
this writing. Re-run the greps yourself before relying on line numbers —
Phase 2 edits will move things around.

### 2.1 Epoch-ms timestamps: `unixepoch`

SQLite pattern seen throughout `lib/growth.ts`, `lib/growth-schema.ts`,
`lib/db.ts` (confirm: `grep -rn "unixepoch" lib/ app/`):

```sql
-- SQLite
date(occurred_at / 1000, 'unixepoch')
date(ce.enrolled_at / 1000, 'unixepoch')
```

Postgres rewrite — convert epoch-ms → `timestamptz`, then take the date:

```sql
-- Postgres
(to_timestamp(occurred_at / 1000.0))::date
(to_timestamp(ce.enrolled_at / 1000.0))::date
```

If the column becomes a native `timestamptz` during Phase 1 schema
conversion (recommended — check `supabase/migrations/0001_*.sql` /
`0002_*.sql` for the actual column types chosen), the division/conversion is
unnecessary and it's simply `occurred_at::date`. **Confirm which the schema
migration chose before mechanically porting these call sites** — this is a
per-column decision made in Phase 1, not something to guess here.

For inserts producing epoch-ms in JS (`Date.now()`), if the target column is
`timestamptz`, convert in the query layer instead: pass a JS `Date` to
`postgres.js` directly, or wrap: `to_timestamp($1 / 1000.0)`.

### 2.2 `julianday()` "now" comparisons

`lib/db.ts:5011,5061,5075,5090,5218,5242` (grep to confirm current lines:
`grep -n "julianday" lib/db.ts`):

```sql
-- SQLite: epoch-ms "now"
CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)
```

Postgres rewrite (epoch-ms):

```sql
-- Postgres
(EXTRACT(EPOCH FROM now()) * 1000)::bigint
```

Or, if the compared column is `timestamptz`, skip the epoch math entirely
and compare directly against `now()`:

```sql
-- SQLite: session_date <= CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)
-- Postgres, if session_date is timestamptz:
session_date <= now()
```

### 2.3 `json_extract()` → jsonb operators

Seen in `lib/instructor-workforce.ts:474,485,486,489` and
`lib/db.ts:4440-4443,4534+` (grep: `grep -rn "json_extract" lib/`):

```sql
-- SQLite
json_extract(od.decision, '$.action') = 'removed'
json_extract(od.decision, '$.instructorId') = ?
```

Postgres rewrite — requires the column to be `jsonb` (Phase 1 should have
made all former JSON-in-TEXT columns `jsonb`; confirm in the schema
migrations). `->>` extracts as text (use for equality against a string
literal or bound `?`/`$1` param), `->` extracts as jsonb (use when chaining
or comparing to a JSON value):

```sql
-- Postgres
od.decision ->> 'action' = 'removed'
od.decision ->> 'instructorId' = $1
```

Nested paths (`$.a.b`) become chained `->`/`->>`, or use
`od.decision #>> '{a,b}'` for a path array.

### 2.4 `ON CONFLICT` — mostly compatible, watch these differences

`lib/db.ts` has 24+ `ON CONFLICT(...) DO UPDATE SET ... = excluded....`
blocks (grep: `grep -n "ON CONFLICT" lib/db.ts`). The syntax is
**largely identical** between SQLite and Postgres — both support
`ON CONFLICT (col) DO UPDATE SET x = excluded.x`. Differences to check
per-statement during Phase 2:

- Postgres requires the conflict target to be a column list matching an
  actual **unique index or constraint** — SQLite is more lenient about
  inferring this. If a migration creates the unique index under a different
  name/expression than what SQLite had implicitly, the `ON CONFLICT(id)`
  clause can fail at runtime with "no unique or exclusion constraint
  matching the ON CONFLICT specification." Verify each target column set has
  a real unique constraint in `0001_schema_a_i.sql`/`0002_schema_j_z.sql`.
  - `INSERT OR IGNORE` (24 occurrences, grep:
    `grep -n "INSERT OR" lib/db.ts`) has no direct Postgres keyword — rewrite
    as `INSERT ... ON CONFLICT (<unique cols>) DO NOTHING`.
- `excluded.<col>` works identically in Postgres.
- SQLite allows omitting the conflict target sometimes; Postgres always
  requires one (or `ON CONFLICT DO NOTHING` with no target, which applies to
  any conflict). Prefer being explicit.

### 2.5 `PRAGMA` statements — delete, no Postgres equivalent

`lib/db.ts` uses `PRAGMA table_info(...)`, `PRAGMA index_list(...)`,
`PRAGMA integrity_check`, `PRAGMA foreign_key_check`, `PRAGMA journal_mode`,
`PRAGMA foreign_keys` (grep: `grep -n "PRAGMA" lib/db.ts` — ~10+ sites, plus
the two `db.exec("PRAGMA ...")` calls in `init()`). These exist to do
**runtime schema introspection during hand-rolled migrations** (checking
whether a column/index already exists before adding it) — a pattern that
Phase 1's SQL-file migrations replace entirely. **Delete all of this code in
Phase 3**, not port it:
- `PRAGMA table_info(x)` → if you ever need introspection, use
  `information_schema.columns`, but you shouldn't need it — Postgres
  migrations in `supabase/migrations/` are the single source of schema
  truth, not runtime-checked.
- `PRAGMA journal_mode = WAL` / `PRAGMA foreign_keys = ON` → not applicable;
  Postgres has WAL and FK enforcement on unconditionally.
- `PRAGMA integrity_check` / `PRAGMA foreign_key_check` → not needed;
  Postgres enforces FKs transactionally at write time.

### 2.6 `AUTOINCREMENT` → `GENERATED ... AS IDENTITY` / `SERIAL`

`lib/db.ts:517,654`: `id INTEGER PRIMARY KEY AUTOINCREMENT`. This is schema
DDL, owned by Phase 1 — the migration files should use
`id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY` (preferred over the
legacy `SERIAL`) or, if IDs are UUIDs elsewhere in the schema (check —
several tables in this codebase use string/UUID primary keys, not
autoincrement ints), keep them as `text`/`uuid`. No query-layer change
needed beyond removing any code that reads back `lastInsertRowid` from
`node:sqlite`'s `.run()` result — Postgres inserts should instead
`RETURNING id` and read that from the query result row.

### 2.7 Booleans: `INTEGER` 0/1 → `boolean`

Many columns declared `INTEGER NOT NULL DEFAULT 0` are used as booleans
(`deletion_requested`, `onboarding_completed`, `password_change_required`,
`discoverable`, `simulation_done`, `challenge_done`, `completed`, etc. —
grep: `grep -n "INTEGER.*DEFAULT 0\|INTEGER.*DEFAULT 1" lib/db.ts`). If
Phase 1's schema migrations convert these to native `boolean` (recommended),
then in the query layer:
- Reads: driver returns JS `true`/`false` directly — remove any
  `=== 1` / `!!value` coercion in the calling TS code.
- Writes: pass JS `true`/`false` instead of `1`/`0`.
- WHERE clauses: `WHERE completed = 1` → `WHERE completed = true` (or
  `WHERE completed` for a plain boolean column).

If Phase 1 instead kept these as `integer` for lower risk, no query changes
are needed here — check the actual column type chosen in the migration
files before touching call sites.

### 2.8 `LIKE` case sensitivity

Two call sites: `lib/articles.ts:214` (`body LIKE ?`) and
`lib/db.ts:2895` (`name NOT LIKE 'sqlite_%'` — this one is SQLite
catalog introspection, delete per §2.5, don't port). SQLite's `LIKE` is
**case-insensitive by default** for ASCII; Postgres's `LIKE` is
**case-sensitive**. For `lib/articles.ts:214`'s search-body use case, use
`ILIKE` in Postgres to preserve the original (case-insensitive) behavior:

```sql
-- SQLite
WHERE status = 'published' AND body LIKE ?
-- Postgres
WHERE status = 'published' AND body ILIKE $1
```

### 2.9 Parameter placeholders: `?` → `$1, $2, ...`

Every one of the ~299 `node:sqlite` call sites uses positional `?`
placeholders passed as trailing args to `.get()/.all()/.run()`. `postgres.js`
(recommended client, §4) uses **tagged-template** query building, not
numbered placeholders at all — you interpolate JS values directly inside a
`` sql`...` `` template and the library parameterizes them safely:

```ts
// node:sqlite (today)
db.prepare("SELECT * FROM users WHERE id = ? AND status = ?").get(id, status);

// postgres.js (target)
await sql`SELECT * FROM users WHERE id = ${id} AND status = ${status}`;
```

This means query strings must be **rewritten**, not just parameter-numbered
— every `.prepare(sqlString)` + `.get(...args)`/`.all(...args)`/`.run(...args)`
pair collapses into a single `await sql\`...\`` call with the args inlined
via template interpolation, in the same order they appear in the SQL text.
When a query is built dynamically (string concatenation for optional
WHERE clauses — check for these with
`grep -n "let sql\|sqlParts\|conditions.push" lib/*.ts`), use `postgres.js`'s
`sql.unsafe()` only as a last resort, and prefer restructuring with
`postgres.js` fragment helpers (`sql\`\`` fragments can be composed) instead.

---

## 3. Phase 2/3 execution plan

### 3.1 The mechanical recipe (apply per file, in this order)

1. Replace the top-of-file import:
   ```ts
   // before
   import { getDb } from "@/lib/db";
   // after
   import { sql } from "@/lib/db-pg";
   ```
2. For every `getDb().prepare(SQL).get(args)` /
   `.all(args)` / `.run(args)` call:
   - Rewrite the SQL string per the §2 cheat sheet (placeholders, date
     functions, json, booleans, ON CONFLICT/INSERT OR IGNORE, LIKE→ILIKE).
   - Collapse `.prepare(...).get/.all/.run(...)` into one
     `await sql\`...\`` call (§2.9).
   - `.get(...)` (single row or undefined) → `const [row] = await sql\`...\`;
     return row;` — `postgres.js` always returns an array.
   - `.all(...)` (array of rows) → `await sql\`...\`` directly (already an
     array-like `Row[]`).
   - `.run(...)` (no return value used, or `lastInsertRowid`/`changes`
     read) → `await sql\`...\`` for side-effect-only writes; add
     `RETURNING id` to the SQL and destructure the result if the caller
     needs the new row's id (search for `.lastInsertRowid` usage:
     `grep -rn "lastInsertRowid" lib/ app/`).
3. Make the enclosing function `async` if it isn't already, and `await` the
   call.
4. **Propagate `async`/`await` up the call chain** — every caller of a
   function you just made async must itself become async and await it, all
   the way up to the Server Action (`"use server"` functions are already
   async in this codebase per the CLAUDE.md-style server-action pattern used
   elsewhere in similar Next.js apps — check `app/actions/*.ts`, which are
   likely already `async` since they're Server Actions) or the `page.tsx`
   Server Component that calls it.
5. Run `npx tsc --noEmit`. TypeScript will surface every place a
   newly-async function is called without `await` (it'll type as `Promise<T>`
   used where `T` is expected) — fix each one.
6. Re-run `npx tsc --noEmit` until clean for that module before moving to
   the next module.

### 3.2 Module list

Generated from `grep -rln "from \"@/lib/db\"\|getDb()" app lib --include="*.ts" --include="*.tsx"`
— **re-run this exact grep before starting Phase 2**, the list below is a
snapshot and files will have been added/removed/renamed since.

**students**
- `lib/dal.ts`, `app/app/students/[id]/page.tsx`, `app/actions/students.ts`

**classes**
- `app/app/classes/page.tsx`, `app/app/classes/[id]/page.tsx`,
  `app/app/classes/[id]/sessions/[sid]/page.tsx`,
  `app/app/classes/proposals/page.tsx`, `app/app/teach/classes/[id]/page.tsx`,
  `app/app/teach/classes/[id]/sessions/[sid]/page.tsx`,
  `app/app/teach/page.tsx`, `app/actions/classes.ts`, `app/actions/eastfield.ts`
  - Tricky: class-session date math uses the `julianday('now')` pattern
    (§2.2) directly in `lib/db.ts`'s trigger-adjacent queries (lines
    ~5011-5242) — if any of this logic is duplicated in the per-module files
    rather than living only in `lib/db.ts`, port it there too; grep
    `julianday` again post-move.

**instructors**
- `app/app/instructors/page.tsx`, `app/app/instructors/[id]/page.tsx`,
  `lib/instructor-workforce.ts`, `app/actions/instructors.ts`,
  `app/actions/instructor-quality.ts`
  - Tricky: `lib/instructor-workforce.ts:474-489` has nested `json_extract`
    calls (§2.3) filtering on `od.decision` / `od.metadata` jsonb columns —
    convert carefully, these feed instructor-removal audit logic.

**partners**
- `app/app/partners/[id]/page.tsx`, `lib/partners.ts`, `lib/partner-intake.ts`,
  `app/actions/partners.ts`

**growth** (largest/most date-arithmetic-heavy module — do this one with
extra care and manual QA against real dashboard numbers)
- `app/app/growth/page.tsx`, `lib/growth.ts`, `lib/growth-schema.ts`,
  `lib/growth-search.ts`, `app/actions/growth.ts`
  - Tricky: `lib/growth.ts` and `lib/growth-schema.ts` contain the bulk of
    the `unixepoch` date-bucketing SQL (§2.1) — cohort registration/
    confirmation date-range queries (`lib/growth.ts:234,239,297,302,560,565`
    and similar). These are read-heavy analytics queries; after conversion,
    spot-check output against the pre-migration SQLite numbers for a known
    date range before trusting the Postgres version.

**training**
- `app/app/training/sessions/[id]/page.tsx`, `lib/self-paced.ts`,
  `lib/standards.ts`, `lib/glossary.ts`, `lib/concept-map.ts`,
  `lib/daily-question.ts`, `lib/badges.ts`, `lib/streak.ts`,
  `lib/scoring.ts`, `lib/leaderboard.ts`, `lib/player-card.ts`,
  `app/actions/training.ts`, `app/actions/curriculum.ts`,
  `app/app/curriculum/[id]/page.tsx`, `lib/certificate.ts`,
  `app/actions/onboarding.ts`

**tasks/admin**
- `app/app/tasks/page.tsx`, `app/actions/tasks.ts`, `lib/admin.ts`,
  `lib/operations.ts`, `lib/hiring.ts`, `app/actions/simulation.ts`,
  `lib/sim-store.ts`

**marketing/analytics**
- `lib/analytics.ts`, `lib/articles.ts` (has the `LIKE`→`ILIKE` site, §2.8),
  `lib/content.ts`, `app/actions/content.ts`, `lib/feed.ts`, `lib/nba.ts`,
  `lib/nba-ingest.ts`, `app/api/cron/nba-ingest/route.ts` (also see §7 for
  its `CRON_SECRET` handling, unrelated to DB but same file),
  `app/actions/public-forms.ts`, `app/actions/inquiries.ts`,
  `app/app/inquiries/page.tsx`, `app/actions/discussion.ts`,
  `lib/discussion.ts`

**auth/session** (do last, after everything else compiles — see §6, do not
break login while other modules are mid-conversion)
- `lib/session.ts`, `proxy.ts` (does not import `@/lib/db` directly per the
  grep — confirm with `grep -n "lib/db\|getDb" proxy.ts`; if it only calls
  through `lib/session.ts`, no direct changes needed there), `app/actions/auth.ts`,
  `lib/rate-limit.ts` (check whether rate limiting is DB-backed or
  in-memory: `grep -n "getDb\|prepare" lib/rate-limit.ts`)

**misc** (remaining files from the grep not covered above — re-check the
current list)
- `app/app/regions/page.tsx`, `app/app/regions/[id]/page.tsx`,
  `app/app/regions/[id]/edit/page.tsx`, `app/actions/regions.ts`,
  `lib/locations.ts` / `app/actions/locations.ts`,
  `app/actions/programs.ts`, `app/actions/profile-sharing.ts`, `lib/profile.ts`,
  `app/actions/notifications.ts`, `lib/notifications.ts`,
  `app/actions/activity.ts`, `lib/invitation-delivery.ts`,
  `lib/ledger-store.ts`, `app/app/page.tsx`, `app/actions/lms.ts`,
  `app/actions/weekly.ts`, `lib/weekly.ts`

**`lib/db.ts` itself** — special-cased, see §3.3.

### 3.3 `lib/db.ts` — do this file last

`lib/db.ts` is not just "one more module" — it contains the schema DDL,
`init()`, seed data, and the `getDb()` factory that every other file
currently imports. Once every module in §3.2 has been converted to import
`sql` from `lib/db-pg.ts` instead:
1. Confirm nothing outside `lib/db.ts` still imports `getDb` (`grep -rln
   "getDb" app lib` should return only `lib/db.ts` and `lib/db-pg.ts` if it
   re-exports anything, plus this file).
2. Delete `lib/db.ts`'s `DatabaseSync`-based `init()`, schema DDL strings,
   and seed-insert code — this logic is now owned by
   `supabase/migrations/0001_schema_a_i.sql` / `0002_schema_j_z.sql` (Phase
   1) plus the Phase 4 data import (§5).
3. Either delete `lib/db.ts` entirely (preferred — update the handful of
   remaining imports to point at `lib/db-pg.ts`) or turn it into a thin
   re-export of `lib/db-pg.ts` for a smaller diff if many files still
   reference `@/lib/db` by path. Decide based on diff size at the time.
4. Move the `VERCEL` guard removal to Phase 6 (§7) — don't remove it here;
   it should stay in place as a tripwire until the Postgres path is fully
   verified.

---

## 4. Client library recommendation

**Recommendation: `postgres.js`** (the `postgres` npm package), not
`@supabase/supabase-js`.

Justification: this codebase is ~299 hand-written raw-SQL call sites with
no ORM and no use of Supabase-specific features (no Realtime, no Storage, no
Row Level Security policies driving app logic, no PostgREST usage found in
the grep results). `@supabase/supabase-js` is a REST/PostgREST client — it
would force rewriting every raw SQL query (including the SQL-heavy
`json_extract`, multi-join analytics queries in `lib/growth.ts`, and
window-function-style leaderboard queries) into PostgREST's query-builder
DSL, which cannot express everything the current SQL does without dropping
to `.rpc()` calls anyway. `postgres.js` instead speaks the Postgres wire
protocol directly, supports tagged-template SQL that's a near-mechanical
translation of the existing `?`-placeholder queries (§2.9), is fully async
(matching the `async`/`await` propagation this migration already requires),
and works cleanly through Supabase's pooler.

Install: `npm install postgres`

### `lib/db-pg.ts` skeleton

```ts
import postgres from "postgres";

// Supabase project connection pooler, TRANSACTION MODE (port 6543).
// Transaction mode is required for serverless/edge — it does not hold a
// persistent connection per client, unlike session mode (port 5432), which
// Vercel's per-invocation connection churn would exhaust quickly.
//
// DATABASE_URL should look like:
//   postgres://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
//
// Set in Vercel project env vars (Phase 6) and in .env.local for dev.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("[bow] DATABASE_URL is not set — cannot connect to Supabase Postgres.");
}

export const sql = postgres(connectionString, {
  // pgbouncer transaction-mode pooling doesn't support prepared statements
  // across requests; disable protocol-level prepare to avoid
  // "prepared statement already exists" errors under load.
  prepare: false,
  ssl: "require",
  // Keep the client-side pool small; Supabase's pooler is the real pool.
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

// Other Supabase env vars this project may also need (not used by
// postgres.js directly, but required if any Supabase Auth/Storage/Realtime
// features are added later, or for the Supabase dashboard/CLI):
//   NEXT_PUBLIC_SUPABASE_URL
//   NEXT_PUBLIC_SUPABASE_ANON_KEY
//   SUPABASE_SERVICE_ROLE_KEY   (server-only, never exposed to client)
```

Do not use the `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `@supabase/supabase-js`
client anywhere in this migration unless a specific feature explicitly
requires PostgREST/Realtime/Storage — the DB access path is `sql` from
`lib/db-pg.ts`, full stop.

---

## 5. Phase 4 — data migration (`data/bow.db` → Supabase)

Prerequisite: Phase 1 schema migrations already applied to the target
Supabase database (`npx supabase db push` or run the SQL files directly
against `DATABASE_URL` with `psql`).

### 5.1 Type conversions required during import

| SQLite (source)              | Postgres (target)         | Conversion                                   |
|-------------------------------|----------------------------|-----------------------------------------------|
| `INTEGER` epoch-ms timestamp  | `timestamptz`              | `to_timestamp(ms_value / 1000.0)`             |
| `INTEGER` 0/1 boolean         | `boolean`                  | `0 → false`, `1 → true`, anything else → NULL check |
| `TEXT` JSON string            | `jsonb`                    | pass through as-is; Postgres parses valid JSON text into jsonb on insert, but empty string / malformed JSON will error — sanitize first (`NULL` for empty) |
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `integer`/`bigint` identity or `text`/`uuid` | preserve existing values, do not regenerate; reset the Postgres sequence after import (`SELECT setval(...)`) if the column is identity-based |

### 5.2 Recommended tooling: a Node script, not the sqlite3 CLI

The `sqlite3` CLI's `.mode insert` dump is tempting but produces raw
`INSERT INTO` statements with SQLite literal syntax (no easy hook for the
type conversions in 5.1). Instead, write a one-off Node script that reads
with `node:sqlite` (same driver already in `package.json` via Node's
builtin — no new dependency) and writes with `postgres.js`:

```ts
// scripts/migrate-data.ts  (run with: node --experimental-sqlite scripts/migrate-data.ts)
import { DatabaseSync } from "node:sqlite";
import postgres from "postgres";

const sqlite = new DatabaseSync("data/bow.db");
const sql = postgres(process.env.DATABASE_URL!, { prepare: false, ssl: "require" });

// Table order matters: parents before children (respect FK dependencies).
// Get this list from supabase/migrations/000{1,2}_schema_*.sql FK declarations,
// or from `PRAGMA foreign_key_list(<table>)` run against the SQLite source.
const TABLE_ORDER = [/* e.g. "organizations", "users", "sessions", "cohorts", ... */];

const EPOCH_MS_COLUMNS: Record<string, string[]> = {
  users: ["created_at", "updated_at" /* ... */],
  // fill in per table from the schema
};
const BOOLEAN_COLUMNS: Record<string, string[]> = {
  users: ["deletion_requested", "onboarding_completed", "password_change_required"],
  // fill in per table from the schema
};

for (const table of TABLE_ORDER) {
  const rows = sqlite.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];
  for (const row of rows) {
    for (const col of EPOCH_MS_COLUMNS[table] ?? []) {
      if (row[col] != null) row[col] = new Date(Number(row[col]));
    }
    for (const col of BOOLEAN_COLUMNS[table] ?? []) {
      if (row[col] != null) row[col] = row[col] === 1;
    }
  }
  if (rows.length === 0) continue;
  await sql`INSERT INTO ${sql(table)} ${sql(rows)}`;
  console.log(`${table}: inserted ${rows.length} rows`);
}

await sql.end();
```

Run once against a Supabase **staging** project first, not production.

### 5.3 Row-count parity verification

After import, for every table in `TABLE_ORDER`:

```ts
const [{ count: sqliteCount }] = sqlite.prepare(`SELECT COUNT(*) as count FROM ${table}`).all();
const [{ count: pgCount }] = await sql`SELECT COUNT(*)::int as count FROM ${sql(table)}`;
if (sqliteCount !== pgCount) console.error(`MISMATCH ${table}: sqlite=${sqliteCount} pg=${pgCount}`);
```

Also spot-check a handful of specific rows by primary key across both DBs
for a table with jsonb and timestamptz columns (e.g. whichever table backs
`od.decision` in `lib/instructor-workforce.ts`) to confirm the JSON and date
conversions round-tripped correctly, not just that the row counts match.

---

## 6. Phase 5 — auth notes

**What stays the same**: the entire cookie-session model. `lib/session.ts`
digests the session token (SHA-256) and stores/looks up the digest in a
`sessions` table keyed by `token`, `user_id`, `expires_at`
(`lib/session.ts:2-44`). This logic is unchanged in Phase 5 — only the
storage backend under it moves from `node:sqlite` to Postgres per the
mechanical recipe in §3.1, as part of the "auth/session" module in §3.2.

**Files that touch `sessions`** (grep to reconfirm:
`grep -rln "sessions" lib app --include="*.ts"` then narrow to files
actually querying the table, not just mentioning the word):
- `lib/session.ts` — all direct reads/writes/deletes of `sessions`
  (`INSERT INTO sessions ...`, `DELETE FROM sessions WHERE token = ?`,
  the join reading `s.*` plus user status at `lib/session.ts:~101`).
- `proxy.ts` — request-level middleware; verify with
  `grep -n "lib/db\|getDb\|lib/session" proxy.ts` whether it queries
  `sessions` directly or only calls into `lib/session.ts` functions. If the
  latter, no changes needed in `proxy.ts` itself beyond whatever
  async-propagation is already required by calling into now-async
  `lib/session.ts` functions.
- `app/actions/auth.ts` — login/logout server actions that create/destroy
  sessions via `lib/session.ts`.

**Phase 5 exit check**: log in, confirm the session cookie is set, refresh
the page, confirm the session persists and resolves to the right user, log
out, confirm the session row is deleted and the cookie no longer
authenticates. Do this against the Postgres-backed path before moving to
Phase 6.

---

## 7. Phase 6 — Vercel deploy

### 7.1 Remove the VERCEL guard

`lib/db.ts:5554` (re-confirm the line number, it will have shifted since
Phase 3 deleted large chunks of this file — search
`grep -n "process.env.VERCEL" lib/db.ts`):

```ts
if (production && process.env.VERCEL) {
  throw new Error(
    "[bow] Production startup refused: this SQLite runtime requires one durable filesystem and is not safe on Vercel's ephemeral, horizontally scaled functions. Migrate to managed Postgres or deploy on a single durable host.",
  );
}
```

Only remove this **after** `lib/db.ts`'s `DatabaseSync`-based `init()` has
itself been deleted per §3.3 (at that point the guard and the code it
guards are gone together — there's no scenario where this `throw` survives
alongside a Postgres-only `lib/db-pg.ts`). If for any reason `init()` is
still reachable at this point in the migration, do not deploy to Vercel
yet — the guard exists precisely because the failure mode it prevents
(silent data loss/corruption from concurrent ephemeral SQLite writers) is
worse than refusing to boot.

### 7.2 Env vars to set on Vercel

Project Settings → Environment Variables (Production + Preview, and
`.env.local` for local dev):

- `DATABASE_URL` — Supabase pooler connection string, transaction mode,
  port 6543 (§4).
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — only if any
  Supabase-specific client features get added later; not required for the
  `postgres.js`-only path described here, but harmless to set for future use.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only, only if needed later; do not
  expose to the client bundle.
- `CRON_SECRET` — already read at `app/api/cron/nba-ingest/route.ts:30`;
  unrelated to the DB migration itself but must be set on Vercel for the
  existing cron auth check to pass (Vercel injects this automatically for
  projects using its Cron Jobs feature, but confirm it's present in env vars
  — the route compares it against the `Authorization` header Vercel sends).
- Anything else already required by the app pre-migration (check
  `.env.example` if one exists, or `grep -rn "process.env\." lib app` for an
  exhaustive list — do not assume the above is complete).

### 7.3 Cron note

`vercel.json` already declares one cron job:

```json
{
  "crons": [{ "path": "/api/cron/nba-ingest", "schedule": "0 9 * * *" }]
}
```

This hits `app/api/cron/nba-ingest/route.ts`, which calls into
`lib/nba-ingest.ts` (in the "marketing/analytics" module, §3.2) — make sure
that file is fully converted and passing `tsc` before relying on this cron
in production, since a cron failure is silent (no user-facing signal) unless
you're watching Vercel's cron logs or the route adds its own alerting.

---

## 8. Verification checklist

Run through this after each module (lighter check) and again fully after
Phase 6 (full check) before declaring the migration done.

**Per-module (during Phase 2/3):**
- [ ] `npx tsc --noEmit` — zero errors.
- [ ] `npm run lint` if the project has an eslint script (check
      `package.json` scripts — not confirmed present at time of writing;
      run `cat package.json | grep -A1 '"scripts"'` and use whatever exists).
- [ ] Manually exercise the module's primary user flow against a local
      Postgres/Supabase dev instance (not SQLite) — e.g. for "students",
      load a student profile page; for "growth", load the growth dashboard
      and compare a metric against the pre-migration SQLite value.

**Full (before/after Phase 6 deploy):**
- [ ] `npm run build` succeeds end-to-end (production build, not just dev).
- [ ] `npx tsc --noEmit` clean across the whole repo.
- [ ] Login → session persists across reload → logout (§6 exit check).
- [ ] Create/view a class, a student, an instructor record — basic CRUD
      through each of the module areas in §3.2 (students, classes,
      instructors, partners, growth, training, tasks/admin,
      marketing/analytics).
- [ ] Growth dashboard numbers for a known date range match the
      pre-migration SQLite output (§5.3's spot-check extended to app-level
      output, not just row counts).
- [ ] Row-count parity for every table, `data/bow.db` vs. Supabase (§5.3).
- [ ] Cron route (`app/api/cron/nba-ingest`) invoked manually once
      (`curl` with the correct `Authorization: Bearer $CRON_SECRET` header)
      against the deployed Postgres-backed app and confirmed it writes
      correctly.
- [ ] Confirm `lib/db.ts`'s `VERCEL` guard is gone (§7.1) and the app
      actually boots on Vercel (a preview deploy succeeding is the proof —
      previously this guard made that impossible).
- [ ] No remaining references to `node:sqlite` / `DatabaseSync` /
      `getDb` anywhere in `app/` or `lib/`:
      `grep -rn "node:sqlite\|DatabaseSync\|getDb(" app lib` returns nothing.
