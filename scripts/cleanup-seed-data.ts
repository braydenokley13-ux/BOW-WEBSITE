/* ============================================================
 * scripts/cleanup-seed-data.ts — remove known seed/demo/fixture records.
 *
 * Targets ONLY the literal ids that scripts/seed-dev.ts, scripts/
 * seed-learn-demo.ts, and scripts/dev-bootstrap.sql are documented to
 * create. Nothing here is inferred from "looks old" or "looks fake" —
 * every id below is copied from the seed script that creates it, so a
 * record only gets deleted if it is provably one this repo's own seed
 * tooling would (re)create.
 *
 * Two records those scripts create are NOT deleted, ever, by this script:
 * the `organizations` rows and the `users` rows they seed. Those ids
 * (org-bow/org-school/org-youth, u-admin/u-growth/u-coach/u-coach2/
 * u-s1/u-s2/u-s3) collide with what would also be the *real* company
 * org and the founder/staff accounts on the real bowsportscapital.org
 * domain — there is no way from the database alone to tell a seeded
 * placeholder apart from the real thing once the real org/founder has
 * been created with the same conventions. Per the safety rule ("when in
 * doubt, preserve it"), those are only ever reported for a human to
 * confirm — never auto-deleted.
 *
 * Modes:
 *   npm run cleanup:seed              -> dry run (default). Reports what
 *                                         it WOULD delete; deletes nothing.
 *   npm run cleanup:seed -- --execute -> deletes, inside one transaction,
 *                                         in FK-safe (children-first) order.
 *                                         Requires CONFIRM_CLEANUP=DELETE-SEED-DATA
 *                                         in the environment as a second,
 *                                         explicit confirmation.
 *
 * Idempotent: every delete is `WHERE id = ANY($ids)`; rows already gone
 * are simply not reported/counted again. Safe to run repeatedly.
 * ============================================================ */

import postgres from "postgres";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const EXECUTE = process.argv.includes("--execute");

function connectionUrl(): string {
  const value = (
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    ""
  ).trim();
  if (!value) throw new Error("[cleanup] Missing POSTGRES_URL_NON_POOLING / POSTGRES_URL.");
  return value;
}

type Target = {
  table: string;
  idColumn: string;
  ids: string[];
  source: string;
};

/**
 * Children-first order so foreign keys never block a delete. Every id here
 * is copied verbatim from the seed script named in `source`.
 */
const TARGETS: Target[] = [
  // --- scripts/seed-dev.ts -------------------------------------------------
  { table: "crm_activity", idColumn: "id", ids: ["dev-act-1", "dev-act-2", "dev-act-3"], source: "seed-dev.ts" },
  { table: "inquiries", idColumn: "id", ids: ["dev-inq-westview", "dev-inq-parent"], source: "seed-dev.ts" },
  { table: "operating_goals", idColumn: "id", ids: ["dev-goal-midwest"], source: "seed-dev.ts" },
  { table: "growth_campaigns", idColumn: "id", ids: ["dev-camp-lincoln"], source: "seed-dev.ts" },
  { table: "growth_channels", idColumn: "id", ids: ["dev-chan-referral", "dev-chan-partner"], source: "seed-dev.ts" },
  {
    table: "tasks",
    idColumn: "id",
    ids: [
      "dev-task-decide-tasha",
      "dev-task-staff-omaha",
      "dev-task-renewal-lincoln",
      "dev-task-session-report",
      "dev-task-diego-forms",
    ],
    source: "seed-dev.ts",
  },
  {
    table: "attendance_records",
    idColumn: "id",
    ids: ["dev-att-jalen-reported", "dev-att-maya-reported", "dev-att-diego-reported"],
    source: "seed-dev.ts",
  },
  {
    table: "class_enrollments",
    idColumn: "id",
    ids: ["dev-enr-jalen", "dev-enr-maya", "dev-enr-diego"],
    source: "seed-dev.ts",
  },
  { table: "class_session_reports", idColumn: "id", ids: ["dev-report-reported"], source: "seed-dev.ts" },
  {
    table: "class_sessions",
    idColumn: "id",
    ids: ["dev-sess-past", "dev-sess-reported", "dev-sess-today", "dev-sess-next", "dev-sess-later"],
    source: "seed-dev.ts",
  },
  { table: "class_instructors", idColumn: "id", ids: ["dev-ci-marcus-lincoln"], source: "seed-dev.ts" },
  { table: "classes", idColumn: "id", ids: ["dev-class-lincoln-a", "dev-class-omaha-a"], source: "seed-dev.ts" },
  { table: "students", idColumn: "id", ids: ["dev-stu-jalen", "dev-stu-maya", "dev-stu-diego"], source: "seed-dev.ts" },
  {
    table: "training_module_completions",
    idColumn: "id",
    ids: ["dev-tmc-marcus-safety", "dev-tmc-marcus-delivery", "dev-tmc-priya-safety"],
    source: "seed-dev.ts",
  },
  {
    table: "training_modules",
    idColumn: "id",
    ids: ["dev-tm-safety", "dev-tm-delivery", "dev-tm-feedback"],
    source: "seed-dev.ts",
  },
  { table: "instructor_qualifications", idColumn: "id", ids: ["dev-qual-marcus-bg"], source: "seed-dev.ts" },
  {
    table: "instructor_availability",
    idColumn: "id",
    ids: ["dev-avail-marcus-tue", "dev-avail-marcus-thu"],
    source: "seed-dev.ts",
  },
  {
    table: "instructors",
    idColumn: "id",
    ids: ["dev-instr-marcus", "dev-instr-priya", "dev-instr-tasha"],
    source: "seed-dev.ts",
  },
  {
    table: "programs",
    idColumn: "id",
    ids: ["dev-prog-lincoln-fall", "dev-prog-omaha-spring", "dev-prog-lincoln-spring"],
    source: "seed-dev.ts",
  },
  { table: "curricula", idColumn: "id", ids: ["dev-curr-101"], source: "seed-dev.ts" },
  {
    table: "partner_orgs",
    idColumn: "id",
    ids: ["dev-partner-lincoln", "dev-partner-eastside"],
    source: "seed-dev.ts",
  },
  { table: "locations", idColumn: "id", ids: ["dev-loc-lincoln", "dev-loc-omaha"], source: "seed-dev.ts" },
  { table: "operating_regions", idColumn: "id", ids: ["dev-region-midwest"], source: "seed-dev.ts" },
  {
    table: "people",
    idColumn: "id",
    ids: [
      "person-dana",
      "person-marcus",
      "person-priya",
      "person-jalen",
      "person-maya",
      "person-diego",
      "person-coach-applicant",
      "person-partner-contact",
    ],
    source: "seed-dev.ts",
  },

  // --- scripts/seed-learn-demo.ts ------------------------------------------
  { table: "badges", idColumn: "id", ids: ["pricing_strategist"], source: "seed-learn-demo.ts" },
  {
    table: "learn_map_nodes",
    idColumn: "id",
    ids: ["map-node-1", "map-node-2", "map-node-3", "map-node-4"],
    source: "seed-learn-demo.ts",
  },
  {
    table: "learn_map_sections",
    idColumn: "id",
    ids: ["map-section-ticket-ops", "map-section-front-office"],
    source: "seed-learn-demo.ts",
  },
  { table: "learn_skills", idColumn: "id", ids: ["skill-pricing-strategy"], source: "seed-learn-demo.ts" },
  {
    table: "learn_lesson_versions",
    idColumn: "lesson_id",
    ids: ["lesson-rivalry-ticket-pricing", "lesson-draft-night-analytics"],
    source: "seed-learn-demo.ts",
  },
  {
    table: "learn_lessons",
    idColumn: "id",
    ids: ["lesson-rivalry-ticket-pricing", "lesson-draft-night-analytics"],
    source: "seed-learn-demo.ts",
  },
  { table: "learn_modules", idColumn: "id", ids: ["module-rivalry-demo"], source: "seed-learn-demo.ts" },
  { table: "learn_tracks", idColumn: "id", ids: ["track-rivalry-demo"], source: "seed-learn-demo.ts" },

  // --- scripts/dev-bootstrap.sql (legacy local-only schema) ---------------
  // Only present at all if that legacy schema was ever applied somewhere;
  // table-existence is checked before querying. 'org-bow' is deliberately
  // excluded (see the ambiguous-organizations note below).
  { table: "cohorts", idColumn: "id", ids: ["cohort-1"], source: "dev-bootstrap.sql" },
  { table: "users", idColumn: "id", ids: ["user-instr-1"], source: "dev-bootstrap.sql (legacy schema)" },
];

/**
 * Deliberately NOT deleted — reported only, for founder review. See header
 * comment: these ids collide with what would also be real org/founder rows.
 */
const AMBIGUOUS: Target[] = [
  {
    table: "organizations",
    idColumn: "id",
    ids: ["org-bow", "org-school", "org-youth"],
    source: "seed-dev.ts (also plausibly the real org record)",
  },
  {
    table: "users",
    idColumn: "id",
    ids: ["u-admin", "u-growth", "u-coach", "u-coach2", "u-s1", "u-s2", "u-s3"],
    source: "seed-dev.ts (u-admin/u-growth use real @bowsportscapital.org addresses)",
  },
];

async function tableExists(sql: postgres.Sql, table: string): Promise<boolean> {
  const rows = await sql`SELECT to_regclass(${"public." + table}) AS reg`;
  return rows[0]?.reg != null;
}

async function findExisting(sql: postgres.Sql, t: Target): Promise<string[]> {
  if (!(await tableExists(sql, t.table))) return [];
  const rows = await sql`
    SELECT DISTINCT ${sql(t.idColumn)} AS val FROM ${sql(t.table)}
    WHERE ${sql(t.idColumn)} = ANY(${t.ids})
  `;
  return rows.map((r: any) => r.val);
}

async function report(sql: postgres.Sql): Promise<{ deletable: Map<Target, string[]>; total: number }> {
  const deletable = new Map<Target, string[]>();
  let total = 0;

  console.log("\n=== Seed-data inventory ===\n");
  for (const t of TARGETS) {
    const found = await findExisting(sql, t);
    deletable.set(t, found);
    total += found.length;
    if (found.length > 0) {
      console.log(`[DELETE-CANDIDATE] ${t.table} (${t.source}): ${found.length} row(s) — ${found.join(", ")}`);
    } else {
      console.log(`[clean]             ${t.table} (${t.source}): 0 matching rows`);
    }
  }

  console.log("\n=== Ambiguous — NOT deleted, requires founder review ===\n");
  for (const t of AMBIGUOUS) {
    const found = await findExisting(sql, t);
    if (found.length > 0) {
      console.log(`[REVIEW] ${t.table} (${t.source}): ${found.join(", ")}`);
    } else {
      console.log(`[clean]  ${t.table} (${t.source}): 0 matching rows`);
    }
  }

  console.log(`\n=== Total deletable candidates: ${total} row(s) across ${TARGETS.length} table(s) ===\n`);
  return { deletable, total };
}

async function execute(sql: postgres.Sql, deletable: Map<Target, string[]>): Promise<void> {
  await sql.begin(async (tx) => {
    for (const [t, found] of deletable) {
      if (found.length === 0) continue;
      const result = await tx`DELETE FROM ${tx(t.table)} WHERE ${tx(t.idColumn)} = ANY(${found})`;
      console.log(`[deleted] ${t.table}: ${result.count} row(s)`);
    }
  });
}

async function main(): Promise<void> {
  const sql = postgres(connectionUrl(), { prepare: false, max: 1 });
  try {
    const { deletable, total } = await report(sql);

    if (!EXECUTE) {
      console.log("[cleanup] Dry run only — no rows deleted. Re-run with --execute to delete.");
      return;
    }

    if (total === 0) {
      console.log("[cleanup] Nothing to delete. Already clean.");
      return;
    }

    if (process.env.CONFIRM_CLEANUP !== "DELETE-SEED-DATA") {
      throw new Error(
        "[cleanup] --execute requires CONFIRM_CLEANUP=DELETE-SEED-DATA in the environment as an explicit second confirmation.",
      );
    }

    console.log("[cleanup] Executing delete in a single transaction...");
    await execute(sql, deletable);
    console.log("[cleanup] Done.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error("[cleanup] failed:", error);
  process.exitCode = 1;
});
