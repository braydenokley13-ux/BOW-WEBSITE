"use server";

/* ============================================================
 * app/actions/learn-release.ts — Stage 8: instructor/admin release-state
 * writes for learn_release_state (migration 004).
 *
 * Generalizes the legacy `cohorts.current_lesson_id` pacing advance and the
 * per-student `enrollments.unlocked_lesson_id` override (docs/learn/
 * stage0-audit.md §3) into one release table read by lib/learn/unlock.ts +
 * lib/learn/home.ts (requiresInstructorRelease / opensAt). Native
 * postgres.js only (sqlLearn) per repo convention — never lib/db.ts's
 * toPostgresSql() for these rows.
 *
 * Ownership gate: an `instructor` may only release/revoke for a cohort they
 * own (`cohorts.instructor_id = user.id`, the legacy dev-bootstrap schema's
 * modeling of instructor->cohort ownership). `admin` may act on any cohort.
 * Student-scoped overrides require the instructor to own at least one
 * cohort the student is actively enrolled in.
 * ============================================================ */

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/dal";
import { getDb } from "@/lib/db";
import { sqlLearn } from "@/lib/db-sql";

export type ActionResult<T> = T | { ok: false; error: string };

/* ---------------- ownership checks (legacy cohorts table, lib/db.ts pool) ---------------- */

async function instructorOwnsCohort(instructorUserId: string, cohortId: string): Promise<boolean> {
  const db = getDb();
  const row = await db.prepare("SELECT 1 FROM cohorts WHERE id = ? AND instructor_id = ?").get(cohortId, instructorUserId);
  return Boolean(row);
}

/**
 * True if the instructor owns at least one cohort the student is actively
 * enrolled in. Exported for app/actions/learn-review.ts's manual-review
 * queue, which gates on the same "my student" relationship.
 */
export async function instructorOwnsStudentViaCohort(instructorUserId: string, studentUserId: string): Promise<boolean> {
  const db = getDb();
  const row = await db.prepare(
    `SELECT 1 FROM enrollments e
     JOIN cohorts c ON c.id = e.cohort_id
     WHERE e.user_id = ? AND e.enroll <> 'inactive' AND c.instructor_id = ?`,
  ).get(studentUserId, instructorUserId);
  return Boolean(row);
}

async function assertScopeOwnership(
  user: { id: string; role: string },
  scopeType: "cohort" | "student",
  scopeId: string,
): Promise<string | null> {
  if (user.role === "admin") return null;
  if (scopeType === "cohort") {
    if (!(await instructorOwnsCohort(user.id, scopeId))) return "You can only manage cohorts you instruct.";
    return null;
  }
  if (!(await instructorOwnsStudentViaCohort(user.id, scopeId))) {
    return "You can only manage students enrolled in a cohort you instruct.";
  }
  return null;
}

/* ---------------- target validation (node/module existence, no cross-track leakage) ---------------- */

async function nodeExists(nodeId: string): Promise<boolean> {
  const rows = await sqlLearn<{ id: string }[]>`SELECT id FROM learn_map_nodes WHERE id = ${nodeId}`;
  return rows.length > 0;
}

async function moduleExists(moduleId: string): Promise<boolean> {
  const rows = await sqlLearn<{ id: string }[]>`SELECT id FROM learn_modules WHERE id = ${moduleId}`;
  return rows.length > 0;
}

/* ---------------- release ---------------- */

export interface ReleaseTarget {
  nodeId?: string;
  moduleId?: string;
  scopeType: "cohort" | "student";
  scopeId: string;
  /** Epoch ms; omit/undefined for an immediate release. */
  opensAt?: number | null;
}

export interface ReleaseResult {
  ok: true;
  id: string;
}

export async function releaseToScope(target: ReleaseTarget): Promise<ActionResult<ReleaseResult>> {
  const user = await requireRole("instructor", "admin");

  if (!target.nodeId && !target.moduleId) return { ok: false, error: "A node or module must be specified" };
  if (target.nodeId && target.moduleId) return { ok: false, error: "Specify exactly one of node or module" };

  const ownershipError = await assertScopeOwnership(user, target.scopeType, target.scopeId);
  if (ownershipError) return { ok: false, error: ownershipError };

  if (target.nodeId && !(await nodeExists(target.nodeId))) return { ok: false, error: "Map node not found" };
  if (target.moduleId && !(await moduleExists(target.moduleId))) return { ok: false, error: "Module not found" };

  const now = Date.now();
  const id = `rel-${randomUUID().slice(0, 12)}`;

  // One active release row per (target, scope) — replace rather than
  // accumulate duplicates (e.g. re-releasing with a new opens_at).
  await sqlLearn`
    DELETE FROM learn_release_state
    WHERE scope_type = ${target.scopeType} AND scope_id = ${target.scopeId}
      AND ${target.nodeId ? sqlLearn`node_id = ${target.nodeId}` : sqlLearn`module_id = ${target.moduleId as string}`}
  `;
  await sqlLearn`
    INSERT INTO learn_release_state (id, node_id, module_id, scope_type, scope_id, released_by, released_at, opens_at)
    VALUES (${id}, ${target.nodeId ?? null}, ${target.moduleId ?? null}, ${target.scopeType}, ${target.scopeId},
            ${user.id}, ${now}, ${target.opensAt ?? null})
  `;

  revalidatePath("/dashboard");
  revalidatePath("/app/instructor");
  return { ok: true, id };
}

/* ---------------- revoke ---------------- */

export interface RevokeTarget {
  nodeId?: string;
  moduleId?: string;
  scopeType: "cohort" | "student";
  scopeId: string;
}

export async function revokeFromScope(target: RevokeTarget): Promise<ActionResult<{ ok: true }>> {
  const user = await requireRole("instructor", "admin");

  if (!target.nodeId && !target.moduleId) return { ok: false, error: "A node or module must be specified" };
  if (target.nodeId && target.moduleId) return { ok: false, error: "Specify exactly one of node or module" };

  const ownershipError = await assertScopeOwnership(user, target.scopeType, target.scopeId);
  if (ownershipError) return { ok: false, error: ownershipError };

  await sqlLearn`
    DELETE FROM learn_release_state
    WHERE scope_type = ${target.scopeType} AND scope_id = ${target.scopeId}
      AND ${target.nodeId ? sqlLearn`node_id = ${target.nodeId}` : sqlLearn`module_id = ${target.moduleId as string}`}
  `;

  revalidatePath("/dashboard");
  revalidatePath("/app/instructor");
  return { ok: true };
}

/* ---------------- listing (for instructor console) ---------------- */

export interface ReleaseStateRow {
  id: string;
  nodeId: string | null;
  moduleId: string | null;
  scopeType: "cohort" | "program" | "student";
  scopeId: string;
  releasedBy: string | null;
  releasedAt: number | null;
  opensAt: number | null;
}

/** All release rows for a cohort the instructor owns (or any cohort, for admin). */
export async function listReleasesForCohort(cohortId: string): Promise<ActionResult<ReleaseStateRow[]>> {
  const user = await requireRole("instructor", "admin");
  const ownershipError = await assertScopeOwnership(user, "cohort", cohortId);
  if (ownershipError) return { ok: false, error: ownershipError };

  const rows = await sqlLearn<{
    id: string; node_id: string | null; module_id: string | null; scope_type: "cohort" | "program" | "student";
    scope_id: string; released_by: string | null; released_at: number | null; opens_at: number | null;
  }[]>`
    SELECT id, node_id, module_id, scope_type, scope_id, released_by, released_at, opens_at
    FROM learn_release_state
    WHERE scope_id = ${cohortId} AND scope_type = 'cohort'
    ORDER BY released_at DESC NULLS LAST
  `;
  return rows.map((r) => ({
    id: r.id, nodeId: r.node_id, moduleId: r.module_id, scopeType: r.scope_type,
    scopeId: r.scope_id, releasedBy: r.released_by, releasedAt: r.released_at, opensAt: r.opens_at,
  }));
}
