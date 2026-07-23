"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { allowedLocationTransitions, LOCATION_TYPES, type LocationType } from "@/components/app/locations/location-form-model";
import { getDb } from "@/lib/db";
import { requireStaff } from "@/lib/dal";
import { logActivity } from "@/lib/hiring";
import { LOCATION_STAGES, type LocationStage } from "@/lib/operations-shared";
import { revalidateEntity } from "@/lib/routes";
import { isValidTimeZone } from "@/lib/timezone";

export interface LocationActionResult {
  ok: boolean;
  error?: string;
}

export interface LocationInput {
  name: string;
  type: LocationType;
  regionId: string;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  timezone: string;
  parentLocationId?: string | null;
  primaryLeaderUserId?: string | null;
  stage: LocationStage;
  capacity?: number | null;
  expectedDemand?: number | null;
  rationale?: string | null;
  earliestLaunchDate?: string | null;
  notes?: string | null;
  transitionReason?: string | null;
}

export interface LocationFormOptions {
  regions: { id: string; name: string; code: string; timezone: string | null; stage: string }[];
  locations: { id: string; name: string; stage: LocationStage; regionId: string | null }[];
  staff: { id: string; name: string }[];
}

interface LocationRow {
  id: string;
  name: string;
  type: string;
  region: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  timezone: string | null;
  parent_location_id: string | null;
  region_id: string | null;
  primary_leader_user_id: string | null;
  stage: LocationStage;
  capacity: number | null;
  expected_demand: number | null;
  rationale: string | null;
  earliest_launch_date: string | null;
  notes: string | null;
  updated_at: number;
}

interface ValidatedLocationInput {
  name: string;
  type: LocationType;
  regionId: string;
  city: string | null;
  state: string | null;
  address: string | null;
  timezone: string;
  parentLocationId: string | null;
  primaryLeaderUserId: string | null;
  stage: LocationStage;
  capacity: number | null;
  expectedDemand: number | null;
  rationale: string | null;
  earliestLaunchDate: string | null;
  notes: string | null;
  transitionReason: string | null;
}

type ValidationResult =
  | { ok: true; value: ValidatedLocationInput }
  | { ok: false; error: string };

function optionalText(value: unknown, maxLength: number, label: string): { value: string | null; error?: string } {
  if (value != null && typeof value !== "string") return { value: null, error: `${label} is invalid.` };
  const text = (value ?? "").trim();
  if (text.length > maxLength) return { value: null, error: `${label} must be ${maxLength.toLocaleString()} characters or fewer.` };
  return { value: text || null };
}

function identifier(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(id) ? id : null;
}

function validCalendarDate(value: string | null): boolean {
  if (!value) return true;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}

function optionalWholeNumber(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
): { value: number | null; error?: string } {
  if (value == null || value === "") return { value: null };
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > maximum) {
    return { value: null, error: `${label} must be a whole number between ${minimum.toLocaleString()} and ${maximum.toLocaleString()}.` };
  }
  return { value };
}

function validateInput(input: LocationInput): ValidationResult {
  if (!input || typeof input !== "object") return { ok: false, error: "Location details are required." };

  const name = optionalText(input.name, 160, "Location name");
  const city = optionalText(input.city, 100, "City");
  const state = optionalText(input.state, 100, "State or province");
  const address = optionalText(input.address, 300, "Address");
  const timezone = optionalText(input.timezone, 100, "Timezone");
  const rationale = optionalText(input.rationale, 5000, "Expansion rationale");
  const launchDate = optionalText(input.earliestLaunchDate, 10, "Earliest launch date");
  const notes = optionalText(input.notes, 5000, "Operating notes");
  const transitionReason = optionalText(input.transitionReason, 1000, "Transition reason");
  const textError = [name, city, state, address, timezone, rationale, launchDate, notes, transitionReason]
    .find((result) => result.error)?.error;
  if (textError) return { ok: false, error: textError };
  if (!name.value) return { ok: false, error: "Location name is required." };

  if (typeof input.type !== "string" || !LOCATION_TYPES.includes(input.type as LocationType)) {
    return { ok: false, error: "Choose a valid Location type." };
  }
  if (typeof input.stage !== "string" || !LOCATION_STAGES.includes(input.stage as LocationStage)) {
    return { ok: false, error: "Choose a valid Location stage." };
  }

  const regionId = identifier(input.regionId);
  if (!regionId) return { ok: false, error: "Choose an operating Region." };
  const parentLocationId = input.parentLocationId == null || input.parentLocationId === ""
    ? null
    : identifier(input.parentLocationId);
  if (input.parentLocationId && !parentLocationId) return { ok: false, error: "Choose a valid parent Location." };
  const primaryLeaderUserId = input.primaryLeaderUserId == null || input.primaryLeaderUserId === ""
    ? null
    : identifier(input.primaryLeaderUserId);
  if (input.primaryLeaderUserId && !primaryLeaderUserId) return { ok: false, error: "Choose a valid market leader." };

  if (!timezone.value || !isValidTimeZone(timezone.value)) {
    return { ok: false, error: "Choose a valid IANA timezone, such as America/New_York." };
  }
  if (!validCalendarDate(launchDate.value)) {
    return { ok: false, error: "Choose a real earliest launch date in YYYY-MM-DD format." };
  }

  const capacity = optionalWholeNumber(input.capacity, "Planning capacity", 1, 100000);
  if (capacity.error) return { ok: false, error: capacity.error };
  const expectedDemand = optionalWholeNumber(input.expectedDemand, "Expected learner demand", 0, 1000000);
  if (expectedDemand.error) return { ok: false, error: expectedDemand.error };

  return {
    ok: true,
    value: {
      name: name.value,
      type: input.type as LocationType,
      regionId,
      city: city.value,
      state: state.value,
      address: address.value,
      timezone: timezone.value,
      parentLocationId,
      primaryLeaderUserId,
      stage: input.stage as LocationStage,
      capacity: capacity.value,
      expectedDemand: expectedDemand.value,
      rationale: rationale.value,
      earliestLaunchDate: launchDate.value,
      notes: notes.value,
      transitionReason: transitionReason.value,
    },
  };
}

async function beginTransaction<T>(work: () => T | Promise<T>): Promise<T> {
  const db = getDb();
  (await db.exec("BEGIN IMMEDIATE"));
  try {
    // Await the work before COMMIT: an unawaited promise commits after only
    // its first query and runs later writes outside the transaction.
    const result = (await work());
    (await db.exec("COMMIT"));
    return result;
  } catch (error) {
    try {
      (await db.exec("ROLLBACK"));
    } catch {
      // Preserve the original failure.
    }
    throw error;
  }
}

async function assertRelationships(locationId: string, value: ValidatedLocationInput): Promise<{ regionName: string }> {
  const db = getDb();
  const region = (await db.prepare("SELECT name, stage FROM operating_regions WHERE id = ?").get(value.regionId)) as
    | { name: string; stage: string }
    | undefined;
  if (!region) throw new Error("region_missing");
  if (region.stage === "closed") throw new Error("region_closed");

  if (value.primaryLeaderUserId) {
    const leader = (await db.prepare("SELECT role, status FROM users WHERE id = ?").get(value.primaryLeaderUserId)) as
      | { role: string; status: string }
      | undefined;
    if (!leader || leader.status !== "active" || !["admin", "growth"].includes(leader.role)) {
      throw new Error("leader_ineligible");
    }
  }
  if (["launching", "active"].includes(value.stage) && !value.primaryLeaderUserId) {
    throw new Error("leader_required");
  }

  if (value.parentLocationId) {
    if (value.parentLocationId === locationId) throw new Error("parent_self");
    const parent = (await db.prepare("SELECT id, region_id, stage FROM locations WHERE id = ?").get(value.parentLocationId)) as
      | { id: string; region_id: string | null; stage: LocationStage }
      | undefined;
    if (!parent) throw new Error("parent_missing");
    if (parent.stage === "closed") throw new Error("parent_closed");
    if (parent.region_id !== value.regionId) throw new Error("parent_region_mismatch");

    const cycle = (await db.prepare(
          `WITH RECURSIVE ancestors(id, parent_id) AS (
         SELECT id, parent_location_id FROM locations WHERE id = ?
         UNION
         SELECT parent.id, parent.parent_location_id
           FROM locations parent
           JOIN ancestors child ON parent.id = child.parent_id
       )
       SELECT 1 FROM ancestors WHERE id = ? LIMIT 1`,
        ).get(value.parentLocationId, locationId));
    if (cycle) throw new Error("parent_cycle");
  }

  const duplicate = (await db.prepare(
      `SELECT id FROM locations
      WHERE id <> ? AND region_id = ? AND lower(trim(name)) = lower(trim(?))
      LIMIT 1`,
    ).get(locationId, value.regionId, value.name));
  if (duplicate) throw new Error("duplicate_location");

  const mismatchedChild = (await db.prepare(
      `SELECT id FROM locations
      WHERE parent_location_id = ? AND (region_id IS NULL OR region_id <> ?)
      LIMIT 1`,
    ).get(locationId, value.regionId));
  if (mismatchedChild) throw new Error("child_region_mismatch");

  return { regionName: region.name };
}

async function closeBlocker(locationId: string): Promise<string | null> {
  const db = getDb();
  const child = (await db.prepare("SELECT name FROM locations WHERE parent_location_id = ? AND stage <> 'closed' ORDER BY name LIMIT 1")
      .get(locationId)) as { name: string } | undefined;
  if (child) return `Close or move child Location ${child.name} first.`;
  const program = (await db.prepare(
      `SELECT name FROM programs
      WHERE location_id = ? AND stage NOT IN ('completed', 'renewed', 'closed')
      ORDER BY updated_at DESC LIMIT 1`,
    ).get(locationId)) as { name: string } | undefined;
  if (program) return `Resolve Program ${program.name} before closing this Location.`;
  const cls = (await db.prepare(
      `SELECT title FROM classes
      WHERE location_id = ? AND status NOT IN ('completed', 'cancelled')
      ORDER BY updated_at DESC LIMIT 1`,
    ).get(locationId)) as { title: string } | undefined;
  if (cls) return `Resolve Class ${cls.title} before closing this Location.`;
  return null;
}

function actionError(error: unknown): LocationActionResult {
  const code = error instanceof Error ? error.message : "";
  const errors: Record<string, string> = {
    region_missing: "The selected Region no longer exists. Refresh and choose another Region.",
    region_closed: "A closed Region cannot receive an operating Location.",
    leader_ineligible: "The market leader must be an active BOW staff member.",
    leader_required: "Launching and active Locations require an active market leader.",
    parent_self: "A Location cannot be its own parent.",
    parent_missing: "The selected parent Location no longer exists.",
    parent_closed: "A closed Location cannot become a parent for active operating work.",
    parent_region_mismatch: "A parent Location and child Location must belong to the same Region.",
    parent_cycle: "That parent would create a loop in the Location hierarchy.",
    duplicate_location: "A Location with this name already exists in the selected Region.",
    child_region_mismatch: "Move this Location's child sites before changing its Region.",
    location_changed: "This Location changed while you were editing it. Refresh and review the latest record before saving.",
    location_closed: "Closed Locations are historical records and cannot be edited.",
    transition_not_allowed: "That lifecycle move is not allowed from the Location's current stage.",
    transition_reason_required: "Explain the lifecycle change in at least 8 characters so the next operator understands the decision.",
  };
  if (errors[code]) return { ok: false, error: errors[code] };
  if (code.startsWith("close_blocked:")) return { ok: false, error: code.slice("close_blocked:".length) };
  return { ok: false, error: "The Location could not be saved. No operating records were changed." };
}

function revalidateLocation(locationId: string, parentIds: (string | null | undefined)[]) {
  revalidateEntity("location", locationId);
  for (const parentId of new Set(parentIds.filter((id): id is string => Boolean(id)))) {
    revalidatePath(`/app/locations/${parentId}`);
  }
}

export async function getLocationFormOptions(currentLocationId?: string): Promise<LocationFormOptions> {
  await requireStaff();
  const db = getDb();
  const currentId = currentLocationId ? identifier(currentLocationId) : null;
  const allLocations = (await db.prepare(
      "SELECT id, name, stage, region_id, parent_location_id FROM locations ORDER BY name",
    ).all()) as {
    id: string;
    name: string;
    stage: LocationStage;
    region_id: string | null;
    parent_location_id: string | null;
  }[];
  const excluded = new Set<string>();
  if (currentId) {
    excluded.add(currentId);
    let added = true;
    while (added) {
      added = false;
      for (const location of allLocations) {
        if (location.parent_location_id && excluded.has(location.parent_location_id) && !excluded.has(location.id)) {
          excluded.add(location.id);
          added = true;
        }
      }
    }
  }

  return {
    regions: (await db.prepare(
            "SELECT id, name, code, timezone, stage FROM operating_regions WHERE stage <> 'closed' ORDER BY name",
          ).all()) as LocationFormOptions["regions"],
    locations: allLocations
      .filter((location) => location.stage !== "closed" && !excluded.has(location.id))
      .map((location) => ({
        id: location.id,
        name: location.name,
        stage: location.stage,
        regionId: location.region_id,
      })),
    staff: (await db.prepare(
          "SELECT id, name FROM users WHERE status = 'active' AND role IN ('admin', 'growth') ORDER BY name",
        ).all()) as LocationFormOptions["staff"],
  };
}

export async function createLocation(input: LocationInput): Promise<LocationActionResult & { id?: string }> {
  const me = await requireStaff();
  const validated = (await validateInput(input));
  if (!validated.ok) return { ok: false, error: validated.error };
  const value = validated.value;
  if (value.stage !== "prospect") {
    return { ok: false, error: "A new Location must begin as a Prospect so its expansion decision remains visible." };
  }

  const id = `loc-${randomUUID()}`;
  const now = Date.now();
  try {
    (await beginTransaction(async () => {
            const db = getDb();
            const { regionName } = (await assertRelationships(id, value));
            (await db.prepare(
                      `INSERT INTO locations
          (id, name, type, region, city, state, address, timezone, parent_location_id, region_id,
           primary_leader_user_id, stage, capacity, expected_demand, rationale, earliest_launch_date,
           notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'prospect', ?, ?, ?, ?, ?, ?, ?)`,
                    ).run(
                      id,
                      value.name,
                      value.type,
                      regionName,
                      value.city,
                      value.state,
                      value.address,
                      value.timezone,
                      value.parentLocationId,
                      value.regionId,
                      value.primaryLeaderUserId,
                      value.capacity,
                      value.expectedDemand,
                      value.rationale,
                      value.earliestLaunchDate,
                      value.notes,
                      now,
                      now,
                    ));
            (await logActivity(
                      "location",
                      id,
                      "created",
                      `Location created as an expansion prospect in ${regionName}.`,
                      me.id,
                    ));
          }));
  } catch (error) {
    return actionError(error);
  }

  revalidateLocation(id, [value.parentLocationId]);
  return { ok: true, id };
}

export async function updateLocation(
  id: string,
  expectedUpdatedAt: number,
  expectedStage: LocationStage,
  input: LocationInput,
): Promise<LocationActionResult> {
  const me = await requireStaff();
  const locationId = identifier(id);
  if (!locationId) return { ok: false, error: "Location not found." };
  if (!Number.isSafeInteger(expectedUpdatedAt) || expectedUpdatedAt < 1 || !LOCATION_STAGES.includes(expectedStage)) {
    return { ok: false, error: "Refresh this Location before saving changes." };
  }
  const validated = (await validateInput(input));
  if (!validated.ok) return { ok: false, error: validated.error };
  const value = validated.value;
  let previousParentId: string | null = null;
  let deliveryLabelsChanged = false;

  try {
    (await beginTransaction(async () => {
            const db = getDb();
            const current = (await db.prepare("SELECT * FROM locations WHERE id = ?").get(locationId)) as LocationRow | undefined;
            if (!current) throw new Error("location_changed");
            if (current.stage === "closed") throw new Error("location_closed");
            if (current.updated_at !== expectedUpdatedAt || current.stage !== expectedStage) throw new Error("location_changed");

            if (value.stage !== current.stage) {
              if (!allowedLocationTransitions(current.stage).includes(value.stage)) throw new Error("transition_not_allowed");
              if (!value.transitionReason || value.transitionReason.length < 8) throw new Error("transition_reason_required");
              if (value.stage === "closed") {
                const blocker = (await closeBlocker(locationId));
                if (blocker) throw new Error(`close_blocked:${blocker}`);
              }
            }

            const { regionName } = (await assertRelationships(locationId, value));
            previousParentId = current.parent_location_id;
            const changedFields = [
              ["name", current.name, value.name],
              ["type", current.type, value.type],
              ["Region", current.region_id, value.regionId],
              ["parent Location", current.parent_location_id, value.parentLocationId],
              ["city", current.city, value.city],
              ["state or province", current.state, value.state],
              ["address", current.address, value.address],
              ["timezone", current.timezone, value.timezone],
              ["market leader", current.primary_leader_user_id, value.primaryLeaderUserId],
              ["capacity", current.capacity, value.capacity],
              ["expected demand", current.expected_demand, value.expectedDemand],
              ["earliest launch", current.earliest_launch_date, value.earliestLaunchDate],
              ["expansion rationale", current.rationale, value.rationale],
              ["operating notes", current.notes, value.notes],
            ].filter(([, before, after]) => String(before ?? "") !== String(after ?? ""));
            const nextUpdatedAt = Math.max(Date.now(), current.updated_at + 1);
            const updated = (await db.prepare(
                    `UPDATE locations SET
          name = ?, type = ?, region = ?, city = ?, state = ?, address = ?, timezone = ?,
          parent_location_id = ?, region_id = ?, primary_leader_user_id = ?, stage = ?, capacity = ?,
          expected_demand = ?, rationale = ?, earliest_launch_date = ?, notes = ?, updated_at = ?
         WHERE id = ? AND updated_at = ? AND stage = ?`,
                  ).run(
                    value.name,
                    value.type,
                    regionName,
                    value.city,
                    value.state,
                    value.address,
                    value.timezone,
                    value.parentLocationId,
                    value.regionId,
                    value.primaryLeaderUserId,
                    value.stage,
                    value.capacity,
                    value.expectedDemand,
                    value.rationale,
                    value.earliestLaunchDate,
                    value.notes,
                    nextUpdatedAt,
                    locationId,
                    current.updated_at,
                    current.stage,
                  ));
            if (updated.changes !== 1) throw new Error("location_changed");

            deliveryLabelsChanged = current.name !== value.name || current.city !== value.city || current.state !== value.state;
            if (deliveryLabelsChanged) {
              const deliveryLocationLabel = [value.name, value.city, value.state].filter(Boolean).join(" · ");
              (await db.prepare(
                          `UPDATE classes SET location = ?, updated_at = ?
            WHERE location_id = ? AND status NOT IN ('completed', 'cancelled')`,
                        ).run(deliveryLocationLabel, nextUpdatedAt, locationId));
            }

            if (value.stage !== current.stage) {
              (await logActivity(
                          "location",
                          locationId,
                          "stage_change",
                          `Location moved from ${current.stage.replace(/_/g, " ")} to ${value.stage.replace(/_/g, " ")}. ${value.transitionReason}`,
                          me.id,
                        ));
            }
            const changeSummary = changedFields.length > 0
              ? changedFields.map(([label]) => label).join(", ")
              : "no source facts";
            (await logActivity("location", locationId, "plan_updated", `Location plan updated. Changed: ${changeSummary}.`, me.id));
          }));
  } catch (error) {
    return actionError(error);
  }

  revalidateLocation(locationId, [previousParentId, value.parentLocationId]);
  if (deliveryLabelsChanged) {
    revalidatePath("/app/classes");
    revalidatePath("/app/classes/[id]", "page");
    revalidatePath("/app/programs/[id]", "page");
    revalidatePath("/app/teach", "layout");
  }
  return { ok: true };
}
