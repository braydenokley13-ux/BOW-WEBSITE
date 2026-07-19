"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { requireStaff } from "@/lib/dal";
import { logActivity } from "@/lib/hiring";
import { isValidTimeZone } from "@/lib/timezone";

const REGION_STAGES = ["active", "paused", "closed"] as const;
export type RegionStage = (typeof REGION_STAGES)[number];

export interface RegionRecord {
  id: string;
  name: string;
  code: string;
  leaderUserId: string | null;
  timezone: string;
  stage: RegionStage;
  notes: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface RegionFormOptions {
  staff: { id: string; name: string; role: "admin" | "growth" }[];
}

export interface RegionInput {
  name: string;
  code: string;
  leaderUserId?: string | null;
  timezone: string;
  stage: RegionStage;
  notes?: string | null;
  transitionReason?: string | null;
}

export interface RegionActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

interface RegionRow {
  id: string;
  name: string;
  code: string;
  leader_user_id: string | null;
  timezone: string | null;
  stage: string;
  notes: string | null;
  created_at: number;
  updated_at: number;
}

interface ValidatedRegionInput {
  name: string;
  code: string;
  leaderUserId: string | null;
  timezone: string;
  stage: RegionStage;
  notes: string | null;
  transitionReason: string | null;
}

type ValidationResult =
  | { ok: true; value: ValidatedRegionInput }
  | { ok: false; error: string };

const ALLOWED_TRANSITIONS: Record<RegionStage, RegionStage[]> = {
  active: ["paused", "closed"],
  paused: ["active", "closed"],
  closed: [],
};

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizedNameKey(value: string): string {
  return normalizeName(value).toLocaleLowerCase("en-US");
}

function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}

function identifier(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(id) ? id : null;
}

function optionalText(value: unknown, maxLength: number, label: string): { value: string | null; error?: string } {
  if (value != null && typeof value !== "string") return { value: null, error: `${label} is invalid.` };
  const text = (value ?? "").trim();
  if (text.length > maxLength) {
    return { value: null, error: `${label} must be ${maxLength.toLocaleString()} characters or fewer.` };
  }
  return { value: text || null };
}

function validateInput(input: RegionInput): ValidationResult {
  if (!input || typeof input !== "object") return { ok: false, error: "Region details are required." };

  if (typeof input.name !== "string") return { ok: false, error: "Region name is required." };
  const name = normalizeName(input.name);
  if (name.length < 2 || name.length > 120) {
    return { ok: false, error: "Region name must be between 2 and 120 characters." };
  }
  if (!/^[\p{L}\p{N}][\p{L}\p{N} .,'’&()\-/]*$/u.test(name)) {
    return { ok: false, error: "Region name contains unsupported characters." };
  }

  if (typeof input.code !== "string") return { ok: false, error: "Region code is required." };
  const code = normalizeCode(input.code);
  if (!/^[A-Z][A-Z0-9_-]{1,19}$/.test(code)) {
    return { ok: false, error: "Region code must be 2–20 characters, begin with a letter, and use only letters, numbers, hyphens, or underscores." };
  }

  if (typeof input.timezone !== "string") return { ok: false, error: "Region timezone is required." };
  const timezone = input.timezone.trim();
  if (!isValidTimeZone(timezone)) {
    return { ok: false, error: "Choose a valid IANA timezone, such as America/New_York." };
  }

  if (typeof input.stage !== "string" || !REGION_STAGES.includes(input.stage as RegionStage)) {
    return { ok: false, error: "Choose a valid Region stage." };
  }

  const leaderUserId = input.leaderUserId == null || input.leaderUserId === ""
    ? null
    : identifier(input.leaderUserId);
  if (input.leaderUserId && !leaderUserId) return { ok: false, error: "Choose a valid regional leader." };

  const notes = optionalText(input.notes, 5000, "Operating notes");
  const transitionReason = optionalText(input.transitionReason, 1000, "Transition reason");
  if (notes.error) return { ok: false, error: notes.error };
  if (transitionReason.error) return { ok: false, error: transitionReason.error };

  return {
    ok: true,
    value: {
      name,
      code,
      leaderUserId,
      timezone,
      stage: input.stage as RegionStage,
      notes: notes.value,
      transitionReason: transitionReason.value,
    },
  };
}

function beginTransaction<T>(work: () => T): T {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // Preserve the original write failure.
    }
    throw error;
  }
}

function assertUniqueIdentity(regionId: string, name: string, code: string): void {
  const rows = getDb().prepare("SELECT id, name, code FROM operating_regions WHERE id <> ?").all(regionId) as {
    id: string;
    name: string;
    code: string;
  }[];
  const nameKey = normalizedNameKey(name);
  const codeKey = normalizeCode(code);
  if (rows.some((row) => normalizedNameKey(row.name) === nameKey)) throw new Error("duplicate_name");
  if (rows.some((row) => normalizeCode(row.code) === codeKey)) throw new Error("duplicate_code");
}

function assertEligibleLeader(leaderUserId: string | null, stage: RegionStage): void {
  if (!leaderUserId) {
    if (stage === "active") throw new Error("leader_required");
    return;
  }
  const leader = getDb().prepare("SELECT role, status FROM users WHERE id = ?").get(leaderUserId) as
    | { role: string; status: string }
    | undefined;
  if (!leader || leader.status !== "active" || !["admin", "growth"].includes(leader.role)) {
    throw new Error("leader_ineligible");
  }
}

function firstCloseBlocker(regionId: string): string | null {
  const location = getDb().prepare(
    `SELECT name, stage
       FROM locations
      WHERE region_id = ? AND stage <> 'closed'
      ORDER BY CASE stage
        WHEN 'active' THEN 0
        WHEN 'launching' THEN 1
        WHEN 'evaluating' THEN 2
        WHEN 'prospect' THEN 3
        WHEN 'paused' THEN 4
        ELSE 5 END,
        name
      LIMIT 1`,
  ).get(regionId) as { name: string; stage: string } | undefined;
  if (!location) return null;
  return `Resolve or close Location ${location.name} (${location.stage.replace(/_/g, " ")}) before closing this Region.`;
}

function actionError(error: unknown): RegionActionResult {
  const code = error instanceof Error ? error.message : "";
  const errors: Record<string, string> = {
    duplicate_name: "A Region with this normalized name already exists.",
    duplicate_code: "A Region with this code already exists.",
    leader_required: "An active Region requires an accountable active BOW staff leader.",
    leader_ineligible: "The regional leader must be an active admin or growth team member.",
    region_missing: "This Region no longer exists.",
    region_changed: "This Region changed while you were editing it. Refresh and review the latest record before saving.",
    region_closed: "Closed Regions are historical records and cannot be edited or reopened.",
    transition_not_allowed: "That lifecycle move is not allowed from the Region's current stage.",
    transition_reason_required: "Explain the lifecycle change in at least 8 characters so the next operator understands the decision.",
  };
  if (errors[code]) return { ok: false, error: errors[code] };
  if (code.startsWith("close_blocked:")) return { ok: false, error: code.slice("close_blocked:".length) };
  return { ok: false, error: "The Region could not be saved. No operating records were changed." };
}

function revalidateRegion(regionId?: string): void {
  revalidatePath("/app/regions");
  revalidatePath("/app/regions/new");
  revalidatePath("/app/locations");
  revalidatePath("/app/locations/new");
  revalidatePath("/app");
  if (regionId) revalidatePath(`/app/regions/${regionId}`);
}

export async function getRegionFormOptions(): Promise<RegionFormOptions> {
  await requireStaff();
  return {
    staff: getDb().prepare(
      "SELECT id, name, role FROM users WHERE status = 'active' AND role IN ('admin', 'growth') ORDER BY name, id",
    ).all() as RegionFormOptions["staff"],
  };
}

export async function createRegion(input: RegionInput): Promise<RegionActionResult> {
  const me = await requireStaff();
  const validated = validateInput(input);
  if (!validated.ok) return { ok: false, error: validated.error };
  const value = validated.value;
  if (value.stage !== "active") return { ok: false, error: "A new Region begins active with an accountable leader." };

  const id = `reg-${randomUUID()}`;
  const now = Date.now();
  try {
    beginTransaction(() => {
      assertUniqueIdentity(id, value.name, value.code);
      assertEligibleLeader(value.leaderUserId, value.stage);
      getDb().prepare(
        `INSERT INTO operating_regions
          (id, name, code, leader_user_id, timezone, stage, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
      ).run(id, value.name, value.code, value.leaderUserId, value.timezone, value.notes, now, now);
      logActivity("operating_region", id, "created", `Operating Region ${value.name} (${value.code}) created as active.`, me.id);
    });
  } catch (error) {
    return actionError(error);
  }

  revalidateRegion(id);
  return { ok: true, id };
}

export async function updateRegion(
  id: string,
  expectedUpdatedAt: number,
  expectedStage: RegionStage,
  input: RegionInput,
): Promise<RegionActionResult> {
  const me = await requireStaff();
  const regionId = identifier(id);
  if (!regionId) return { ok: false, error: "Region not found." };
  if (!Number.isSafeInteger(expectedUpdatedAt) || expectedUpdatedAt < 1 || !REGION_STAGES.includes(expectedStage)) {
    return { ok: false, error: "Refresh this Region before saving changes." };
  }
  const validated = validateInput(input);
  if (!validated.ok) return { ok: false, error: validated.error };
  const value = validated.value;

  try {
    beginTransaction(() => {
      const db = getDb();
      const current = db.prepare("SELECT * FROM operating_regions WHERE id = ?").get(regionId) as RegionRow | undefined;
      if (!current) throw new Error("region_missing");
      if (current.stage === "closed") throw new Error("region_closed");
      if (current.updated_at !== expectedUpdatedAt || current.stage !== expectedStage) throw new Error("region_changed");
      if (!REGION_STAGES.includes(current.stage as RegionStage)) throw new Error("region_changed");

      const currentStage = current.stage as RegionStage;
      if (value.stage !== currentStage) {
        if (!ALLOWED_TRANSITIONS[currentStage].includes(value.stage)) throw new Error("transition_not_allowed");
        if (!value.transitionReason || value.transitionReason.length < 8) throw new Error("transition_reason_required");
        if (value.stage === "closed") {
          const blocker = firstCloseBlocker(regionId);
          if (blocker) throw new Error(`close_blocked:${blocker}`);
        }
      }

      assertUniqueIdentity(regionId, value.name, value.code);
      assertEligibleLeader(value.leaderUserId, value.stage);

      const nextUpdatedAt = Math.max(Date.now(), current.updated_at + 1);
      const updated = db.prepare(
        `UPDATE operating_regions
            SET name = ?, code = ?, leader_user_id = ?, timezone = ?, stage = ?, notes = ?, updated_at = ?
          WHERE id = ? AND updated_at = ? AND stage = ?`,
      ).run(
        value.name,
        value.code,
        value.leaderUserId,
        value.timezone,
        value.stage,
        value.notes,
        nextUpdatedAt,
        regionId,
        current.updated_at,
        current.stage,
      );
      if (updated.changes !== 1) throw new Error("region_changed");

      if (current.name !== value.name) {
        db.prepare("UPDATE locations SET region = ?, updated_at = ? WHERE region_id = ?").run(value.name, nextUpdatedAt, regionId);
      }

      if (value.stage !== currentStage) {
        logActivity(
          "operating_region",
          regionId,
          "stage_change",
          `Region moved from ${currentStage} to ${value.stage}. ${value.transitionReason}`,
          me.id,
        );
      }

      const changed: string[] = [];
      if (current.name !== value.name) changed.push("name");
      if (current.code !== value.code) changed.push("code");
      if (current.leader_user_id !== value.leaderUserId) changed.push("regional leader");
      if ((current.timezone ?? "") !== value.timezone) changed.push("timezone");
      if ((current.notes ?? "") !== (value.notes ?? "")) changed.push("operating notes");
      if (changed.length > 0) {
        logActivity("operating_region", regionId, "plan_updated", `Region plan updated. Changed: ${changed.join(", ")}.`, me.id);
      }
    });
  } catch (error) {
    return actionError(error);
  }

  revalidateRegion(regionId);
  return { ok: true, id: regionId };
}
