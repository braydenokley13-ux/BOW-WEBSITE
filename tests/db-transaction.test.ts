import assert from "node:assert/strict";
import test from "node:test";
import type { Sql } from "postgres";
import { PostgresDatabase, toPostgresSql } from "@/lib/db";

function createDatabaseHarness() {
  const poolQueries: string[] = [];
  const transactionQueries: string[] = [];
  let releases = 0;
  let activePoolQueries = 0;
  let maxActivePoolQueries = 0;

  const transactionClient = {
    async unsafe(source: string) {
      transactionQueries.push(source);
      return Object.assign([{ ok: 1 }], { count: 1 });
    },
    release() {
      releases += 1;
    },
  };

  const poolClient = {
    async unsafe(source: string) {
      poolQueries.push(source);
      activePoolQueries += 1;
      maxActivePoolQueries = Math.max(maxActivePoolQueries, activePoolQueries);
      try {
        await new Promise<void>((resolve) => setImmediate(resolve));
        return Object.assign([{ ok: 1 }], { count: 1 });
      } finally {
        activePoolQueries -= 1;
      }
    },
    async reserve() {
      // Keep reserve asynchronous: this is the boundary that previously made
      // the transaction context disappear before control returned to callers.
      await Promise.resolve();
      return transactionClient;
    },
  };

  return {
    db: new PostgresDatabase(poolClient as unknown as Sql),
    poolQueries,
    transactionQueries,
    releases: () => releases,
    maxActivePoolQueries: () => maxActivePoolQueries,
  };
}

test("BEGIN keeps following queries on the reserved client and COMMIT releases it", async () => {
  const harness = createDatabaseHarness();

  await harness.db.exec("BEGIN IMMEDIATE");
  assert.equal(harness.db.isTransaction, true);
  assert.deepEqual(await harness.db.prepare("SELECT 1 AS ok").get(), { ok: 1 });
  await harness.db.exec("COMMIT");

  assert.equal(harness.db.isTransaction, false);
  assert.deepEqual(harness.transactionQueries, ["BEGIN", "SELECT 1 AS ok", "COMMIT"]);
  assert.deepEqual(harness.poolQueries, []);
  assert.equal(harness.releases(), 1);
});

test("ordinary concurrent calls reach the pool one query at a time", async () => {
  const harness = createDatabaseHarness();

  await Promise.all(
    Array.from({ length: 12 }, (_, index) => harness.db.prepare(`SELECT ${index} AS ok`).get()),
  );

  assert.equal(harness.poolQueries.length, 12);
  assert.equal(harness.maxActivePoolQueries(), 1);
});

test("ROLLBACK releases the reserved client and restores ordinary pool queries", async () => {
  const harness = createDatabaseHarness();

  await harness.db.exec("BEGIN IMMEDIATE");
  await harness.db.prepare("SELECT 1 AS ok").get();
  await harness.db.exec("ROLLBACK");
  await harness.db.prepare("SELECT 2 AS ok").get();

  assert.deepEqual(harness.transactionQueries, ["BEGIN", "SELECT 1 AS ok", "ROLLBACK"]);
  assert.deepEqual(harness.poolQueries, ["SELECT 2 AS ok"]);
  assert.equal(harness.releases(), 1);
});

/* ---------------- SQLite-flavoured SQL that still has to run on Postgres ---------------- */

test("SQLite's null-safe IS is translated whether the right side is a parameter or a column", () => {
  // `IS ?` / `IS NOT ?` were already handled. Comparing two columns was not,
  // and Postgres rejects it outright — which took down submitSessionReport's
  // lesson-snapshot lookup and the instructor session page that shares it.
  assert.equal(
    toPostgresSql("SELECT 1 WHERE cohort.org_id IS c.partner_org_id"),
    "SELECT 1 WHERE cohort.org_id IS NOT DISTINCT FROM c.partner_org_id",
  );
  assert.equal(
    toPostgresSql("SELECT 1 WHERE cohort.org_id IS NOT c.partner_org_id"),
    "SELECT 1 WHERE cohort.org_id IS DISTINCT FROM c.partner_org_id",
  );
  assert.equal(
    toPostgresSql("SELECT 1 WHERE a.b IS ?"),
    "SELECT 1 WHERE a.b IS NOT DISTINCT FROM $1",
  );
});

test("translation leaves real Postgres IS predicates alone", () => {
  for (const source of [
    "SELECT 1 WHERE x.y IS NULL",
    "SELECT 1 WHERE x.y IS NOT NULL",
    "SELECT 1 WHERE x.y IS TRUE",
    "SELECT 1 WHERE x.y IS NOT DISTINCT FROM z.w",
    "SELECT 1 WHERE x.y IS DISTINCT FROM z.w",
  ]) {
    assert.equal(toPostgresSql(source), source, source);
  }
});
