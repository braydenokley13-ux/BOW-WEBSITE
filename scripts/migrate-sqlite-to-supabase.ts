/**
 * One-time SQLite -> Supabase Postgres migration.
 *
 * Usage:
 *   POSTGRES_URL_NON_POOLING='postgres://...' npm run db:migrate:supabase
 *   npm run db:migrate:supabase -- --source=/absolute/path/to/bow.db
 *
 * The target must be empty. Pass --force only when intentionally replacing a
 * previous test import; it drops only tables whose names exist in the source.
 */

import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import postgres from "postgres";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

type SqliteColumn = {
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
};

type SqliteIndex = { name: string; sql: string | null };
type SqliteForeignKey = {
  id: number;
  seq: number;
  table: string;
  from: string;
  to: string;
  on_update: string;
  on_delete: string;
};

const sourceArg = process.argv.find((value) => value.startsWith("--source="));
const sourcePath = path.resolve(sourceArg?.slice("--source=".length) || process.env.BOW_DATABASE_PATH || "data/bow.db");
const force = process.argv.includes("--force");
const targetUrl = (
  process.env.POSTGRES_URL_NON_POOLING
  ?? process.env.DATABASE_URL_NON_POOLING
  ?? process.env.DATABASE_URL
  ?? process.env.POSTGRES_URL
  ?? ""
).trim();

if (!targetUrl) throw new Error("Missing POSTGRES_URL_NON_POOLING (preferred) or POSTGRES_URL.");

const sqlite = new DatabaseSync(sourcePath, { readOnly: true });
const target = postgres(targetUrl, { prepare: false, max: 1, connect_timeout: 20 });

function identifier(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error(`Unsafe SQLite identifier: ${value}`);
  return `"${value}"`;
}

function postgresType(sqliteType: string): string {
  const value = sqliteType.toUpperCase();
  if (value.includes("BLOB")) return "bytea";
  if (value.includes("REAL") || value.includes("FLOA") || value.includes("DOUB")) return "double precision";
  // Existing application values are JavaScript-safe integers (including epoch
  // milliseconds). double precision keeps postgres.js results as numbers.
  if (value.includes("INT")) return "double precision";
  if (value.includes("NUM") || value.includes("DEC")) return "double precision";
  return "text";
}

function postgresDefault(value: string | null): string {
  if (value == null) return "";
  if (/^datetime\('now'\)$/i.test(value)) {
    return " DEFAULT to_char(now() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')";
  }
  if (/^(NULL|-?\d+(?:\.\d+)?|'(?:[^']|'')*')$/i.test(value)) return ` DEFAULT ${value}`;
  throw new Error(`Unsupported SQLite default: ${value}`);
}

function action(value: string): string {
  const normalized = value.toUpperCase();
  return ["NO ACTION", "RESTRICT", "SET NULL", "SET DEFAULT", "CASCADE"].includes(normalized)
    ? normalized
    : "NO ACTION";
}

async function main() {
  const tables = sqlite
    .prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all() as { name: string }[];
  if (!tables.length) throw new Error(`No application tables found in ${sourcePath}.`);

  const existing = await target<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `;
  const sourceNames = new Set(tables.map((table) => table.name));
  const collisions = existing.map((table) => table.tablename).filter((name) => sourceNames.has(name));
  if (collisions.length && !force) {
    throw new Error(`Supabase already contains ${collisions.length} BOW table(s). Use a fresh database, or rerun with --force to replace this import.`);
  }

  if (force) {
    for (const table of [...tables].reverse()) {
      await target.unsafe(`DROP TABLE IF EXISTS ${identifier(table.name)} CASCADE`);
    }
  }

  await target.unsafe(`CREATE TABLE IF NOT EXISTS bow_sqlite_migration_metadata (
    key text PRIMARY KEY,
    value text NOT NULL,
    migrated_at timestamptz NOT NULL DEFAULT now()
  )`);

  for (const { name } of tables) {
    const columns = sqlite.prepare(`PRAGMA table_info(${identifier(name)})`).all() as SqliteColumn[];
    const primaryKey = columns.filter((column) => column.pk > 0).sort((a, b) => a.pk - b.pk);
    const definitions = columns.map((column) => {
      const nullable = column.notnull || column.pk ? " NOT NULL" : "";
      return `${identifier(column.name)} ${postgresType(column.type)}${nullable}${postgresDefault(column.dflt_value)}`;
    });
    if (primaryKey.length) definitions.push(`PRIMARY KEY (${primaryKey.map((column) => identifier(column.name)).join(", ")})`);
    await target.unsafe(`CREATE TABLE ${identifier(name)} (${definitions.join(", ")})`);
  }

  let copiedRows = 0;
  for (const { name } of tables) {
    const columns = sqlite.prepare(`PRAGMA table_info(${identifier(name)})`).all() as SqliteColumn[];
    const columnNames = columns.map((column) => column.name);
    const rows = sqlite.prepare(`SELECT * FROM ${identifier(name)}`).all() as Record<string, unknown>[];
    if (rows.length) {
      const placeholders = columnNames.map((_, index) => `$${index + 1}`).join(", ");
      const insert = `INSERT INTO ${identifier(name)} (${columnNames.map(identifier).join(", ")}) VALUES (${placeholders})`;
      await target.begin(async (transaction) => {
        for (const row of rows) await transaction.unsafe(insert, columnNames.map((column) => row[column]) as never[]);
      });
    }
    copiedRows += rows.length;
  }

  const indexes = sqlite
    .prepare("SELECT name, sql FROM sqlite_schema WHERE type = 'index' AND name NOT LIKE 'sqlite_%' AND sql IS NOT NULL ORDER BY name")
    .all() as SqliteIndex[];
  for (const index of indexes) {
    const sql = index.sql!.replace(/\s+COLLATE\s+NOCASE\b/gi, "");
    await target.unsafe(sql);
  }

  for (const { name } of tables) {
    const foreignKeys = sqlite.prepare(`PRAGMA foreign_key_list(${identifier(name)})`).all() as SqliteForeignKey[];
    const groups = Map.groupBy(foreignKeys, (foreignKey) => foreignKey.id);
    for (const [id, keys] of groups) {
      const ordered = keys.sort((a, b) => a.seq - b.seq);
      const constraint = identifier(`fk_${name}_${id}`);
      await target.unsafe(
        `ALTER TABLE ${identifier(name)} ADD CONSTRAINT ${constraint} FOREIGN KEY (${ordered.map((key) => identifier(key.from)).join(", ")}) REFERENCES ${identifier(ordered[0].table)} (${ordered.map((key) => identifier(key.to)).join(", ")}) ON UPDATE ${action(ordered[0].on_update)} ON DELETE ${action(ordered[0].on_delete)}`,
      );
    }
  }

  // The app connects with the server-side Postgres credential. Enabling RLS
  // with no public policies prevents Supabase's anonymous Data API role from
  // reading these private application tables.
  for (const { name } of tables) await target.unsafe(`ALTER TABLE ${identifier(name)} ENABLE ROW LEVEL SECURITY`);

  const triggers = sqlite
    .prepare("SELECT name, sql FROM sqlite_schema WHERE type = 'trigger' ORDER BY name")
    .all() as { name: string; sql: string }[];
  await target.unsafe(
    `INSERT INTO bow_sqlite_migration_metadata (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value, migrated_at = now()`,
    ["source_triggers", JSON.stringify(triggers)] as never[],
  );
  await target.unsafe(
    `INSERT INTO bow_sqlite_migration_metadata (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value, migrated_at = now()`,
    ["source_path", sourcePath] as never[],
  );

  for (const { name } of tables) {
    const sourceCount = Number((sqlite.prepare(`SELECT COUNT(*) AS count FROM ${identifier(name)}`).get() as { count: number }).count);
    const result = await target.unsafe<{ count: string }[]>(`SELECT COUNT(*)::text AS count FROM ${identifier(name)}`);
    const targetCount = Number(result[0].count);
    if (sourceCount !== targetCount) throw new Error(`Row-count mismatch for ${name}: SQLite=${sourceCount}, Supabase=${targetCount}`);
  }

  process.stdout.write(`Migrated ${tables.length} tables and ${copiedRows} rows from SQLite to Supabase.\n`);
  process.stdout.write("All row counts match. Set POSTGRES_URL in Vercel to the pooled Supabase URL.\n");
}

void (async () => {
  try {
    await main();
  } finally {
    sqlite.close();
    await target.end({ timeout: 5 });
  }
})().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
