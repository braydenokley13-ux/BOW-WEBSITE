"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import { getSelfModuleViews } from "@/lib/self-paced";
import { getActiveSimulation, rowToSimState } from "@/lib/sim-store";
import { GAMES_PER_TURN, type SimDecision, type SimState } from "@/lib/sim-game";
import {
  getEastfieldTurn,
  getEastfieldChoice,
  gradeEastfield,
  START_CAP_EASTFIELD,
  TOTAL_TURNS_EASTFIELD,
  TRACK_201_SIM_TYPE,
  type EastfieldReport,
} from "@/lib/sim-eastfield";

/** Result shape returned by the Eastfield ("Front Office") simulation actions. */
export interface EastfieldActionResult {
  ok: boolean;
  error?: "locked" | "no-sim" | "bad-choice" | "done";
  state?: SimState;
  justResolved?: SimDecision;
  report?: EastfieldReport;
}

/** True once the student has completed Module 201-2 (the Front Office sim gate). */
function module201_2Complete(studentId: string): boolean {
  return getSelfModuleViews(studentId, "201").find((v) => v.module.ordinal === 2)?.completed ?? false;
}

function touchActive(uid: string) {
  getDb().prepare("UPDATE users SET last_active_at = ? WHERE id = ?").run(Date.now(), uid);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function loadActiveRow(studentId: string): any {
  return getDb()
    .prepare(
      "SELECT * FROM simulations WHERE student_id = ? AND completed = 0 AND sim_type = 'eastfield' ORDER BY created_at DESC LIMIT 1",
    )
    .get(studentId);
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Start a new Eastfield Eagles run (or return the existing active one). Gated on
 * Module 201-2 completion. Only one active Eastfield sim per student at a time.
 */
export async function startEastfield(): Promise<EastfieldActionResult> {
  const me = await requireRole("student");
  if (!module201_2Complete(me.id)) return { ok: false, error: "locked" };

  const existing = getActiveSimulation(me.id, TRACK_201_SIM_TYPE);
  if (existing) return { ok: true, state: existing };

  const id = `sim-${randomUUID().slice(0, 12)}`;
  getDb()
    .prepare(
      "INSERT INTO simulations (id, student_id, turn, cap_space, team_record, decisions, completed, final_score, created_at, sim_type) VALUES (?, ?, 1, ?, '0-0', '[]', 0, NULL, ?, 'eastfield')",
    )
    .run(id, me.id, START_CAP_EASTFIELD, Date.now());
  touchActive(me.id);
  revalidatePath("/front-office");

  return { ok: true, state: getActiveSimulation(me.id, TRACK_201_SIM_TYPE) ?? undefined };
}

/**
 * Apply one decision to the active Eastfield sim: update cap and record, append
 * the resolved decision, and advance the turn. On the final (8th) turn, grade
 * and store the result. Validated server-side so turns and choices can't be
 * forged. Completing the run is worth +200 BOW Score (handled by scoring).
 */
export async function makeEastfieldDecision(choiceId: string): Promise<EastfieldActionResult> {
  const me = await requireRole("student");
  const row = loadActiveRow(me.id);
  if (!row) return { ok: false, error: "no-sim" };

  const turn = Number(row.turn) || 1;
  if (turn > TOTAL_TURNS_EASTFIELD) return { ok: false, error: "done" };

  const turnContent = getEastfieldTurn(turn);
  const choice = getEastfieldChoice(turn, String(choiceId));
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
  const isLast = turn >= TOTAL_TURNS_EASTFIELD;
  let report: EastfieldReport | undefined;

  if (isLast) {
    report = gradeEastfield(decisions);
    db.prepare(
      "UPDATE simulations SET turn = ?, cap_space = ?, team_record = ?, decisions = ?, completed = 1, final_score = ? WHERE id = ?",
    ).run(TOTAL_TURNS_EASTFIELD, capAfter, `${winsAfter}-${lossesAfter}`, JSON.stringify(decisions), report.capEfficiency, row.id);
  } else {
    db.prepare(
      "UPDATE simulations SET turn = ?, cap_space = ?, team_record = ?, decisions = ? WHERE id = ?",
    ).run(turn + 1, capAfter, `${winsAfter}-${lossesAfter}`, JSON.stringify(decisions), row.id);
  }

  touchActive(me.id);
  revalidatePath("/front-office");
  revalidatePath("/profile");

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const updated = db.prepare("SELECT * FROM simulations WHERE id = ?").get(row.id) as any;
  return { ok: true, state: rowToSimState(updated), justResolved: decision, report };
}
