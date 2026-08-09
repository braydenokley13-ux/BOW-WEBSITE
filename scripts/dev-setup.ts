/* ============================================================
 * scripts/dev-setup.ts — build a working database from empty.
 *
 * Runs the five setup steps in the only order that works:
 *
 *   1. dev-bootstrap.sql        legacy tables (users, organizations, ...)
 *   2. migrations --through 000 operations/classes/growth core
 *   3. migrate-people-work-os   role_assignments, openings, applications, ...
 *   4. migrations (all)         every remaining SQL migration
 *   5. public website content   current published CMS architecture
 *
 * Steps 2 and 3 are interleaved because 008_people_weekly_operations.sql
 * extends `role_assignments`, which step 3 creates, and step 3 needs
 * `tasks`, which step 2 creates.
 *
 * Usage: `npm run db:setup` (add `--seed` to also load dev seed data).
 *
 * Local/CI only: refuses to run unless the target host is loopback, or
 * ALLOW_REMOTE_DB_SETUP=1 is set explicitly.
 * ============================================================ */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

function connectionUrl(): string {
  const value = (
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    ""
  ).trim();
  if (!value) {
    throw new Error(
      "[setup] Missing POSTGRES_URL_NON_POOLING / POSTGRES_URL. Point it at a local Postgres, " +
        "e.g. postgres://postgres@127.0.0.1:5432/bow",
    );
  }
  return value;
}

function assertLocal(url: string): void {
  if (process.env.ALLOW_REMOTE_DB_SETUP === "1") return;
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    /* non-URL DSNs fall through to the check below */
  }
  const local = host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "";
  if (!local) {
    throw new Error(
      `[setup] Refusing to run against non-local host "${host}". This script creates and seeds ` +
        "development data and is not meant for a shared or production database. Set " +
        "ALLOW_REMOTE_DB_SETUP=1 if you are certain.",
    );
  }
}

function run(label: string, args: string[]): void {
  console.log(`\n[setup] ${label}`);
  const result = spawnSync("npx", ["tsx", ...args], { stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    throw new Error(`[setup] step failed: ${label}`);
  }
}

async function applyBootstrap(url: string): Promise<void> {
  console.log("\n[setup] 1/5 applying scripts/dev-bootstrap.sql");
  const sql = postgres(url, { prepare: false, max: 1 });
  try {
    const file = path.join(process.cwd(), "scripts", "dev-bootstrap.sql");
    await sql.unsafe(readFileSync(file, "utf8"));
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function main(): Promise<void> {
  const url = connectionUrl();
  assertLocal(url);

  await applyBootstrap(url);
  run("2/5 migrations through 000", ["scripts/run-migrations.ts", "--through", "000"]);
  run("3/5 people & work engine", ["scripts/migrate-people-work-os.ts"]);
  run("4/5 remaining migrations", ["scripts/run-migrations.ts"]);
  run("5/5 public website content", ["scripts/seed-site-content.ts"]);

  if (process.argv.includes("--seed")) {
    run("seed: development data", ["scripts/seed-dev.ts"]);
  }

  console.log("\n[setup] done — schema is up to date.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
