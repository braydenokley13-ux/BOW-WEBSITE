/* ============================================================
 * Native postgres.js client — Learn platform (Stage 1+).
 *
 * `lib/db.ts` intentionally keeps a SQLite-compat `?`-placeholder shim
 * (`toPostgresSql`) for legacy call sites. New JSONB-heavy code (the
 * `learn_*` tables) must NOT go through that shim: its `json_extract` regex
 * only rewrites a single dotted-path literal and the `?` → `$n` rewriter is
 * not aware of native jsonb operators (`?`, `?|`, `?&`) — mixing them would
 * silently corrupt a query. This module opens a second postgres.js client,
 * using the same connection/env resolution as lib/db.ts, and exposes the
 * library's native tagged-template `sql` interface plus `sql.begin()` for
 * transactions (see scripts/run-migrations.ts and app/actions/learn-play.ts).
 *
 * Server-only.
 * ============================================================ */

import postgres, { type Sql, type TransactionSql } from "postgres";

function connectionUrl(): string {
  const value = (process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? "").trim();
  if (!value) {
    throw new Error(
      "[bow] Missing POSTGRES_URL. Connect Supabase in Vercel, then run `vercel env pull .env.local`.",
    );
  }
  return value;
}

const globalForLearnDb = globalThis as unknown as { __bowPostgresSql?: Sql };

/** The native postgres.js tagged-template client for `learn_*` JSONB code. */
export function getSqlLearn(): Sql {
  if (!globalForLearnDb.__bowPostgresSql) {
    globalForLearnDb.__bowPostgresSql = postgres(connectionUrl(), {
      prepare: false,
      max: 5,
      idle_timeout: 20,
      connect_timeout: 15,
    });
  }
  return globalForLearnDb.__bowPostgresSql;
}

/**
 * Tagged-template client — `sqlLearn\`select * from learn_tracks\`` etc.
 *
 * Lazy by construction: this must NOT eagerly call `getSqlLearn()` at module
 * scope, or simply importing this module (e.g. transitively, from any page
 * or server action) throws whenever POSTGRES_URL is unset — which is exactly
 * what happens during `next build`'s page-data collection in dev/CI
 * environments without a live DB. The Proxy defers both calling it as a
 * tagged template and reading properties off it (e.g. `sqlLearn.begin`)
 * until the first real request-time use.
 */
export const sqlLearn: Sql = new Proxy(
  ((...args: Parameters<Sql>) => (getSqlLearn() as unknown as (...a: Parameters<Sql>) => ReturnType<Sql>)(...args)) as unknown as Sql,
  {
    get(_target, prop) {
      if (prop === "then") return undefined; // not thenable
      const client = getSqlLearn() as unknown as Record<PropertyKey, unknown>;
      const value = client[prop];
      return typeof value === "function" ? value.bind(client) : value;
    },
    apply(_target, _thisArg, args) {
      return (getSqlLearn() as unknown as (...a: unknown[]) => unknown)(...args);
    },
  },
);

/**
 * Run `fn` inside a native postgres.js transaction (`sql.begin`), which
 * auto-rolls-back on throw and auto-commits on resolve. Prefer this over
 * manual BEGIN/COMMIT for any new multi-statement write (e.g.
 * `completeAttempt`), especially anything needing `SELECT … FOR UPDATE`.
 */
export async function withTransaction<T>(
  fn: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  const client = getSqlLearn();
  return client.begin((tx) => fn(tx)) as Promise<T>;
}
