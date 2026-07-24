"use server";

/* ============================================================
 * Instructor Current Mission — server actions.
 *
 * Staff (admin | growth) assign, complete, cancel, and give feedback on
 * missions. Instructors post progress and evidence on their OWN mission only —
 * ownership is re-resolved server-side from the session, never trusted from
 * the client, so this is the security boundary for mission self-service.
 * ============================================================ */

import { revalidatePath } from "next/cache";
import { requireStaff, requireInstructorSelf } from "@/lib/dal";
import { getDb } from "@/lib/db";
import {
  assignMissionCore,
  addMissionUpdateCore,
  completeMissionCore,
  cancelMissionCore,
  type AssignMissionInput,
} from "@/lib/instructor-missions";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

function revalidateMissionSurfaces(): void {
  revalidatePath("/app");
  revalidatePath("/app/teach");
  revalidatePath("/app/people");
  revalidatePath("/app/people/instructors");
}

export async function assignInstructorMission(input: AssignMissionInput): Promise<ActionResult> {
  const me = await requireStaff();
  const result = await assignMissionCore(me.id, input);
  if (result.ok) revalidateMissionSurfaces();
  return { ok: result.ok, error: result.error };
}

export async function completeInstructorMission(
  missionId: string,
  completionOutcome: string,
  note: string,
): Promise<ActionResult> {
  const me = await requireStaff();
  const result = await completeMissionCore(me.id, missionId, completionOutcome, note);
  if (result.ok) revalidateMissionSurfaces();
  return { ok: result.ok, error: result.error };
}

export async function cancelInstructorMission(missionId: string, note: string): Promise<ActionResult> {
  const me = await requireStaff();
  const result = await cancelMissionCore(me.id, missionId, note);
  if (result.ok) revalidateMissionSurfaces();
  return { ok: result.ok, error: result.error };
}

export async function addMissionFeedback(missionId: string, body: string): Promise<ActionResult> {
  const me = await requireStaff();
  const result = await addMissionUpdateCore(me.id, missionId, "staff", "feedback", body);
  if (result.ok) revalidateMissionSurfaces();
  return { ok: result.ok, error: result.error };
}

/**
 * Instructor self-service: post progress or evidence on YOUR OWN active
 * mission. The mission must belong to the signed-in instructor's own record —
 * verified here, not taken on trust from the client.
 */
export async function submitMissionUpdate(
  missionId: string,
  kind: "progress" | "evidence",
  body: string,
): Promise<ActionResult> {
  const { user, instructor } = await requireInstructorSelf();
  if (kind !== "progress" && kind !== "evidence") return { ok: false, error: "Unsupported update." };

  const owning = (await getDb()
    .prepare("SELECT 1 FROM instructor_missions WHERE id = ? AND instructor_id = ? AND status = 'active'")
    .get(missionId, instructor.id)) as { 1: number } | undefined;
  if (!owning) return { ok: false, error: "This is not your active mission." };

  const result = await addMissionUpdateCore(user.id, missionId, "instructor", kind, body);
  if (result.ok) revalidatePath("/app/teach");
  return { ok: result.ok, error: result.error };
}
