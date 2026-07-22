"use server";

/* ============================================================
 * app/actions/learn-play.ts — Stage 2 thin-player server actions.
 *
 * Native postgres.js only (sqlLearn / withTransaction) — never lib/db.ts's
 * toPostgresSql() for these JSONB-heavy tables (docs/learn/stage0-audit.md §1).
 * Server-authoritative: the client sends raw responses; score/variables/XP
 * are always recomputed here from the immutable version doc + persisted
 * responses, never trusted from the client.
 * ============================================================ */

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/dal";
import { sqlLearn, withTransaction } from "@/lib/db-sql";
import { migrateLessonDoc } from "@/lib/learn/compat";
import { computeResults, gradeBlock, type CommittedResponse } from "@/lib/learn/engine";
import type { LessonDoc } from "@/lib/learn/types";
import { recordDailyVisit } from "@/lib/streak";
import { checkAndAwardBadges } from "@/lib/badges";
import { evaluateBadgeRules, type AchievementContext, type RuleBadgeCandidate } from "@/lib/learn/achievements";
import { checkNodeUnlockForLesson, loadActiveCohortIds } from "@/lib/learn/home";
import { applyApprovedReviews } from "@/lib/learn/review";
import type { ResponseEntry } from "@/components/learn/player/playerState";

/* ---------------- shared helpers ---------------- */

function findBlock(doc: LessonDoc, blockId: string) {
  for (const phase of doc.phases) {
    const found = phase.blocks.find((b) => b.id === blockId);
    if (found) return found;
  }
  return undefined;
}

interface AttemptRow {
  id: string;
  user_id: string;
  lesson_id: string;
  version_id: string;
  mode: "play" | "test";
  status: "in_progress" | "completed" | "abandoned";
  started_at: number;
  completed_at: number | null;
  score: number | null;
  stars: number | null;
  xp_awarded: number | null;
  variables: Record<string, number>;
  path: string[];
  enrollment_context: { cohortId: string } | null;
}

async function loadVersionDoc(versionId: string): Promise<LessonDoc> {
  const rows = await sqlLearn<{ doc: unknown }[]>`
    SELECT doc FROM learn_lesson_versions WHERE id = ${versionId}
  `;
  if (rows.length === 0) throw new Error(`Lesson version ${versionId} not found`);
  return migrateLessonDoc(rows[0].doc);
}

/* ---------------- startAttempt ---------------- */

export interface StartAttemptResult {
  ok: true;
  attemptId: string;
  doc: LessonDoc;
  resume?: {
    responses: Record<string, ResponseEntry>;
    variables: Record<string, number>;
    path: string[];
  };
}

export type ActionResult<T> = T | { ok: false; error: string };

export async function startAttempt(lessonId: string, mode: "play" | "test" = "play"): Promise<ActionResult<StartAttemptResult>> {
  const user = await requireRole("student", "admin");

  const lessonRows = await sqlLearn<{ id: string; published_version_id: string | null }[]>`
    SELECT id, published_version_id FROM learn_lessons WHERE id = ${lessonId}
  `;
  const lesson = lessonRows[0];
  if (!lesson) return { ok: false, error: "Lesson not found" };
  if (!lesson.published_version_id) return { ok: false, error: "This lesson has no published version yet" };

  // Enforce the same unlock policy the CareerMap shows the student, so a
  // direct deep-link (or replay of an old URL) can't bypass a locked node.
  // Admin "Test as Student" runs (mode='test') intentionally skip this —
  // authors need to test locked content without unlocking it for real.
  if (mode === "play" && user.role !== "admin") {
    const unlockCheck = await checkNodeUnlockForLesson(user.id, lessonId);
    if (!unlockCheck.ok) return { ok: false, error: unlockCheck.reason };
  }

  const doc = await loadVersionDoc(lesson.published_version_id);

  // Resume an existing in_progress attempt on the SAME published version.
  const existing = await sqlLearn<AttemptRow[]>`
    SELECT id, user_id, lesson_id, version_id, mode, status, started_at, completed_at,
           score, stars, xp_awarded, variables, path, enrollment_context
    FROM learn_attempts
    WHERE user_id = ${user.id} AND lesson_id = ${lessonId} AND version_id = ${lesson.published_version_id}
      AND mode = ${mode} AND status = 'in_progress'
    ORDER BY started_at DESC LIMIT 1
  `;

  let attempt = existing[0];
  if (!attempt) {
    const id = `atmpt-${randomUUID().slice(0, 12)}`;
    const now = Date.now();
    // Stamp the student's active cohort as enrollment_context so
    // completeAttempt can upsert learn_assignment_progress for the same
    // scope the CareerMap/instructor console read (docs plan §1). A student
    // in multiple cohorts is stamped with the first active one; this
    // mirrors buildUnlockBasis's single-cohort simplification.
    const cohortIds = mode === "play" ? await loadActiveCohortIds(user.id) : [];
    const enrollmentContext = cohortIds[0] ? { cohortId: cohortIds[0] } : null;
    const inserted = await sqlLearn<AttemptRow[]>`
      INSERT INTO learn_attempts (id, user_id, lesson_id, version_id, mode, status, started_at, variables, path, enrollment_context)
      VALUES (${id}, ${user.id}, ${lessonId}, ${lesson.published_version_id}, ${mode}, 'in_progress', ${now}, '{}'::jsonb, '[]'::jsonb, ${enrollmentContext ? sqlLearn.json(enrollmentContext as never) : null})
      RETURNING id, user_id, lesson_id, version_id, mode, status, started_at, completed_at,
                score, stars, xp_awarded, variables, path, enrollment_context
    `;
    attempt = inserted[0];

    if (mode === "play" && enrollmentContext) {
      await sqlLearn`
        INSERT INTO learn_assignment_progress (user_id, context_type, context_id, lesson_id, status)
        VALUES (${user.id}, 'cohort', ${enrollmentContext.cohortId}, ${lessonId}, 'in_progress')
        ON CONFLICT (user_id, context_type, context_id, lesson_id) DO NOTHING
      `;
    }
  }

  // Reconstruct resume state from persisted responses, if any.
  const responseRows = await sqlLearn<{ block_id: string; instance_key: number; response: unknown; outcome: unknown; committed_at: number | null }[]>`
    SELECT block_id, instance_key, response, outcome, committed_at
    FROM learn_responses
    WHERE attempt_id = ${attempt.id}
    ORDER BY answered_at ASC
  `;

  const resumeResponses: Record<string, ResponseEntry> = {};
  const path: string[] = [];
  for (const row of responseRows) {
    if (row.committed_at) {
      resumeResponses[row.block_id] = {
        value: row.response,
        committed: true,
        outcome: (row.outcome as ResponseEntry["outcome"]) ?? undefined,
      };
      path.push(row.block_id);
    }
  }

  return {
    ok: true,
    attemptId: attempt.id,
    doc,
    resume: responseRows.length > 0 ? { responses: resumeResponses, variables: attempt.variables ?? {}, path } : undefined,
  };
}

/* ---------------- submitResponse ---------------- */

export interface SubmitResponseResult {
  ok: true;
  outcome: ReturnType<typeof gradeBlock>;
}

export async function submitResponse(
  attemptId: string,
  blockId: string,
  instanceKey: number,
  response: unknown,
): Promise<ActionResult<SubmitResponseResult>> {
  const user = await requireRole("student", "admin");

  const attemptRows = await sqlLearn<AttemptRow[]>`
    SELECT id, user_id, lesson_id, version_id, mode, status, started_at, completed_at,
           score, stars, xp_awarded, variables, path, enrollment_context
    FROM learn_attempts WHERE id = ${attemptId}
  `;
  const attempt = attemptRows[0];
  if (!attempt || attempt.user_id !== user.id) return { ok: false, error: "Attempt not found" };
  if (attempt.status !== "in_progress") return { ok: false, error: "This attempt is no longer in progress" };

  // Commit-once: an instance_key that's already committed is immutable.
  const already = await sqlLearn<{ committed_at: number | null }[]>`
    SELECT committed_at FROM learn_responses
    WHERE attempt_id = ${attemptId} AND block_id = ${blockId} AND instance_key = ${instanceKey}
  `;
  if (already[0]?.committed_at) {
    return { ok: false, error: "This response is already committed and cannot be changed" };
  }

  const doc = await loadVersionDoc(attempt.version_id);
  const block = findBlock(doc, blockId);
  if (!block) return { ok: false, error: `Unknown block "${blockId}" for this lesson version` };

  // Build grading context from previously committed responses on this attempt.
  const priorRows = await sqlLearn<{ block_id: string; response: unknown }[]>`
    SELECT block_id, response FROM learn_responses WHERE attempt_id = ${attemptId} AND committed_at IS NOT NULL
  `;
  const priorCommitted: CommittedResponse[] = priorRows.map((r) => ({ blockId: r.block_id, response: r.response }));
  const priorResults = computeResults(doc, priorCommitted);
  const outcome = gradeBlock(block, response, { variables: priorResults.variables, responses: Object.fromEntries(priorRows.map((r) => [r.block_id, r.response])) });

  const now = Date.now();
  const id = `resp-${randomUUID().slice(0, 12)}`;
  // A block committed without ever touching its input (e.g. locking in a
  // budget_allocation while every category is still at its displayed-but-
  // never-set default) can legitimately reach here with `response ===
  // undefined`. jsonb columns accept JSON `null` but the native postgres.js
  // client throws UNDEFINED_VALUE on a bare `undefined` parameter — coalesce
  // once here so no block type has to special-case "untouched" itself.
  const storedResponse = response === undefined ? null : (response as never);
  await sqlLearn`
    INSERT INTO learn_responses (id, attempt_id, block_id, instance_key, response, outcome, committed_at, answered_at)
    VALUES (${id}, ${attemptId}, ${blockId}, ${instanceKey}, ${sqlLearn.json(storedResponse)}, ${sqlLearn.json(outcome as never)}, ${now}, ${now})
    ON CONFLICT (attempt_id, block_id, instance_key) DO NOTHING
  `;

  // Manual-review queue (Stage 8 follow-up): a committed long_text response
  // in manual_review mode never scores itself (gradeBlock always returns
  // 0/0 for it) — it queues a pending row here instead, picked up by
  // app/actions/learn-review.ts's instructor queue. One row per
  // (attempt, block); a resubmit within the same instance_key can't happen
  // (commit-once above), so ON CONFLICT DO NOTHING is just defensive.
  if (block.type === "long_text" && block.reflection.mode === "manual_review") {
    const reviewId = `rev-${randomUUID().slice(0, 12)}`;
    await sqlLearn`
      INSERT INTO learn_manual_reviews (id, attempt_id, block_id, user_id, lesson_id, prompt, response_text, status, points_possible, created_at)
      VALUES (${reviewId}, ${attemptId}, ${blockId}, ${user.id}, ${attempt.lesson_id}, ${block.prompt},
              ${typeof response === "string" ? response : String(response ?? "")}, 'pending',
              ${block.reflection.pointsPossible ?? 0}, ${now})
      ON CONFLICT (attempt_id, block_id) DO NOTHING
    `;
  }

  return { ok: true, outcome };
}

/* ---------------- completeAttempt ---------------- */

export interface CompleteAttemptResult {
  ok: true;
  score: number;
  stars: number;
  xpAwarded: number;
  variables: Record<string, number>;
  skillDeltas: Record<string, number>;
  firstCompletion: boolean;
  mode: "play" | "test";
  /** Rule-based badges newly awarded by this completion (Stage 9), for the BadgeToast pathway. Empty on replay/idempotent returns. */
  newBadges: { id: string; name: string; icon: string }[];
}

export async function completeAttempt(attemptId: string): Promise<ActionResult<CompleteAttemptResult>> {
  const user = await requireRole("student", "admin");

  let result: CompleteAttemptResult;
  try {
    result = await withTransaction(async (tx) => {
    const rows = await tx<AttemptRow[]>`
      SELECT id, user_id, lesson_id, version_id, mode, status, started_at, completed_at,
             score, stars, xp_awarded, variables, path, enrollment_context
      FROM learn_attempts WHERE id = ${attemptId} FOR UPDATE
    `;
    const attempt = rows[0];
    if (!attempt || attempt.user_id !== user.id) {
      throw new Error("Attempt not found");
    }

    // Idempotent convergence: a retried completeAttempt on an already-completed
    // attempt returns the stored result rather than recomputing/re-awarding.
    if (attempt.status === "completed") {
      return {
        ok: true as const,
        score: attempt.score ?? 0,
        stars: attempt.stars ?? 0,
        xpAwarded: attempt.xp_awarded ?? 0,
        variables: attempt.variables ?? {},
        skillDeltas: {},
        firstCompletion: false,
        mode: attempt.mode,
        newBadges: [],
      };
    }

    const doc = await loadVersionDoc(attempt.version_id);
    const committedRows = await tx<{ block_id: string; response: unknown }[]>`
      SELECT block_id, response FROM learn_responses
      WHERE attempt_id = ${attemptId} AND committed_at IS NOT NULL
      ORDER BY answered_at ASC
    `;
    const committed: CommittedResponse[] = committedRows.map((r) => ({ blockId: r.block_id, response: r.response }));
    const path = committedRows.map((r) => r.block_id);

    // Server-side gating (Stage 8 parity item 5): media completion
    // thresholds and reflection min_words are enforced HERE, not just in the
    // player UI — a client that skipped/bypassed the gate cannot force a
    // completion. Any committed media/long_text response whose own grading
    // outcome is `correct: false` blocks completeAttempt outright. This
    // mirrors the legacy runner's podcast >=80% / reflection >=75-word gates
    // (docs/learn/stage0-audit.md).
    for (const cr of committed) {
      const block = findBlock(doc, cr.blockId);
      if (!block || (block.type !== "media" && block.type !== "long_text")) continue;
      const outcome = gradeBlock(block, cr.response);
      if (outcome.correct === false) {
        const label = block.type === "media" ? "A media block hasn't met its completion requirement yet" : "A reflection response is too short";
        throw new Error(`${label} — this lesson can't be completed yet.`);
      }
    }

    const baseResults = computeResults(doc, committed, path);
    const now = Date.now();

    // Fold in any manual-review points already approved before this attempt
    // finished (an instructor reviewing mid-play, or a retried
    // completeAttempt after a crash) — see lib/learn/review.ts. The common
    // case is zero approved rows here (reviews land after completion), in
    // which case this is a no-op and score/stars equal baseResults exactly.
    const approvedReviewRows = await tx<{ points_awarded: number | null; points_possible: number }[]>`
      SELECT points_awarded, points_possible FROM learn_manual_reviews
      WHERE attempt_id = ${attemptId} AND status = 'approved'
    `;
    const adjusted = applyApprovedReviews(
      baseResults,
      approvedReviewRows.map((r) => ({ pointsAwarded: r.points_awarded ?? 0, pointsPossible: r.points_possible })),
      doc.scoring.starThresholds,
    );
    const results = { ...baseResults, score0to100: adjusted.score0to100, stars: adjusted.stars };

    await tx`
      UPDATE learn_attempts
      SET status = 'completed', completed_at = ${now}, score = ${results.score0to100}, stars = ${results.stars},
          variables = ${tx.json(results.variables as never)}, path = ${tx.json(path as never)},
          duration_ms = ${now - attempt.started_at}
      WHERE id = ${attemptId}
    `;

    // mode='test' — real grading, zero reward/progress side effects.
    if (attempt.mode === "test") {
      await tx`UPDATE learn_attempts SET xp_awarded = 0 WHERE id = ${attemptId}`;
      return {
        ok: true as const,
        score: results.score0to100,
        stars: results.stars,
        xpAwarded: 0,
        variables: results.variables,
        skillDeltas: results.skillPoints,
        firstCompletion: false,
        mode: "test" as const,
        newBadges: [],
      };
    }

    // ---- mastery (lifetime best) + replay-policy XP ----
    const masteryRows = await tx<{ best_score: number | null; attempts: number }[]>`
      SELECT best_score, attempts FROM learn_lesson_mastery WHERE user_id = ${user.id} AND lesson_id = ${attempt.lesson_id} FOR UPDATE
    `;
    const priorMastery = masteryRows[0];
    const firstCompletion = !priorMastery;
    const priorBest = priorMastery?.best_score ?? null;
    const improved = priorBest === null ? true : results.score0to100 > priorBest;

    const { base, perStar, firstCompletionBonus } = doc.scoring.xp;
    const replayPolicy = doc.scoring.replayPolicy;
    let xp = 0;
    if (firstCompletion) {
      xp = Math.round(base + perStar * results.stars + firstCompletionBonus);
    } else if (improved) {
      const scoreDelta = results.score0to100 - (priorBest ?? 0);
      xp = Math.round(base * replayPolicy.improvedXpPct + base * (scoreDelta / 100));
    } else {
      xp = Math.round(replayPolicy.noImprovementXpFloor);
    }

    await tx`
      INSERT INTO learn_lesson_mastery (user_id, lesson_id, best_score, best_stars, attempts, first_completed_at, last_attempt_id, last_version_id)
      VALUES (${user.id}, ${attempt.lesson_id}, ${results.score0to100}, ${results.stars}, 1, ${now}, ${attemptId}, ${attempt.version_id})
      ON CONFLICT (user_id, lesson_id) DO UPDATE SET
        best_score = GREATEST(learn_lesson_mastery.best_score, EXCLUDED.best_score),
        best_stars = GREATEST(learn_lesson_mastery.best_stars, EXCLUDED.best_stars),
        attempts = learn_lesson_mastery.attempts + 1,
        last_attempt_id = EXCLUDED.last_attempt_id,
        last_version_id = EXCLUDED.last_version_id
    `;

    // XP idempotency: unique source_key means a retried completeAttempt can
    // never double-bank XP even if this transaction is replayed after a crash.
    const xpSourceKey = `attempt:${attemptId}:completion`;
    const xpInserted = await tx<{ id: string }[]>`
      INSERT INTO learn_xp_events (id, user_id, source_key, amount, created_at)
      VALUES (${`xpe-${randomUUID().slice(0, 12)}`}, ${user.id}, ${xpSourceKey}, ${xp}, ${now})
      ON CONFLICT (source_key) DO NOTHING
      RETURNING id
    `;
    if (xpInserted.length > 0 && xp !== 0) {
      await tx`UPDATE users SET xp = COALESCE(xp, 0) + ${xp} WHERE id = ${user.id}`;
    }
    await tx`UPDATE learn_attempts SET xp_awarded = ${xp} WHERE id = ${attemptId}`;

    // ---- skill events (idempotent per attempt+skill; replay only credits improvement) ----
    const skillDeltas: Record<string, number> = {};
    for (const [skillId, points] of Object.entries(results.skillPoints)) {
      let award = points;
      if (!firstCompletion) {
        const priorSkillRows = await tx<{ max_points: number | null }[]>`
          SELECT MAX(se.points) AS max_points
          FROM learn_skill_events se
          JOIN learn_attempts a ON a.id = se.attempt_id
          WHERE se.user_id = ${user.id} AND se.skill_id = ${skillId} AND a.lesson_id = ${attempt.lesson_id}
        `;
        const priorMax = priorSkillRows[0]?.max_points ?? 0;
        award = Math.max(0, points - priorMax);
      }
      if (award <= 0) continue;
      const inserted = await tx<{ id: string }[]>`
        INSERT INTO learn_skill_events (id, user_id, skill_id, attempt_id, points, created_at)
        VALUES (${`ske-${randomUUID().slice(0, 12)}`}, ${user.id}, ${skillId}, ${attemptId}, ${award}, ${now})
        ON CONFLICT (attempt_id, skill_id) DO NOTHING
        RETURNING id
      `;
      if (inserted.length > 0) {
        skillDeltas[skillId] = award;
        await tx`
          INSERT INTO learn_student_skills (user_id, skill_id, level, points, events, updated_at)
          VALUES (${user.id}, ${skillId}, 0, ${award}, 1, ${now})
          ON CONFLICT (user_id, skill_id) DO UPDATE SET
            points = learn_student_skills.points + ${award},
            events = learn_student_skills.events + 1,
            level = (learn_student_skills.points + ${award}) / 100,
            updated_at = ${now}
        `;
      }
    }

    // ---- enrollment-aware assignment progress (Stage 8 parity item 2) ----
    // Upserts learn_assignment_progress for the cohort stamped on this
    // attempt at startAttempt time, so instructor rosters and cohort pacing
    // read completion scoped to that cohort rather than only lifetime
    // mastery. A student with no active cohort (self-paced/no enrollment)
    // has no context to stamp — nothing to upsert, mastery already covers
    // the lifetime record.
    const cohortId = attempt.enrollment_context?.cohortId;
    if (cohortId) {
      await tx`
        INSERT INTO learn_assignment_progress (user_id, context_type, context_id, lesson_id, status, completed_attempt_id, completed_at)
        VALUES (${user.id}, 'cohort', ${cohortId}, ${attempt.lesson_id}, 'completed', ${attemptId}, ${now})
        ON CONFLICT (user_id, context_type, context_id, lesson_id) DO UPDATE SET
          status = 'completed',
          completed_attempt_id = EXCLUDED.completed_attempt_id,
          completed_at = EXCLUDED.completed_at
      `;
    }

    // ---- rule-based achievement badges (Stage 9) ----
    // Declarative badges (badges.rule jsonb, evaluated by
    // lib/learn/achievements.ts) are checked inside this same transaction so
    // award + XP are as atomic/idempotent as the rest of completion: sticky
    // INSERT ... ON CONFLICT DO NOTHING into student_badges, and XP via
    // learn_xp_events with a unique source_key of `badge:<badgeId>:<userId>`
    // (distinct from the attempt-completion XP's `attempt:<id>:completion`
    // key, and from checkAndAwardBadges' legacy Daily-Question badges, which
    // have no rule and are skipped by the WHERE clause below).
    const newBadges: { id: string; name: string; icon: string }[] = [];
    const ruleBadgeRows = await tx<{ id: string; name: string; icon: string; rule: unknown; xp_reward: number }[]>`
      SELECT id, name, icon, rule, xp_reward FROM badges WHERE rule IS NOT NULL AND active = 1
    `;
    if (ruleBadgeRows.length > 0) {
      const masteryAllRows = await tx<{ lesson_id: string; best_stars: number }[]>`
        SELECT lesson_id, best_stars FROM learn_lesson_mastery WHERE user_id = ${user.id}
      `;
      const completedLessonIds = new Set(masteryAllRows.map((r) => r.lesson_id));
      const totalStarsEarned = masteryAllRows.reduce((sum, r) => sum + (Number(r.best_stars) || 0), 0);
      const totalLessonsCompleted = masteryAllRows.length;

      const trackModuleRows = await tx<{ lesson_id: string; module_id: string; track_id: string }[]>`
        SELECT l.id AS lesson_id, l.module_id, m.track_id
        FROM learn_lessons l JOIN learn_modules m ON m.id = l.module_id
      `;
      const trackLessonIds: Record<string, string[]> = {};
      const moduleLessonIds: Record<string, string[]> = {};
      for (const r of trackModuleRows) {
        (trackLessonIds[r.track_id] ??= []).push(r.lesson_id);
        (moduleLessonIds[r.module_id] ??= []).push(r.lesson_id);
      }

      const ctx: AchievementContext = {
        lessonId: attempt.lesson_id,
        score: results.score0to100,
        stars: results.stars,
        variables: results.variables,
        completedLessonIds,
        totalStarsEarned,
        totalLessonsCompleted,
        trackLessonIds,
        moduleLessonIds,
      };

      const candidates: RuleBadgeCandidate[] = ruleBadgeRows.map((r) => ({ id: r.id, rule: r.rule }));
      const satisfiedIds = evaluateBadgeRules(candidates, ctx);

      for (const badgeId of satisfiedIds) {
        const badgeRow = ruleBadgeRows.find((r) => r.id === badgeId);
        if (!badgeRow) continue;
        const awarded = await tx<{ badge_id: string }[]>`
          INSERT INTO student_badges (student_id, badge_id, earned_at)
          VALUES (${user.id}, ${badgeId}, ${now})
          ON CONFLICT (student_id, badge_id) DO NOTHING
          RETURNING badge_id
        `;
        if (awarded.length === 0) continue; // already earned — not newly awarded, no XP re-bank.
        newBadges.push({ id: badgeRow.id, name: badgeRow.name, icon: badgeRow.icon });

        const xpAmount = Number(badgeRow.xp_reward) || 0;
        if (xpAmount > 0) {
          const badgeXpKey = `badge:${badgeId}:${user.id}`;
          const badgeXpInserted = await tx<{ id: string }[]>`
            INSERT INTO learn_xp_events (id, user_id, source_key, amount, created_at)
            VALUES (${`xpe-${randomUUID().slice(0, 12)}`}, ${user.id}, ${badgeXpKey}, ${xpAmount}, ${now})
            ON CONFLICT (source_key) DO NOTHING
            RETURNING id
          `;
          if (badgeXpInserted.length > 0) {
            await tx`UPDATE users SET xp = COALESCE(xp, 0) + ${xpAmount} WHERE id = ${user.id}`;
          }
        }
      }
    }

    return {
      ok: true as const,
      score: results.score0to100,
      stars: results.stars,
      xpAwarded: xp,
      variables: results.variables,
      skillDeltas,
      firstCompletion,
      mode: "play" as const,
      newBadges,
    };
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to complete attempt" };
  }

  // Best-effort side effects on lib/db.ts's separate connection pool — kept
  // outside the sqlLearn transaction (different client), never gate the
  // core completion result on these succeeding. Skipped entirely for
  // mode='test' per plan: author test runs get zero reward/progress side effects.
  if (result.mode === "play") {
    try {
      await recordDailyVisit(user.id);
      // checkAndAwardBadges is itself idempotent (INSERT OR IGNORE on
      // student_badges) — existing badge UI (BadgeToast) surfaces new
      // awards elsewhere; no new NotificationType is introduced here.
      await checkAndAwardBadges(user.id);
    } catch {
      // Non-fatal — the attempt is already durably completed.
    }
  }

  revalidatePath("/dashboard");
  return result;
}
