"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import { getSelfModuleViews } from "@/lib/self-paced";
import { getActiveSimulation, rowToSimState } from "@/lib/sim-store";
import {
  getTurn,
  getChoice,
  gradeSimulation,
  START_CAP,
  GAMES_PER_TURN,
  TOTAL_TURNS,
  type SimDecision,
  type SimReport,
  type SimActionResult,
} from "@/lib/sim-game";

/** True once the student has completed Module 2 (the Simulation Room gate). */
function module2Complete(studentId: string): boolean {
  return getSelfModuleViews(studentId).find((v) => v.module.ordinal === 2)?.completed ?? false;
}

function touchActive(uid: string) {
  getDb().prepare("UPDATE users SET last_active_at = ? WHERE id = ?").run(Date.now(), uid);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function loadActiveRow(studentId: string): any {
  return getDb().prepare("SELECT * FROM simulations WHERE student_id = ? AND completed = 0 ORDER BY created_at DESC LIMIT 1").get(studentId);
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Start a new Simulation Room run (or return the existing active one). Gated on
 * Module 2 completion. Only one active simulation per student at a time.
 */
export async function startSimulation(): Promise<SimActionResult> {
  const me = await requireRole("student");
  if (!module2Complete(me.id)) return { ok: false, error: "locked" };

  const existing = getActiveSimulation(me.id);
  if (existing) return { ok: true, state: existing };

  const id = `sim-${randomUUID().slice(0, 12)}`;
  getDb()
    .prepare(
      "INSERT INTO simulations (id, student_id, turn, cap_space, team_record, decisions, completed, final_score, created_at) VALUES (?, ?, 1, ?, '0-0', '[]', 0, NULL, ?)",
    )
    .run(id, me.id, START_CAP, Date.now());
  touchActive(me.id);
  revalidatePath("/simulation-room");

  return { ok: true, state: getActiveSimulation(me.id) ?? undefined };
}

/**
 * Apply one decision to the active simulation: update cap and record, append the
 * resolved decision, and advance the turn. On the final turn, grade and store
 * the result. Validated server-side so turns and choices can't be forged.
 */
export async function makeSimDecision(choiceId: string): Promise<SimActionResult> {
  const me = await requireRole("student");
  const row = loadActiveRow(me.id);
  if (!row) return { ok: false, error: "no-sim" };

  const turn = Number(row.turn) || 1;
  if (turn > TOTAL_TURNS) return { ok: false, error: "done" };

  const turnContent = getTurn(turn);
  const choice = getChoice(turn, String(choiceId));
  if (!turnContent || !choice) return { ok: false, error: "bad-choice" };

  let decisions: SimDecision[] = [];
  try {
    decisions = JSON.parse(row.decisions ?? "[]");
  } catch {
    decisions = [];
  }
  // Guard against a double-submit for the same turn.
  if (decisions.some((d) => d.turn === turn)) return { ok: false, error: "done" };

  const capAfter = Number(row.cap_space) + choice.capImpact;
  const priorWins = decisions.reduce((s, d) => s + d.winsImpact, 0);
  const priorLosses = decisions.length * GAMES_PER_TURN - priorWins;
  const winsAfter = priorWins + choice.winsImpact;
  const lossesAfter = priorLosses + (GAMES_PER_TURN - choice.winsImpact);

  const decision: SimDecision = {
    turn,
    choiceId: choice.id,
    label: choice.label,
    concept: turnContent.concept,
    conceptLabel: turnContent.conceptLabel,
    capImpact: choice.capImpact,
    winsImpact: choice.winsImpact,
    outcome: choice.outcome,
    sound: choice.sound,
    capAfter,
    winsAfter,
    lossesAfter,
  };
  decisions.push(decision);

  const db = getDb();
  const isLast = turn >= TOTAL_TURNS;
  let report: SimReport | undefined;

  if (isLast) {
    report = gradeSimulation(decisions);
    db.prepare(
      "UPDATE simulations SET turn = ?, cap_space = ?, team_record = ?, decisions = ?, completed = 1, final_score = ? WHERE id = ?",
    ).run(TOTAL_TURNS, capAfter, `${winsAfter}-${lossesAfter}`, JSON.stringify(decisions), report.gmScore, row.id);
  } else {
    db.prepare(
      "UPDATE simulations SET turn = ?, cap_space = ?, team_record = ?, decisions = ? WHERE id = ?",
    ).run(turn + 1, capAfter, `${winsAfter}-${lossesAfter}`, JSON.stringify(decisions), row.id);
  }

  touchActive(me.id);
  revalidatePath("/simulation-room");
  revalidatePath("/profile");

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const updated = db.prepare("SELECT * FROM simulations WHERE id = ?").get(row.id) as any;
  return { ok: true, state: rowToSimState(updated), justResolved: decision, report };
}
