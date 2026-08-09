/* ============================================================
 * scripts/cleanup-seed-identities.ts
 *
 * Safely removes only confirmed demo users and demo organizations.
 *
 * NEVER deletes:
 *   - public.users.id = 'u-admin'  (Brayden White, founder/admin)
 *   - public.organizations.id = 'org-bow' (real BOW organization)
 *
 * Behavior:
 *   - Dry-run by default.
 *   - Discovers every single-column foreign key that points to
 *     public.users(id) or public.organizations(id).
 *   - Prints exact blockers instead of crashing.
 *   - On --execute, deletes only confirmed demo identities that have
 *     zero remaining foreign-key references.
 *   - Re-checks organization blockers after user cleanup.
 *   - Never cascades, disables constraints, or deletes dependent rows.
 *
 * Run:
 *   npx tsx scripts/cleanup-seed-identities.ts
 *
 * Execute:
 *   CONFIRM_CLEANUP=DELETE-CONFIRMED-DEMO-IDENTITIES \
 *   npx tsx scripts/cleanup-seed-identities.ts --execute
 * ============================================================ */

import postgres from "postgres";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const EXECUTE = process.argv.includes("--execute");
const CONFIRMATION = "DELETE-CONFIRMED-DEMO-IDENTITIES";

const FOUNDER = {
  id: "u-admin",
  email: "braydenokley13@gmail.com",
  orgId: "org-bow",
} as const;

const PROTECTED_USER_IDS = [FOUNDER.id] as const;
const PROTECTED_ORG_IDS = ["org-bow"] as const;

/**
 * Explicitly confirmed demo identities.
 *
 * u-admin is intentionally absent because it is Brayden White's real,
 * auth-linked founder/admin account even though the internal id looks seeded.
 */
const DEMO_USER_IDS = [
  "u-growth",
  "u-coach",
  "u-coach2",
  "u-s1",
  "u-s2",
  "u-s3",
  "u-s4",
  "u-s5",
  "u-s6",
  "u-s7",
  "u-s8",
  "u-s9",
  "u-s10",
  "u-s11",
  "u-s12",
  "u-self1",
  "u-self2",
  "u-self3",
  "u-self4",
  "u-self5",
] as const;

const DEMO_ORG_IDS = ["org-school", "org-youth"] as const;

// Query helpers are used both on the root client and inside `sql.begin`.
// Both expose the same tagged-query surface; transactions intentionally omit
// connection-lifecycle methods such as `end` and `reserve`.
type Db = postgres.Sql | postgres.TransactionSql;

type ForeignKey = {
  childSchema: string;
  childTable: string;
  childColumn: string;
  constraintName: string;
};

type Blocker = ForeignKey & {
  targetId: string;
  matchingRows: number;
};

function connectionUrl(): string {
  const value = (
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    ""
  ).trim();

  if (!value) {
    throw new Error(
      "[cleanup] Missing POSTGRES_URL_NON_POOLING, POSTGRES_URL, or DATABASE_URL.",
    );
  }

  return value;
}

function assertNoProtectedOverlap(): void {
  for (const id of DEMO_USER_IDS) {
    if ((PROTECTED_USER_IDS as readonly string[]).includes(id)) {
      throw new Error(`[cleanup] Refusing to run: protected user ${id} is in DEMO_USER_IDS.`);
    }
  }

  for (const id of DEMO_ORG_IDS) {
    if ((PROTECTED_ORG_IDS as readonly string[]).includes(id)) {
      throw new Error(`[cleanup] Refusing to run: protected org ${id} is in DEMO_ORG_IDS.`);
    }
  }
}

async function assertFounderIsProtected(sql: Db): Promise<void> {
  const rows = await sql`
    SELECT id, email, org_id, status, auth_user_id
    FROM public.users
    WHERE id = ${FOUNDER.id}
  `;

  if (rows.length !== 1) {
    throw new Error(
      `[cleanup] Founder guard failed: expected exactly one public.users row with id=${FOUNDER.id}.`,
    );
  }

  const founder = rows[0];

  if (
    String(founder.email).toLowerCase() !== FOUNDER.email.toLowerCase() ||
    founder.org_id !== FOUNDER.orgId ||
    founder.status !== "active" ||
    founder.auth_user_id == null
  ) {
    throw new Error(
      "[cleanup] Founder guard failed: u-admin is not the expected active, auth-linked Brayden founder account.",
    );
  }

  const orgRows = await sql`
    SELECT id
    FROM public.organizations
    WHERE id = ${FOUNDER.orgId}
  `;

  if (orgRows.length !== 1) {
    throw new Error(
      `[cleanup] Founder guard failed: expected public.organizations.id=${FOUNDER.orgId}.`,
    );
  }
}

async function existingIds(
  sql: Db,
  table: "users" | "organizations",
  ids: readonly string[],
): Promise<string[]> {
  if (ids.length === 0) return [];

  const rows = await sql`
    SELECT id
    FROM public.${sql(table)}
    WHERE id = ANY(${ids as string[]})
    ORDER BY id
  `;

  return rows.map((row) => String(row.id));
}

async function foreignKeysTo(
  sql: Db,
  parentTable: "users" | "organizations",
): Promise<ForeignKey[]> {
  const rows = await sql`
    SELECT
      child_ns.nspname AS child_schema,
      child_table.relname AS child_table,
      child_column.attname AS child_column,
      constraint_info.conname AS constraint_name
    FROM pg_constraint AS constraint_info
    JOIN pg_class AS child_table
      ON child_table.oid = constraint_info.conrelid
    JOIN pg_namespace AS child_ns
      ON child_ns.oid = child_table.relnamespace
    JOIN pg_class AS parent_table
      ON parent_table.oid = constraint_info.confrelid
    JOIN pg_namespace AS parent_ns
      ON parent_ns.oid = parent_table.relnamespace
    JOIN LATERAL unnest(constraint_info.conkey)
      WITH ORDINALITY AS child_key(attnum, position)
      ON true
    JOIN LATERAL unnest(constraint_info.confkey)
      WITH ORDINALITY AS parent_key(attnum, position)
      ON parent_key.position = child_key.position
    JOIN pg_attribute AS child_column
      ON child_column.attrelid = child_table.oid
     AND child_column.attnum = child_key.attnum
    JOIN pg_attribute AS parent_column
      ON parent_column.attrelid = parent_table.oid
     AND parent_column.attnum = parent_key.attnum
    WHERE constraint_info.contype = 'f'
      AND child_ns.nspname = 'public'
      AND parent_ns.nspname = 'public'
      AND parent_table.relname = ${parentTable}
      AND parent_column.attname = 'id'
      AND array_length(constraint_info.conkey, 1) = 1
    ORDER BY child_table.relname, child_column.attname
  `;

  return rows.map((row) => ({
    childSchema: String(row.child_schema),
    childTable: String(row.child_table),
    childColumn: String(row.child_column),
    constraintName: String(row.constraint_name),
  }));
}

async function blockersFor(
  sql: Db,
  parentTable: "users" | "organizations",
  ids: readonly string[],
): Promise<Blocker[]> {
  const fks = await foreignKeysTo(sql, parentTable);
  const blockers: Blocker[] = [];

  for (const fk of fks) {
    for (const targetId of ids) {
      const rows = await sql`
        SELECT count(*)::int AS matching_rows
        FROM ${sql(fk.childSchema)}.${sql(fk.childTable)}
        WHERE ${sql(fk.childColumn)} = ${targetId}
      `;

      const matchingRows = Number(rows[0]?.matching_rows ?? 0);

      if (matchingRows > 0) {
        blockers.push({
          ...fk,
          targetId,
          matchingRows,
        });
      }
    }
  }

  return blockers;
}

function blockersById(blockers: Blocker[]): Map<string, Blocker[]> {
  const grouped = new Map<string, Blocker[]>();

  for (const blocker of blockers) {
    const current = grouped.get(blocker.targetId) ?? [];
    current.push(blocker);
    grouped.set(blocker.targetId, current);
  }

  return grouped;
}

function printIdentityReport(
  label: string,
  ids: string[],
  blockers: Blocker[],
): void {
  const grouped = blockersById(blockers);

  console.log(`\n=== ${label} ===\n`);

  if (ids.length === 0) {
    console.log("[clean] No matching confirmed demo identities remain.");
    return;
  }

  for (const id of ids) {
    const rows = grouped.get(id) ?? [];

    if (rows.length === 0) {
      console.log(`[READY] ${id}: zero foreign-key references`);
      continue;
    }

    console.log(`[BLOCKED] ${id}:`);
    for (const row of rows) {
      console.log(
        `  - ${row.childSchema}.${row.childTable}.${row.childColumn}: ` +
          `${row.matchingRows} row(s) [${row.constraintName}]`,
      );
    }
  }
}

async function printProtectedRecords(sql: Db): Promise<void> {
  const users = await sql`
    SELECT id, name, email, role, org_id, status, auth_user_id
    FROM public.users
    WHERE id = ANY(${PROTECTED_USER_IDS as unknown as string[]})
    ORDER BY id
  `;

  const orgs = await sql`
    SELECT id, name, type, status
    FROM public.organizations
    WHERE id = ANY(${PROTECTED_ORG_IDS as unknown as string[]})
    ORDER BY id
  `;

  console.log("\n=== Protected — NEVER deleted ===\n");

  for (const user of users) {
    console.log(
      `[PROTECTED USER] ${user.id}: ${user.name} <${user.email}> ` +
        `role=${user.role} org=${user.org_id} auth_linked=${user.auth_user_id != null}`,
    );
  }

  for (const org of orgs) {
    console.log(
      `[PROTECTED ORG] ${org.id}: ${org.name} type=${org.type} status=${org.status}`,
    );
  }
}

async function deleteUnblockedUsers(
  sql: Db,
  ids: string[],
  blockers: Blocker[],
): Promise<string[]> {
  const blockedIds = new Set(blockers.map((blocker) => blocker.targetId));
  const deletable = ids.filter((id) => !blockedIds.has(id));

  for (const id of deletable) {
    const result = await sql`
      DELETE FROM public.users
      WHERE id = ${id}
        AND id <> ALL(${PROTECTED_USER_IDS as unknown as string[]})
    `;

    console.log(`[deleted user] ${id}: ${result.count} row(s)`);
  }

  return deletable;
}

async function deleteUnblockedOrganizations(
  sql: Db,
  ids: string[],
  blockers: Blocker[],
): Promise<string[]> {
  const blockedIds = new Set(blockers.map((blocker) => blocker.targetId));
  const deletable = ids.filter((id) => !blockedIds.has(id));

  for (const id of deletable) {
    const result = await sql`
      DELETE FROM public.organizations
      WHERE id = ${id}
        AND id <> ALL(${PROTECTED_ORG_IDS as unknown as string[]})
    `;

    console.log(`[deleted org] ${id}: ${result.count} row(s)`);
  }

  return deletable;
}

async function report(sql: Db): Promise<void> {
  await assertFounderIsProtected(sql);
  await printProtectedRecords(sql);

  const demoUsers = await existingIds(sql, "users", DEMO_USER_IDS);
  const userBlockers = await blockersFor(sql, "users", demoUsers);
  printIdentityReport("Confirmed demo users", demoUsers, userBlockers);

  const demoOrgs = await existingIds(sql, "organizations", DEMO_ORG_IDS);
  const orgBlockers = await blockersFor(sql, "organizations", demoOrgs);
  printIdentityReport("Confirmed demo organizations", demoOrgs, orgBlockers);

  console.log(
    "\n[cleanup] Dry run only. READY identities can be deleted safely; " +
      "BLOCKED identities are preserved and their exact references are shown.",
  );
}

async function execute(sql: postgres.Sql): Promise<void> {
  if (process.env.CONFIRM_CLEANUP !== CONFIRMATION) {
    throw new Error(
      `[cleanup] --execute requires CONFIRM_CLEANUP=${CONFIRMATION}.`,
    );
  }

  await sql.begin(async (tx) => {
    await assertFounderIsProtected(tx);

    const demoUsers = await existingIds(tx, "users", DEMO_USER_IDS);
    const initialUserBlockers = await blockersFor(tx, "users", demoUsers);

    await deleteUnblockedUsers(tx, demoUsers, initialUserBlockers);

    const remainingUsers = await existingIds(tx, "users", DEMO_USER_IDS);
    const remainingUserBlockers = await blockersFor(tx, "users", remainingUsers);

    if (remainingUsers.length > 0) {
      printIdentityReport(
        "Demo users preserved because references remain",
        remainingUsers,
        remainingUserBlockers,
      );
    }

    /*
     * Recompute organization blockers after user deletion because demo users
     * themselves may have been the only rows referencing org-school/org-youth.
     */
    const demoOrgs = await existingIds(tx, "organizations", DEMO_ORG_IDS);
    const orgBlockers = await blockersFor(tx, "organizations", demoOrgs);

    await deleteUnblockedOrganizations(tx, demoOrgs, orgBlockers);

    const remainingOrgs = await existingIds(tx, "organizations", DEMO_ORG_IDS);
    const remainingOrgBlockers = await blockersFor(
      tx,
      "organizations",
      remainingOrgs,
    );

    if (remainingOrgs.length > 0) {
      printIdentityReport(
        "Demo organizations preserved because references remain",
        remainingOrgs,
        remainingOrgBlockers,
      );
    }

    await assertFounderIsProtected(tx);
  });

  console.log(
    "\n[cleanup] Finished safely. u-admin and org-bow were protected. " +
      "Any blocked demo identities were left untouched.",
  );
}

async function main(): Promise<void> {
  assertNoProtectedOverlap();

  const sql = postgres(connectionUrl(), {
    prepare: false,
    max: 1,
  });

  try {
    if (EXECUTE) {
      await execute(sql);
    } else {
      await report(sql);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error("[cleanup] failed:", error);
  process.exitCode = 1;
});
