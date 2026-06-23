/* ============================================================
 * Simulation Room — server-only store (Feature 7).
 *
 * Reads the `simulations` table and maps it to a serializable state
 * shape for the page + client. Pure content and grading live in
 * lib/sim-game.ts; this module is the only place that touches the DB
 * for simulations.
 *
 * Server-only. Do not import from a client component.
 * ============================================================ */

import { getDb } from "@/lib/db";
import { GAMES_PER_TURN, type SimDecision, type SimState } from "@/lib/sim-game";

/* eslint-disable @typescript-eslint/no-explicit-any */
export function rowToSimState(r: any): SimState {
  let decisions: SimDecision[] = [];
  try {
    decisions = JSON.parse(r.decisions ?? "[]");
  } catch {
    decisions = [];
  }
  const wins = decisions.reduce((s, d) => s + d.winsImpact, 0);
  const losses = decisions.length * GAMES_PER_TURN - wins;
  return {
    id: r.id,
    turn: Number(r.turn) || 1,
    capSpace: Number(r.cap_space),
    wins,
    losses,
    record: r.team_record ?? `${wins}-${losses}`,
    completed: !!r.completed,
    finalScore: r.final_score != null ? Number(r.final_score) : null,
    decisions,
  };
}

/** The student's active simulation, or the latest completed one if none is active. */
export function getCurrentSimulation(studentId: string): SimState | null {
  const row = getDb()
    .prepare("SELECT * FROM simulations WHERE student_id = ? ORDER BY completed ASC, created_at DESC LIMIT 1")
    .get(studentId) as any;
  return row ? rowToSimState(row) : null;
}

/** The active (in-progress) simulation only, or null. */
export function getActiveSimulation(studentId: string): SimState | null {
  const row = getDb()
    .prepare("SELECT * FROM simulations WHERE student_id = ? AND completed = 0 ORDER BY created_at DESC LIMIT 1")
    .get(studentId) as any;
  return row ? rowToSimState(row) : null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
