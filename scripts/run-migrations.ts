/* ============================================================
 * scripts/run-migrations.ts — forward-only, transactional SQL runner.
 *
 * Applies scripts/migrations/NNN_*.sql in ascending filename order, each in
 * its own transaction, tracked in a `schema_migrations` table so re-running
 * is a no-op for already-applied files (idempotent). Uses
 * POSTGRES_URL_NON_POOLING when set (recommended for DDL against Supabase's
 * pooler), falling back to POSTGRES_URL.
 *
 * Usage: `npm run migrate`
 * ============================================================ */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

const MIGRATIONS_DIR = path.join(process.cwd(), "scripts", "migrations");

function connectionUrl(): string {
  const value = (
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    ""
  ).trim();
  if (!value) {
    throw new Error(
      "[migrate] Missing POSTGRES_URL_NON_POOLING / POSTGRES_URL. Connect Supabase, then " +
        "`vercel env pull .env.local` (or export the var) before running `npm run migrate`.",
    );
  }
  return value;
}

function listMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

async function ensureMigrationsTable(sql: postgres.Sql): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      key text UNIQUE,
      applied_at double precision NOT NULL
    )
  `;
  // Older Playbook installs created key-only rows; the People & Work runner
  // created id-only rows. Make either historical shape compatible in place.
  await sql`ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS id text`;
  await sql`ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS key text`;
  await sql`UPDATE schema_migrations SET id = key WHERE id IS NULL`;
  await sql`UPDATE schema_migrations SET key = id WHERE key IS NULL`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS schema_migrations_id_unique ON schema_migrations(id)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS schema_migrations_key_unique ON schema_migrations(key)`;
}

async function alreadyApplied(sql: postgres.Sql, key: string): Promise<boolean> {
  const rows = await sql`SELECT 1 FROM schema_migrations WHERE key = ${key}`;
  return rows.length > 0;
}

async function applyMigration(sql: postgres.Sql, file: string): Promise<void> {
  const fullPath = path.join(MIGRATIONS_DIR, file);
  const contents = readFileSync(fullPath, "utf8");
  console.log(`[migrate] applying ${file}...`);
  await sql.begin(async (tx) => {
    await tx.unsafe(contents);
    await tx`INSERT INTO schema_migrations (id, key, applied_at) VALUES (${file}, ${file}, ${Date.now()})`;
  });
  console.log(`[migrate] applied ${file}`);
}

async function main(): Promise<void> {
  const sql = postgres(connectionUrl(), { prepare: false, max: 1 });
  try {
    await ensureMigrationsTable(sql);
    const files = listMigrationFiles();
    if (files.length === 0) {
      console.log("[migrate] no migration files found in scripts/migrations");
      return;
    }
    let appliedCount = 0;
    for (const file of files) {
      if (await alreadyApplied(sql, file)) {
        console.log(`[migrate] skipping ${file} (already applied)`);
        continue;
      }
      await applyMigration(sql, file);
      appliedCount += 1;
    }
    console.log(
      appliedCount > 0
        ? `[migrate] done — applied ${appliedCount} migration(s).`
        : "[migrate] done — nothing to apply, schema already up to date.",
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error("[migrate] failed:", error);
  process.exitCode = 1;
});
