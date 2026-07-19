"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/dal";
import { getDb } from "@/lib/db";
import {
  CAMPAIGN_METRICS,
  deriveGrowthMetricActual,
  GROWTH_METRICS,
  type CampaignMetric,
  type GoalScopeType,
  type GrowthMetric,
  type GrowthOption,
} from "@/lib/growth";
import {
  isGrowthSearchKind,
  searchGrowthEntityOptions,
  type GrowthSearchKind,
} from "@/lib/growth-search";
import { logActivity } from "@/lib/hiring";
import {
  canonicalDateInZone,
  canonicalDateToUtcNoon,
  DEFAULT_TIME_ZONE,
  isValidTimeZone,
} from "@/lib/timezone";

export interface GrowthActionResult {
  ok: boolean;
  error?: string;
  id?: string;
  updatedAt?: number;
}

type Db = ReturnType<typeof getDb>;

const CAMPAIGN_STATUSES = ["draft", "active", "paused", "completed", "cancelled"] as const;
const CAMPAIGN_DECISIONS = ["scale", "iterate", "hold", "stop"] as const;
const CONTRIBUTOR_STATUSES = ["candidate", "active"] as const;
const ASSIGNMENT_ROLES = ["ambassador", "growth_captain", "market_lead", "regional_lead"] as const;
const GOAL_SCOPE_TYPES = ["organization", "region", "location", "campaign", "assignment", "program"] as const;
const TOUCHPOINT_TYPES = ["inquiry", "referral", "outreach", "event", "partner_distribution", "organic_social", "paid", "other"] as const;
const ATTRIBUTION_METHODS = ["direct", "self_reported", "referral", "imported", "operator_verified"] as const;
const OUTCOME_TYPES = ["completed", "progressed", "graduated", "withdrawn", "transferred"] as const;
const CONFIRMATION_SOURCES = ["student", "guardian", "partner", "staff", "imported"] as const;

type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];
type CampaignDecision = (typeof CAMPAIGN_DECISIONS)[number];
type ContributorStatus = (typeof CONTRIBUTOR_STATUSES)[number];
type AssignmentRole = (typeof ASSIGNMENT_ROLES)[number];
type TouchpointType = (typeof TOUCHPOINT_TYPES)[number];
type AttributionMethod = (typeof ATTRIBUTION_METHODS)[number];
type OutcomeType = (typeof OUTCOME_TYPES)[number];
type ConfirmationSource = (typeof CONFIRMATION_SOURCES)[number];

class GrowthActionError extends Error {}

function cleanText(value: unknown, label: string, maximum: number, minimum = 1): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length < minimum) {
    throw new GrowthActionError(minimum === 1 ? `${label} is required.` : `${label} must be at least ${minimum} characters.`);
  }
  if (text.length > maximum) throw new GrowthActionError(`${label} must be ${maximum.toLocaleString()} characters or fewer.`);
  return text;
}

function optionalText(value: unknown, label: string, maximum: number): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  if (text.length > maximum) throw new GrowthActionError(`${label} must be ${maximum.toLocaleString()} characters or fewer.`);
  return text;
}

function identifier(value: unknown, label: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > 120 || !/^[A-Za-z0-9._:-]+$/.test(text)) {
    throw new GrowthActionError(`Choose a valid ${label}.`);
  }
  return text;
}

function optionalIdentifier(value: unknown, label: string): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? identifier(text, label) : null;
}

function canonicalDate(value: unknown, label: string): string {
  const resolution = canonicalDateToUtcNoon(value);
  if (!resolution.ok) throw new GrowthActionError(`${label} must be a real calendar date.`);
  return resolution.canonicalDate;
}

function nonNegativeInteger(value: unknown, label: string, maximum = 10_000_000_000): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(number) || number < 0 || number > maximum) {
    throw new GrowthActionError(`${label} must be a whole number between 0 and ${maximum.toLocaleString()}.`);
  }
  return number;
}

function positiveInteger(value: unknown, label: string, maximum = 1_000_000_000): number {
  const number = nonNegativeInteger(value, label, maximum);
  if (number === 0) throw new GrowthActionError(`${label} must be greater than zero.`);
  return number;
}

function isOneOf<T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === "string" && values.includes(value as T[number]);
}

function nextTimestamp(previous?: number | null): number {
  return Math.max(Date.now(), (previous ?? 0) + 1);
}

async function transaction<T>(db: Db, work: () => T): Promise<T> {
  (await db.exec("BEGIN IMMEDIATE"));
  try {
    const result = work();
    (await db.exec("COMMIT"));
    return result;
  } catch (error) {
    try {
      (await db.exec("ROLLBACK"));
    } catch {
      // Preserve the operating error that explains why no mutation committed.
    }
    throw error;
  }
}

function actionError(error: unknown): GrowthActionResult {
  if (error instanceof GrowthActionError) return { ok: false, error: error.message };
  if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
    return { ok: false, error: "That operating record already exists. Refresh before creating another one." };
  }
  return { ok: false, error: "The growth record could not be saved. Nothing changed; refresh and try again." };
}

function revalidateGrowth(): void {
  revalidatePath("/app/growth");
  revalidatePath("/app");
  revalidatePath("/app/tasks");
}

async function activeStaff(db: Db, userId: string): Promise<boolean> {
  return Boolean((await db.prepare(
          "SELECT 1 FROM users WHERE id = ? AND status = 'active' AND role IN ('admin','growth')",
        ).get(userId)));
}

export type { GrowthSearchKind } from "@/lib/growth-search";

export interface GrowthSearchResult {
  ok: boolean;
  options: GrowthOption[];
  error?: string;
}

/**
 * Staff-only bounded search for high-cardinality form identities. The Growth
 * page must remain usable with 50,000 Students, so it never serializes an
 * arbitrary first 1,000 rows and pretends the rest do not exist.
 */
export async function searchGrowthEntities(input: {
  kind: GrowthSearchKind;
  query?: string;
}): Promise<GrowthSearchResult> {
  await requireStaff();
  const query = typeof input?.query === "string" ? input.query.trim().toLowerCase() : "";
  if (query.length > 120) return { ok: false, options: [], error: "Keep search under 120 characters." };
  const kind = input?.kind;
  if (!isGrowthSearchKind(kind)) {
    return { ok: false, options: [], error: "Choose a supported search." };
  }

  try {
    return { ok: true, options: (await searchGrowthEntityOptions(kind, query)) };
  } catch {
    return { ok: false, options: [], error: "Search is temporarily unavailable. Try again." };
  }
}

async function resolvedScope(
  db: Db,
  regionValue: unknown,
  locationValue: unknown,
): Promise<{ regionId: string | null; locationId: string | null }> {
  let regionId = optionalIdentifier(regionValue, "Region");
  const locationId = optionalIdentifier(locationValue, "Location");
  if (locationId) {
    const location = (await db.prepare("SELECT region_id FROM locations WHERE id = ? AND stage <> 'closed'")
          .get(locationId)) as unknown as { region_id: string | null } | undefined;
    if (!location) throw new GrowthActionError("Choose an open Location.");
    if (regionId && location.region_id !== regionId) throw new GrowthActionError("The selected Location does not belong to that Region.");
    regionId = location.region_id ?? regionId;
  }
  if (regionId && !(await db.prepare("SELECT 1 FROM operating_regions WHERE id = ? AND stage <> 'closed'").get(regionId))) {
    throw new GrowthActionError("Choose an open Region.");
  }
  return { regionId, locationId };
}

interface EvidenceCampaignRow {
  region_id: string | null;
  location_id: string | null;
  starts_on: string;
  ends_on: string;
  timezone: string | null;
}

interface EvidenceAssignmentRow {
  id: string;
  region_id: string | null;
  location_id: string | null;
  starts_on: string;
  ends_on: string | null;
  timezone: string | null;
}

function normalizedTimeZone(value: string | null): string {
  return isValidTimeZone(value) ? value : DEFAULT_TIME_ZONE;
}

/**
 * Resolve one local calendar interpretation for an exact acquisition instant.
 * Campaign geography wins; otherwise the contributor's non-overlapping role
 * assignment supplies the market timezone. This keeps a Los Angeles event out
 * of the next UTC day while preserving the exact epoch for audit ordering.
 */
async function resolveEvidenceCalendar(
  db: Db,
  input: {
    channelId: string;
    campaignId: string | null;
    contributorId: string | null;
    occurredAt: number;
  },
): Promise<{ occurredOn: string; timeZone: string }> {
  let campaign: EvidenceCampaignRow | undefined;
  let timeZone = DEFAULT_TIME_ZONE;
  let occurredOn = canonicalDateInZone(input.occurredAt, timeZone);

  if (input.campaignId) {
    campaign = (await db.prepare(
          `SELECT c.region_id, c.location_id, c.starts_on, c.ends_on,
              COALESCE(NULLIF(trim(l.timezone), ''), NULLIF(trim(r.timezone), '')) AS timezone
         FROM growth_campaigns c
         LEFT JOIN locations l ON l.id = c.location_id
         LEFT JOIN operating_regions r ON r.id = c.region_id
        WHERE c.id = ? AND c.channel_id = ? AND c.status = 'active'`,
        ).get(input.campaignId, input.channelId)) as unknown as EvidenceCampaignRow | undefined;
    if (!campaign) {
      throw new GrowthActionError("The selected campaign is not active or does not use that channel.");
    }
    timeZone = normalizedTimeZone(campaign.timezone);
    occurredOn = canonicalDateInZone(input.occurredAt, timeZone);
    if (occurredOn < campaign.starts_on || occurredOn > campaign.ends_on) {
      throw new GrowthActionError("The selected campaign is not active on this touchpoint date.");
    }
  }

  if (input.contributorId) {
    if (!(await db.prepare("SELECT 1 FROM growth_contributors WHERE id = ? AND status = 'active'").get(input.contributorId))) {
      throw new GrowthActionError("Choose an active contributor.");
    }
    const assignments = (await db.prepare(
          `SELECT a.id, a.region_id, a.location_id, a.starts_on, a.ends_on,
              COALESCE(NULLIF(trim(l.timezone), ''), NULLIF(trim(r.timezone), '')) AS timezone
         FROM growth_assignments a
         LEFT JOIN locations l ON l.id = a.location_id
         LEFT JOIN operating_regions r ON r.id = a.region_id
        WHERE a.contributor_id = ?
        ORDER BY a.starts_on, a.id`,
        ).all(input.contributorId)) as unknown as EvidenceAssignmentRow[];
    const matching = assignments.filter((assignment) => {
      const assignmentZone = campaign ? timeZone : normalizedTimeZone(assignment.timezone);
      const assignmentDate = campaign ? occurredOn : canonicalDateInZone(input.occurredAt, assignmentZone);
      if (assignmentDate < assignment.starts_on || assignmentDate > (assignment.ends_on ?? "9999-12-31")) return false;
      if (campaign?.region_id && assignment.region_id !== campaign.region_id) return false;
      if (
        campaign?.location_id
        && assignment.location_id !== campaign.location_id
        && !(assignment.location_id === null && assignment.region_id === campaign.region_id)
      ) return false;
      return true;
    });
    if (matching.length === 0) {
      throw new GrowthActionError("The contributor has no role assignment covering this date and campaign market.");
    }
    if (matching.length > 1) {
      throw new GrowthActionError("The contributor has overlapping role assignments. Reconcile the timeline before recording evidence.");
    }
    if (!campaign) {
      timeZone = normalizedTimeZone(matching[0].timezone);
      occurredOn = canonicalDateInZone(input.occurredAt, timeZone);
    }
  }

  return { occurredOn, timeZone };
}

export interface CreateGrowthCampaignInput {
  name: string;
  channelId: string;
  ownerUserId?: string;
  regionId?: string;
  locationId?: string;
  hypothesis: string;
  status: "draft" | "active";
  startsOn: string;
  endsOn: string;
  targetMetric: CampaignMetric;
  targetValue: number;
  budgetCents: number;
}

export async function createGrowthCampaign(input: CreateGrowthCampaignInput): Promise<GrowthActionResult> {
  const me = await requireStaff();
  try {
    const name = cleanText(input?.name, "Campaign name", 160, 3);
    const channelId = identifier(input?.channelId, "channel");
    const ownerUserId = optionalIdentifier(input?.ownerUserId, "owner");
    const hypothesis = cleanText(input?.hypothesis, "Hypothesis", 2000, 20);
    if (input?.status !== "draft" && input?.status !== "active") throw new GrowthActionError("Choose draft or active status.");
    const startsOn = canonicalDate(input?.startsOn, "Start date");
    const endsOn = canonicalDate(input?.endsOn, "End date");
    if (endsOn < startsOn) throw new GrowthActionError("End date cannot be before start date.");
    if (!isOneOf(CAMPAIGN_METRICS, input?.targetMetric)) throw new GrowthActionError("Choose a supported campaign outcome metric.");
    const targetValue = positiveInteger(input?.targetValue, "Target");
    const budgetCents = nonNegativeInteger(input?.budgetCents, "Budget in cents");
    const db = getDb();
    if (!(await db.prepare("SELECT 1 FROM growth_channels WHERE id = ? AND status = 'active'").get(channelId))) {
      throw new GrowthActionError("Choose an active growth channel.");
    }
    if (ownerUserId && !(await activeStaff(db, ownerUserId))) throw new GrowthActionError("Choose an active staff owner.");
    if (input.status === "active" && !ownerUserId) throw new GrowthActionError("An active campaign needs an accountable owner.");
    const scope = (await resolvedScope(db, input?.regionId, input?.locationId));
    const now = Date.now();
    const id = `gcp-${randomUUID()}`;
    (await transaction(db, async () => {
            (await db.prepare(
                      `INSERT INTO growth_campaigns
          (id, name, channel_id, owner_user_id, region_id, location_id, hypothesis, status,
           starts_on, ends_on, target_metric, target_value, budget_cents, spend_cents,
           result_value, decision, learning, created_by_user_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, NULL, ?, ?, ?)`,
                    ).run(
                      id,
                      name,
                      channelId,
                      ownerUserId,
                      scope.regionId,
                      scope.locationId,
                      hypothesis,
                      input.status,
                      startsOn,
                      endsOn,
                      input.targetMetric,
                      targetValue,
                      budgetCents,
                      me.id,
                      now,
                      now,
                    ));
            (await logActivity("growth_campaign", id, "created", `${name} created as ${input.status}; target ${targetValue} ${input.targetMetric.replace(/_/g, " ")}.`, me.id));
          }));
    revalidateGrowth();
    return { ok: true, id, updatedAt: now };
  } catch (error) {
    return actionError(error);
  }
}

export interface UpdateGrowthCampaignStateInput {
  id: string;
  expectedUpdatedAt: number;
  nextStatus: CampaignStatus;
  spendCents: number;
  spendNote?: string;
  decision?: CampaignDecision;
  learning?: string;
}

export async function updateGrowthCampaignState(input: UpdateGrowthCampaignStateInput): Promise<GrowthActionResult> {
  const me = await requireStaff();
  try {
    const id = identifier(input?.id, "campaign");
    const expectedUpdatedAt = positiveInteger(input?.expectedUpdatedAt, "Evidence version", Number.MAX_SAFE_INTEGER);
    if (!isOneOf(CAMPAIGN_STATUSES, input?.nextStatus)) throw new GrowthActionError("Choose a valid campaign state.");
    const spendCents = nonNegativeInteger(input?.spendCents, "Spend in cents");
    const spendNote = optionalText(input?.spendNote, "Spend evidence", 1000);
    const decision = isOneOf(CAMPAIGN_DECISIONS, input?.decision) ? input.decision : null;
    const learning = optionalText(input?.learning, "Learning", 3000);
    const db = getDb();
    const updatedAt = (await transaction(db, async () => {
          const campaign = (await db.prepare(
                  `SELECT status, target_metric, starts_on, ends_on, spend_cents, updated_at
           FROM growth_campaigns WHERE id = ?`,
                ).get(id)) as unknown as {
            status: CampaignStatus;
            target_metric: CampaignMetric;
            starts_on: string;
            ends_on: string;
            spend_cents: number;
            updated_at: number;
          } | undefined;
          if (!campaign) throw new GrowthActionError("This campaign no longer exists.");
          if (campaign.updated_at !== expectedUpdatedAt) throw new GrowthActionError("This campaign changed. Refresh before saving another decision.");
          const allowed: Record<CampaignStatus, CampaignStatus[]> = {
            draft: ["draft", "active", "cancelled"],
            active: ["active", "paused", "completed", "cancelled"],
            paused: ["paused", "active", "completed", "cancelled"],
            completed: ["completed"],
            cancelled: ["cancelled"],
          };
          if (!allowed[campaign.status].includes(input.nextStatus)) {
            throw new GrowthActionError(`A ${campaign.status} campaign cannot move to ${input.nextStatus}.`);
          }
          if (campaign.status === "completed" || campaign.status === "cancelled") {
            throw new GrowthActionError("Completed and cancelled campaigns are locked operating history.");
          }
          if (input.nextStatus === "completed" && (!decision || !learning || learning.length < 20)) {
            throw new GrowthActionError("Completion needs a scale, iterate, hold, or stop decision and at least 20 characters of reusable learning.");
          }
          if (input.nextStatus === "cancelled" && (!learning || learning.length < 10)) {
            throw new GrowthActionError("Explain why this campaign is being cancelled.");
          }
          if (input.nextStatus === "active" && campaign.ends_on < canonicalDateInZone()) {
            throw new GrowthActionError("An expired campaign cannot be activated. Close it with a result and decision instead.");
          }
          if (input.nextStatus === "draft" && spendCents > 0) {
            throw new GrowthActionError("Draft campaigns cannot record spend before activation.");
          }
          const spendDelta = spendCents - Number(campaign.spend_cents);
          if (spendDelta !== 0 && (!spendNote || spendNote.length < 10)) {
            throw new GrowthActionError("Explain the invoice, expense, or correction whenever campaign spend changes.");
          }
          const resultValue = input.nextStatus === "completed" || input.nextStatus === "cancelled"
            ? deriveGrowthMetricActual(campaign.target_metric, "campaign", id, campaign.starts_on, campaign.ends_on)
            : null;
          const resolvedDecision = input.nextStatus === "cancelled" ? "stop" : decision;
          const nextUpdatedAt = nextTimestamp(campaign.updated_at);
          const result = (await db.prepare(
                  `UPDATE growth_campaigns
            SET status = ?, spend_cents = ?, result_value = ?, decision = ?, learning = ?, updated_at = ?
          WHERE id = ? AND updated_at = ?`,
                ).run(
                  input.nextStatus,
                  spendCents,
                  resultValue,
                  resolvedDecision,
                  learning,
                  nextUpdatedAt,
                  id,
                  campaign.updated_at,
                ));
          if (Number(result.changes) !== 1) throw new GrowthActionError("This campaign changed. Refresh before saving another decision.");
          (await logActivity(
                    "growth_campaign",
                    id,
                    "status",
                    `${campaign.status} → ${input.nextStatus}; spend $${(spendCents / 100).toFixed(2)}${spendDelta === 0 ? "" : ` (${spendDelta > 0 ? "+" : "-"}$${(Math.abs(spendDelta) / 100).toFixed(2)}: ${spendNote})`}${resultValue == null ? "" : `; derived result ${resultValue}`}.${learning ? ` Learning: ${learning}` : ""}`,
                    me.id,
                  ));
          return nextUpdatedAt;
        }));
    revalidateGrowth();
    return { ok: true, id, updatedAt };
  } catch (error) {
    return actionError(error);
  }
}

export interface CreateGrowthContributorInput {
  personId: string;
  status: ContributorStatus;
  sourceChannelId?: string;
  joinedOn?: string;
  notes?: string;
}

export async function createGrowthContributor(input: CreateGrowthContributorInput): Promise<GrowthActionResult> {
  const me = await requireStaff();
  try {
    const personId = identifier(input?.personId, "person");
    if (!isOneOf(CONTRIBUTOR_STATUSES, input?.status)) throw new GrowthActionError("Choose candidate or active status.");
    const sourceChannelId = optionalIdentifier(input?.sourceChannelId, "source channel");
    const joinedOn = input.status === "active"
      ? canonicalDate(input?.joinedOn || canonicalDateInZone(), "Join date")
      : null;
    const notes = optionalText(input?.notes, "Contributor notes", 2000);
    const db = getDb();
    if (!(await db.prepare("SELECT 1 FROM people WHERE id = ?").get(personId))) throw new GrowthActionError("Choose an existing Person record.");
    if ((await db.prepare("SELECT 1 FROM growth_contributors WHERE person_id = ?").get(personId))) {
      throw new GrowthActionError("This person already has a growth-network record.");
    }
    if (sourceChannelId && !(await db.prepare("SELECT 1 FROM growth_channels WHERE id = ?").get(sourceChannelId))) {
      throw new GrowthActionError("Choose a valid source channel.");
    }
    const id = `gct-${randomUUID()}`;
    const now = Date.now();
    (await transaction(db, async () => {
            (await db.prepare(
                      `INSERT INTO growth_contributors
          (id, person_id, status, source_channel_id, joined_on, exited_on, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
                    ).run(id, personId, input.status, sourceChannelId, joinedOn, notes, now, now));
            (await logActivity("growth_contributor", id, "created", `Growth-network record created as ${input.status}.`, me.id));
            (await logActivity("person", personId, "growth_network", `Joined the growth network as ${input.status}.`, me.id));
          }));
    revalidateGrowth();
    return { ok: true, id, updatedAt: now };
  } catch (error) {
    return actionError(error);
  }
}

export interface CreateGrowthAssignmentInput {
  contributorId: string;
  role: AssignmentRole;
  managerAssignmentId?: string;
  regionId?: string;
  locationId?: string;
  startsOn: string;
  decisionReason: string;
}

export async function createGrowthAssignment(input: CreateGrowthAssignmentInput): Promise<GrowthActionResult> {
  const me = await requireStaff();
  try {
    const contributorId = identifier(input?.contributorId, "contributor");
    if (!isOneOf(ASSIGNMENT_ROLES, input?.role)) throw new GrowthActionError("Choose a valid contributor role.");
    const managerAssignmentId = optionalIdentifier(input?.managerAssignmentId, "manager assignment");
    const startsOn = canonicalDate(input?.startsOn, "Assignment start date");
    if (startsOn > canonicalDateInZone()) {
      throw new GrowthActionError("Start a contributor assignment when responsibility actually begins; use Work to plan a future handoff.");
    }
    const decisionReason = cleanText(input?.decisionReason, "Assignment reason", 1000, 10);
    const db = getDb();
    const contributor = (await db.prepare("SELECT status, joined_on, updated_at FROM growth_contributors WHERE id = ?")
          .get(contributorId)) as unknown as { status: string; joined_on: string | null; updated_at: number } | undefined;
    if (!contributor) throw new GrowthActionError("Choose an existing growth contributor.");
    if (contributor.status === "paused" || contributor.status === "alumni") {
      throw new GrowthActionError("Paused and alumni contributors cannot receive an active assignment.");
    }
    if ((await db.prepare(
          "SELECT 1 FROM growth_assignments WHERE contributor_id = ? AND status = 'active' AND ends_on IS NULL",
        ).get(contributorId))) {
      throw new GrowthActionError("This contributor already owns a current role. Close that assignment before starting another one.");
    }
    if ((await db.prepare(
          "SELECT 1 FROM growth_assignments WHERE contributor_id = ? AND COALESCE(ends_on, '9999-12-31') >= ?",
        ).get(contributorId, startsOn))) {
      throw new GrowthActionError("This start date overlaps the contributor's existing assignment history.");
    }
    let scope = (await resolvedScope(db, input?.regionId, input?.locationId));
    let manager: { contributor_id: string; role: AssignmentRole; region_id: string | null; location_id: string | null; starts_on: string } | undefined;
    if (managerAssignmentId) {
      manager = (await db.prepare(
              `SELECT contributor_id, role, region_id, location_id, starts_on
           FROM growth_assignments WHERE id = ? AND status = 'active' AND ends_on IS NULL`,
            ).get(managerAssignmentId)) as unknown as typeof manager;
      if (!manager) throw new GrowthActionError("Choose a current manager assignment.");
      if (manager.contributor_id === contributorId) throw new GrowthActionError("A contributor cannot manage their own assignment.");
      const allowedManagers: Record<AssignmentRole, AssignmentRole[]> = {
        regional_lead: [],
        market_lead: ["regional_lead"],
        growth_captain: ["market_lead", "regional_lead"],
        ambassador: ["growth_captain", "market_lead", "regional_lead"],
      };
      if (!allowedManagers[input.role].includes(manager.role)) {
        throw new GrowthActionError(`${manager.role.replace(/_/g, " ")} cannot manage a ${input.role.replace(/_/g, " ")} assignment.`);
      }
      if (startsOn < manager.starts_on) {
        throw new GrowthActionError("A contributor assignment cannot start before its manager's assignment.");
      }
      scope = {
        regionId: scope.regionId ?? manager.region_id,
        locationId: scope.locationId ?? manager.location_id,
      };
      if (manager.region_id && scope.regionId !== manager.region_id) throw new GrowthActionError("The assignment must remain inside the manager's Region.");
      if (manager.location_id && scope.locationId !== manager.location_id) throw new GrowthActionError("The assignment must remain inside the manager's Location.");
    }
    if (scope.locationId && scope.regionId) {
      const location = (await db.prepare("SELECT region_id FROM locations WHERE id = ?").get(scope.locationId)) as unknown as { region_id: string | null };
      if (location.region_id !== scope.regionId) {
        throw new GrowthActionError("Assign the Location to the manager's Region before placing a contributor there.");
      }
    }
    if (input.role === "regional_lead") {
      if (managerAssignmentId || !scope.regionId || scope.locationId) {
        throw new GrowthActionError("A Regional Lead needs one Region, no Location, and no contributor manager.");
      }
    } else if (!managerAssignmentId) {
      throw new GrowthActionError("This role needs an explicit current manager assignment.");
    }
    if ((input.role === "market_lead" || input.role === "growth_captain") && !scope.locationId) {
      throw new GrowthActionError("Market Leads and Growth Captains need a Location scope.");
    }
    const now = Date.now();
    const id = `gas-${randomUUID()}`;
    (await transaction(db, async () => {
            if (contributor.status === "candidate") {
              const promotedAt = nextTimestamp(contributor.updated_at);
              (await db.prepare(
                          "UPDATE growth_contributors SET status = 'active', joined_on = COALESCE(joined_on, ?), updated_at = ? WHERE id = ? AND updated_at = ?",
                        ).run(startsOn, promotedAt, contributorId, contributor.updated_at));
            }
            (await db.prepare(
                      `INSERT INTO growth_assignments
          (id, contributor_id, role, manager_assignment_id, region_id, location_id, starts_on, ends_on,
           status, decision_reason, created_by_user_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'active', ?, ?, ?, ?)`,
                    ).run(id, contributorId, input.role, managerAssignmentId, scope.regionId, scope.locationId, startsOn, decisionReason, me.id, now, now));
            (await logActivity("growth_assignment", id, "created", `${input.role.replace(/_/g, " ")} assignment started. ${decisionReason}`, me.id));
            (await logActivity("growth_contributor", contributorId, "assignment", `${input.role.replace(/_/g, " ")} scope assigned.`, me.id));
          }));
    revalidateGrowth();
    return { ok: true, id, updatedAt: now };
  } catch (error) {
    return actionError(error);
  }
}

export interface CloseGrowthAssignmentInput {
  id: string;
  expectedUpdatedAt: number;
  status: "completed" | "cancelled";
  endsOn: string;
  closureReason: string;
}

export async function closeGrowthAssignment(input: CloseGrowthAssignmentInput): Promise<GrowthActionResult> {
  const me = await requireStaff();
  try {
    const id = identifier(input?.id, "assignment");
    const expectedUpdatedAt = positiveInteger(input?.expectedUpdatedAt, "Evidence version", Number.MAX_SAFE_INTEGER);
    if (input?.status !== "completed" && input?.status !== "cancelled") {
      throw new GrowthActionError("Choose whether the assignment was completed or cancelled.");
    }
    const endsOn = canonicalDate(input?.endsOn, "Assignment end date");
    if (endsOn > canonicalDateInZone()) throw new GrowthActionError("Close an assignment on or after its actual final day, not in the future.");
    const closureReason = cleanText(input?.closureReason, "Closure reason", 1000, 10);
    const db = getDb();
    const closedAt = (await transaction(db, async () => {
          const assignment = (await db.prepare(
                  `SELECT contributor_id, role, starts_on, status, updated_at
           FROM growth_assignments WHERE id = ?`,
                ).get(id)) as unknown as {
            contributor_id: string;
            role: AssignmentRole;
            starts_on: string;
            status: string;
            updated_at: number;
          } | undefined;
          if (!assignment) throw new GrowthActionError("This contributor assignment no longer exists.");
          if (assignment.status !== "active") throw new GrowthActionError("This assignment is already locked operating history.");
          if (assignment.updated_at !== expectedUpdatedAt) throw new GrowthActionError("This assignment changed. Refresh before closing it.");
          if (endsOn < assignment.starts_on) throw new GrowthActionError("The assignment cannot end before it started.");
          if ((await db.prepare(
                  `SELECT 1 FROM growth_assignments child
          WHERE child.manager_assignment_id = ?
            AND (child.ends_on IS NULL OR child.ends_on > ?)
          LIMIT 1`,
                ).get(id, endsOn))) {
            throw new GrowthActionError("Close every direct report through this date before closing their manager assignment.");
          }
          const laterEvidence = (await db.prepare(
                  `SELECT occurred_on FROM student_acquisition_touchpoints
          WHERE contributor_id = ? AND occurred_on > ? AND occurred_on >= ?
          ORDER BY occurred_on DESC LIMIT 1`,
                ).get(assignment.contributor_id, endsOn, assignment.starts_on)) as unknown as { occurred_on: string } | undefined;
          if (laterEvidence) {
            throw new GrowthActionError(`This contributor has evidence on ${laterEvidence.occurred_on}. Choose that date or a later final day.`);
          }
          const nextUpdatedAt = nextTimestamp(assignment.updated_at);
          const updated = (await db.prepare(
                  `UPDATE growth_assignments
            SET status = ?, ends_on = ?, closed_by_user_id = ?, closure_reason = ?, updated_at = ?
          WHERE id = ? AND status = 'active' AND updated_at = ?`,
                ).run(input.status, endsOn, me.id, closureReason, nextUpdatedAt, id, assignment.updated_at));
          if (Number(updated.changes) !== 1) throw new GrowthActionError("This assignment changed. Refresh before closing it.");
          (await logActivity(
                    "growth_assignment",
                    id,
                    "closed",
                    `${assignment.role.replace(/_/g, " ")} assignment ${input.status} on ${endsOn}. ${closureReason}`,
                    me.id,
                  ));
          (await logActivity("growth_contributor", assignment.contributor_id, "assignment_closed", `${input.status} on ${endsOn}. ${closureReason}`, me.id));
          return nextUpdatedAt;
        }));
    revalidateGrowth();
    return { ok: true, id, updatedAt: closedAt };
  } catch (error) {
    return actionError(error);
  }
}

export interface UpdateGrowthContributorStatusInput {
  id: string;
  expectedUpdatedAt: number;
  nextStatus: "active" | "paused" | "alumni";
  effectiveOn: string;
  reason: string;
}

export async function updateGrowthContributorStatus(input: UpdateGrowthContributorStatusInput): Promise<GrowthActionResult> {
  const me = await requireStaff();
  try {
    const id = identifier(input?.id, "contributor");
    const expectedUpdatedAt = positiveInteger(input?.expectedUpdatedAt, "Evidence version", Number.MAX_SAFE_INTEGER);
    if (!["active", "paused", "alumni"].includes(input?.nextStatus)) {
      throw new GrowthActionError("Choose a valid contributor lifecycle state.");
    }
    const effectiveOn = canonicalDate(input?.effectiveOn, "Effective date");
    if (effectiveOn > canonicalDateInZone()) throw new GrowthActionError("A contributor lifecycle change cannot take effect in the future.");
    const reason = cleanText(input?.reason, "Lifecycle reason", 1000, 10);
    const db = getDb();
    const updatedAt = (await transaction(db, async () => {
          const contributor = (await db.prepare(
                  "SELECT status, joined_on, exited_on, updated_at FROM growth_contributors WHERE id = ?",
                ).get(id)) as unknown as {
            status: "candidate" | "active" | "paused" | "alumni";
            joined_on: string | null;
            exited_on: string | null;
            updated_at: number;
          } | undefined;
          if (!contributor) throw new GrowthActionError("This growth contributor no longer exists.");
          if (contributor.updated_at !== expectedUpdatedAt) throw new GrowthActionError("This contributor changed. Refresh before saving another lifecycle decision.");
          if (contributor.status === "alumni") throw new GrowthActionError("Alumni status is locked operating history.");
          if (contributor.status === input.nextStatus) throw new GrowthActionError(`This contributor is already ${input.nextStatus}.`);
          const allowed: Record<"candidate" | "active" | "paused" | "alumni", Array<UpdateGrowthContributorStatusInput["nextStatus"]>> = {
            candidate: ["active"],
            active: ["paused", "alumni"],
            paused: ["active", "alumni"],
            alumni: [],
          };
          if (!allowed[contributor.status].includes(input.nextStatus)) {
            throw new GrowthActionError(`A ${contributor.status} contributor cannot move directly to ${input.nextStatus}.`);
          }
          if (input.nextStatus !== "active" && (await db.prepare(
                  "SELECT 1 FROM growth_assignments WHERE contributor_id = ? AND status = 'active' AND ends_on IS NULL",
                ).get(id))) {
            throw new GrowthActionError("Close the contributor's current assignment before pausing or moving them to alumni.");
          }
          const joinedOn = contributor.joined_on ?? (input.nextStatus === "active" ? effectiveOn : null);
          if (!joinedOn) throw new GrowthActionError("Activate this candidate before using another lifecycle state.");
          if (effectiveOn < joinedOn) throw new GrowthActionError("The effective date cannot be before the contributor joined.");
          const exitedOn = input.nextStatus === "alumni" ? effectiveOn : null;
          const nextUpdatedAt = nextTimestamp(contributor.updated_at);
          const updated = (await db.prepare(
                  `UPDATE growth_contributors
            SET status = ?, joined_on = ?, exited_on = ?, updated_at = ?
          WHERE id = ? AND updated_at = ?`,
                ).run(input.nextStatus, joinedOn, exitedOn, nextUpdatedAt, id, contributor.updated_at));
          if (Number(updated.changes) !== 1) throw new GrowthActionError("This contributor changed. Refresh before saving another lifecycle decision.");
          (await logActivity(
                    "growth_contributor",
                    id,
                    "status",
                    `${contributor.status} → ${input.nextStatus} effective ${effectiveOn}. ${reason}`,
                    me.id,
                  ));
          return nextUpdatedAt;
        }));
    revalidateGrowth();
    return { ok: true, id, updatedAt };
  } catch (error) {
    return actionError(error);
  }
}

export interface CreateOperatingGoalInput {
  scopeType: GoalScopeType;
  scopeId: string;
  metric: GrowthMetric;
  targetValue: number;
  startsOn: string;
  endsOn: string;
  ownerUserId: string;
  notes?: string;
}

async function validGoalScope(db: Db, scopeType: GoalScopeType, scopeId: string): Promise<boolean> {
  const tables: Record<GoalScopeType, string> = {
    organization: "organizations",
    region: "operating_regions",
    location: "locations",
    campaign: "growth_campaigns",
    assignment: "growth_assignments",
    program: "programs",
  };
  return Boolean((await db.prepare(`SELECT 1 FROM ${tables[scopeType]} WHERE id = ?`).get(scopeId)));
}

export async function createOperatingGoal(input: CreateOperatingGoalInput): Promise<GrowthActionResult> {
  const me = await requireStaff();
  try {
    if (!isOneOf(GOAL_SCOPE_TYPES, input?.scopeType)) throw new GrowthActionError("Choose a valid goal scope.");
    const scopeId = identifier(input?.scopeId, "goal scope");
    if (!isOneOf(GROWTH_METRICS, input?.metric)) throw new GrowthActionError("Choose a supported evidence metric.");
    const targetValue = positiveInteger(input?.targetValue, "Goal target");
    const startsOn = canonicalDate(input?.startsOn, "Goal start date");
    const endsOn = canonicalDate(input?.endsOn, "Goal end date");
    if (endsOn < startsOn) throw new GrowthActionError("Goal end date cannot be before its start date.");
    const ownerUserId = identifier(input?.ownerUserId, "goal owner");
    const notes = optionalText(input?.notes, "Goal notes", 2000);
    const db = getDb();
    if (!(await validGoalScope(db, input.scopeType, scopeId))) throw new GrowthActionError("The selected goal scope no longer exists.");
    if (!(await activeStaff(db, ownerUserId))) throw new GrowthActionError("Choose an active staff goal owner.");
    const id = `gol-${randomUUID()}`;
    const now = Date.now();
    (await transaction(db, async () => {
            (await db.prepare(
                      `INSERT INTO operating_goals
          (id, scope_type, scope_id, metric, target_value, starts_on, ends_on, owner_user_id,
           status, notes, created_by_user_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
                    ).run(id, input.scopeType, scopeId, input.metric, targetValue, startsOn, endsOn, ownerUserId, notes, me.id, now, now));
            (await logActivity("operating_goal", id, "created", `${targetValue} ${input.metric.replace(/_/g, " ")} by ${endsOn}.`, me.id));
          }));
    revalidateGrowth();
    return { ok: true, id, updatedAt: now };
  } catch (error) {
    return actionError(error);
  }
}

export interface CloseOperatingGoalInput {
  id: string;
  expectedUpdatedAt: number;
  mode: "close" | "cancel";
  decisionNote: string;
}

export async function closeOperatingGoal(input: CloseOperatingGoalInput): Promise<GrowthActionResult> {
  const me = await requireStaff();
  try {
    const id = identifier(input?.id, "goal");
    const expectedUpdatedAt = positiveInteger(input?.expectedUpdatedAt, "Evidence version", Number.MAX_SAFE_INTEGER);
    if (input?.mode !== "close" && input?.mode !== "cancel") {
      throw new GrowthActionError("Choose whether to close or cancel this goal.");
    }
    const decisionNote = cleanText(input?.decisionNote, input.mode === "cancel" ? "Cancellation reason" : "Goal learning", 2000, 10);
    const db = getDb();
    const result = (await transaction(db, async () => {
          const goal = (await db.prepare(
                  `SELECT scope_type, scope_id, metric, target_value, starts_on, ends_on, status, updated_at
           FROM operating_goals WHERE id = ?`,
                ).get(id)) as unknown as {
            scope_type: GoalScopeType;
            scope_id: string;
            metric: GrowthMetric;
            target_value: number;
            starts_on: string;
            ends_on: string;
            status: string;
            updated_at: number;
          } | undefined;
          if (!goal) throw new GrowthActionError("This operating goal no longer exists.");
          if (goal.status !== "active") throw new GrowthActionError("This goal is already locked operating history.");
          if (goal.updated_at !== expectedUpdatedAt) throw new GrowthActionError("This goal changed. Refresh before recording its result.");
          const actual = await deriveGrowthMetricActual(
            goal.metric,
            goal.scope_type,
            goal.scope_id,
            goal.starts_on,
            goal.ends_on,
          );
          const status = input.mode === "cancel"
            ? "cancelled"
            : (actual >= Number(goal.target_value) ? "achieved" : "missed");
          const closedAt = nextTimestamp(goal.updated_at);
          const updated = (await db.prepare(
                  `UPDATE operating_goals
            SET status = ?, result_value = ?, closed_at = ?, decision_note = ?, updated_at = ?
          WHERE id = ? AND status = 'active' AND updated_at = ?`,
                ).run(status, actual, closedAt, decisionNote, closedAt, id, goal.updated_at));
          if (Number(updated.changes) !== 1) throw new GrowthActionError("This goal changed. Refresh before recording its result.");
          (await logActivity(
                    "operating_goal",
                    id,
                    "closed",
                    `${status}; derived result ${actual} of ${Number(goal.target_value)} ${goal.metric.replace(/_/g, " ")}. ${decisionNote}`,
                    me.id,
                  ));
          return { status, actual, closedAt };
        }));
    revalidateGrowth();
    return { ok: true, id, updatedAt: result.closedAt };
  } catch (error) {
    return actionError(error);
  }
}

export interface RecordStudentAcquisitionInput {
  studentId: string;
  channelId: string;
  campaignId?: string;
  contributorId?: string;
  touchpointType: TouchpointType;
  method: AttributionMethod;
  evidenceNote: string;
  detail?: string;
  occurredAt?: number;
}

async function replaceCurrentAttribution(
  db: Db,
  studentId: string,
  touchpointId: string,
  method: AttributionMethod,
  evidenceNote: string,
  actorUserId: string,
  now: number,
): Promise<void> {
  const current = (await db.prepare(
      "SELECT id, effective_from FROM student_acquisition_attributions WHERE student_id = ? AND effective_to IS NULL",
    ).get(studentId)) as unknown as { id: string; effective_from: number } | undefined;
  const effectiveAt = Math.max(now, (current?.effective_from ?? 0) + 1);
  if (current) {
    const closed = (await db.prepare(
          "UPDATE student_acquisition_attributions SET effective_to = ? WHERE id = ? AND effective_to IS NULL",
        ).run(effectiveAt, current.id));
    if (Number(closed.changes) !== 1) throw new GrowthActionError("This student's attribution changed. Refresh and try again.");
  }
  (await db.prepare(
        `INSERT INTO student_acquisition_attributions
      (id, student_id, touchpoint_id, method, evidence_note, effective_from, effective_to,
       decided_by_user_id, decision_source, decision_source_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?, 'operator', NULL, ?)`,
      ).run(`saa-${randomUUID()}`, studentId, touchpointId, method, evidenceNote, effectiveAt, actorUserId, now));
}

export async function recordStudentAcquisition(input: RecordStudentAcquisitionInput): Promise<GrowthActionResult> {
  const me = await requireStaff();
  try {
    const studentId = identifier(input?.studentId, "student");
    const channelId = identifier(input?.channelId, "channel");
    const campaignId = optionalIdentifier(input?.campaignId, "campaign");
    const contributorId = optionalIdentifier(input?.contributorId, "contributor");
    if (!isOneOf(TOUCHPOINT_TYPES, input?.touchpointType)) throw new GrowthActionError("Choose a valid touchpoint type.");
    if (!isOneOf(ATTRIBUTION_METHODS, input?.method)) throw new GrowthActionError("Choose how this attribution was verified.");
    const evidenceNote = cleanText(input?.evidenceNote, "Attribution evidence", 1000, 10);
    const detail = optionalText(input?.detail, "Touchpoint detail", 2000);
    const occurredAt = input?.occurredAt == null ? Date.now() : positiveInteger(input.occurredAt, "Touchpoint time", Number.MAX_SAFE_INTEGER);
    if (occurredAt > Date.now() + 5 * 60 * 1000) throw new GrowthActionError("A touchpoint cannot be recorded in the future.");
    const db = getDb();
    const student = (await db.prepare("SELECT person_id, guardian_person_id FROM students WHERE id = ? AND enrollment_status = 'active'")
          .get(studentId)) as unknown as { person_id: string | null; guardian_person_id: string | null } | undefined;
    const acquisitionPersonId = student?.person_id ?? student?.guardian_person_id ?? null;
    if (!acquisitionPersonId) throw new GrowthActionError("This Student needs a canonical Student or guardian Person identity before attribution can be recorded.");
    if (!(await db.prepare("SELECT 1 FROM growth_channels WHERE id = ? AND status = 'active'").get(channelId))) {
      throw new GrowthActionError("Choose an active acquisition channel.");
    }
    const calendar = (await resolveEvidenceCalendar(db, { channelId, campaignId, contributorId, occurredAt }));
    const id = `sat-${randomUUID()}`;
    const now = Date.now();
    (await transaction(db, async () => {
            (await db.prepare(
                      `INSERT INTO student_acquisition_touchpoints
          (id, person_id, student_id, channel_id, campaign_id, contributor_id, touchpoint_type,
           occurred_at, occurred_on, timezone, external_key, detail, recorded_by_user_id,
           voided_at, voided_by_user_id, void_reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL, NULL, NULL, ?)`,
                    ).run(
                      id,
                      acquisitionPersonId,
                      studentId,
                      channelId,
                      campaignId,
                      contributorId,
                      input.touchpointType,
                      occurredAt,
                      calendar.occurredOn,
                      calendar.timeZone,
                      detail,
                      me.id,
                      now,
                    ));
            (await replaceCurrentAttribution(db, studentId, id, input.method, evidenceNote, me.id, now));
            (await logActivity("student", studentId, "acquisition", `Acquisition attribution recorded via ${input.touchpointType}. ${evidenceNote}`, me.id));
          }));
    revalidateGrowth();
    revalidatePath(`/app/students/${studentId}`);
    return { ok: true, id, updatedAt: now };
  } catch (error) {
    return actionError(error);
  }
}

export interface RecordStudentReferralInput {
  referrerPersonId: string;
  referredStudentId: string;
  channelId: string;
  campaignId?: string;
  contributorId?: string;
  evidenceNote: string;
}

export async function recordStudentReferral(input: RecordStudentReferralInput): Promise<GrowthActionResult> {
  const me = await requireStaff();
  try {
    const referrerPersonId = identifier(input?.referrerPersonId, "referrer");
    const referredStudentId = identifier(input?.referredStudentId, "referred student");
    const channelId = identifier(input?.channelId, "referral channel");
    const campaignId = optionalIdentifier(input?.campaignId, "campaign");
    const contributorId = optionalIdentifier(input?.contributorId, "contributor");
    const evidenceNote = cleanText(input?.evidenceNote, "Referral evidence", 1000, 10);
    const db = getDb();
    const referred = (await db.prepare("SELECT person_id FROM students WHERE id = ? AND enrollment_status = 'active'")
          .get(referredStudentId)) as unknown as { person_id: string | null } | undefined;
    if (!referred?.person_id) throw new GrowthActionError("The referred Student needs a canonical Person identity.");
    if (referred.person_id === referrerPersonId) throw new GrowthActionError("A person cannot refer themselves.");
    if (!(await db.prepare("SELECT 1 FROM people WHERE id = ?").get(referrerPersonId))) throw new GrowthActionError("Choose an existing referrer Person.");
    if (!(await db.prepare("SELECT 1 FROM growth_channels WHERE id = ? AND category = 'referral' AND status = 'active'").get(channelId))) {
      throw new GrowthActionError("Choose an active referral channel.");
    }
    if ((await db.prepare("SELECT 1 FROM student_referrals WHERE referred_person_id = ? AND voided_at IS NULL").get(referred.person_id))) {
      throw new GrowthActionError("This learner already has a current referral source. Void or reconcile that evidence before replacing it.");
    }
    const referralId = `srf-${randomUUID()}`;
    const touchpointId = `sat-${randomUUID()}`;
    const referralCode = `bow-${randomBytes(8).toString("hex")}`;
    const now = Date.now();
    const calendar = (await resolveEvidenceCalendar(db, { channelId, campaignId, contributorId, occurredAt: now }));
    (await transaction(db, async () => {
            (await db.prepare(
                      `INSERT INTO student_acquisition_touchpoints
          (id, person_id, student_id, channel_id, campaign_id, contributor_id, touchpoint_type,
           occurred_at, occurred_on, timezone, external_key, detail, recorded_by_user_id,
           voided_at, voided_by_user_id, void_reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'referral', ?, ?, ?, NULL, ?, ?, NULL, NULL, NULL, ?)`,
                    ).run(
                      touchpointId,
                      referred.person_id,
                      referredStudentId,
                      channelId,
                      campaignId,
                      contributorId,
                      now,
                      calendar.occurredOn,
                      calendar.timeZone,
                      evidenceNote,
                      me.id,
                      now,
                    ));
            (await db.prepare(
                      `INSERT INTO student_referrals
          (id, referrer_person_id, referred_person_id, referred_student_id, touchpoint_id, campaign_id,
           contributor_id, referral_code, submitted_at, notes, created_by_user_id,
           voided_at, voided_by_user_id, void_reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?)`,
                    ).run(referralId, referrerPersonId, referred.person_id, referredStudentId, touchpointId, campaignId, contributorId, referralCode, now, evidenceNote, me.id, now));
            (await replaceCurrentAttribution(db, referredStudentId, touchpointId, "referral", evidenceNote, me.id, now));
            (await logActivity("student", referredStudentId, "referral", `Referral ${referralCode} recorded. Success remains pending until finalized attendance proves participation.`, me.id));
            (await logActivity("person", referrerPersonId, "referral", `Referred Student ${referredStudentId}; success is derived from verified participation.`, me.id));
          }));
    revalidateGrowth();
    revalidatePath(`/app/students/${referredStudentId}`);
    return { ok: true, id: referralId, updatedAt: now };
  } catch (error) {
    return actionError(error);
  }
}

export interface ConfirmClassEnrollmentInput {
  enrollmentId: string;
  source: ConfirmationSource;
}

export async function confirmClassEnrollment(input: ConfirmClassEnrollmentInput): Promise<GrowthActionResult> {
  const me = await requireStaff();
  try {
    const enrollmentId = identifier(input?.enrollmentId, "Class enrollment");
    if (!isOneOf(CONFIRMATION_SOURCES, input?.source)) throw new GrowthActionError("Choose who confirmed this registration.");
    const db = getDb();
    const enrollment = (await db.prepare(
          "SELECT class_id, student_id, status, enrolled_at, confirmed_at FROM class_enrollments WHERE id = ?",
        ).get(enrollmentId)) as unknown as {
      class_id: string;
      student_id: string;
      status: string;
      enrolled_at: number;
      confirmed_at: number | null;
    } | undefined;
    if (!enrollment) throw new GrowthActionError("This Class enrollment no longer exists.");
    if (!["enrolled", "waitlisted"].includes(enrollment.status)) throw new GrowthActionError("Withdrawn enrollment cannot be confirmed.");
    if (enrollment.confirmed_at != null) throw new GrowthActionError("This enrollment already has immutable confirmation evidence.");
    const confirmedAt = Math.max(Date.now(), enrollment.enrolled_at);
    (await transaction(db, async () => {
            const result = (await db.prepare(
                    `UPDATE class_enrollments SET confirmed_at = ?, confirmation_source = ?
          WHERE id = ? AND confirmed_at IS NULL`,
                  ).run(confirmedAt, input.source, enrollmentId));
            if (Number(result.changes) !== 1) throw new GrowthActionError("This enrollment was confirmed elsewhere. Refresh before continuing.");
            (await logActivity("class", enrollment.class_id, "confirmation", `Registration ${enrollmentId} confirmed by ${input.source}.`, me.id));
            (await logActivity("student", enrollment.student_id, "confirmation", `Class enrollment ${enrollmentId} explicitly confirmed.`, me.id));
          }));
    revalidateGrowth();
    revalidatePath(`/app/classes/${enrollment.class_id}`);
    revalidatePath(`/app/students/${enrollment.student_id}`);
    return { ok: true, id: enrollmentId, updatedAt: confirmedAt };
  } catch (error) {
    return actionError(error);
  }
}

export interface RecordStudentProgramOutcomeInput {
  studentId: string;
  programId: string;
  outcomeType: OutcomeType;
  occurredOn: string;
  evidenceNote: string;
}

export async function recordStudentProgramOutcome(input: RecordStudentProgramOutcomeInput): Promise<GrowthActionResult> {
  const me = await requireStaff();
  try {
    const studentId = identifier(input?.studentId, "student");
    const programId = identifier(input?.programId, "Program");
    if (!isOneOf(OUTCOME_TYPES, input?.outcomeType)) throw new GrowthActionError("Choose a supported learner outcome.");
    const occurredOn = canonicalDate(input?.occurredOn, "Outcome date");
    if (occurredOn > canonicalDateInZone()) throw new GrowthActionError("An outcome cannot be recorded in the future.");
    const evidenceNote = cleanText(input?.evidenceNote, "Outcome evidence", 2000, 10);
    const db = getDb();
    if (!(await db.prepare(
          `SELECT 1 FROM class_enrollments ce JOIN classes c ON c.id = ce.class_id
        WHERE ce.student_id = ? AND c.program_id = ?`,
        ).get(studentId, programId))) {
      throw new GrowthActionError("This Student has no enrollment evidence in the selected Program.");
    }
    const id = `spo-${randomUUID()}`;
    const now = Date.now();
    (await transaction(db, async () => {
            (await db.prepare(
                      `INSERT INTO student_program_outcomes
          (id, student_id, program_id, outcome_type, occurred_on, evidence_note, recorded_by_user_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    ).run(id, studentId, programId, input.outcomeType, occurredOn, evidenceNote, me.id, now));
            (await logActivity("student", studentId, "program_outcome", `${input.outcomeType} · ${programId}. ${evidenceNote}`, me.id));
            (await logActivity("program", programId, "student_outcome", `${studentId} · ${input.outcomeType}.`, me.id));
          }));
    revalidateGrowth();
    revalidatePath(`/app/programs/${programId}`);
    revalidatePath(`/app/students/${studentId}`);
    return { ok: true, id, updatedAt: now };
  } catch (error) {
    return actionError(error);
  }
}

function slugify(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 88);
}

export interface CreateGrowthPlaybookInput {
  title: string;
  sourceCampaignId: string;
  ownerUserId: string;
  status: "draft" | "active";
  problem: string;
  play: string;
  evidence: string;
  adoptionNotes?: string;
}

export async function createGrowthPlaybook(input: CreateGrowthPlaybookInput): Promise<GrowthActionResult> {
  const me = await requireStaff();
  try {
    const title = cleanText(input?.title, "Playbook title", 180, 3);
    const sourceCampaignId = identifier(input?.sourceCampaignId, "source campaign");
    const ownerUserId = identifier(input?.ownerUserId, "playbook owner");
    if (input?.status !== "draft" && input?.status !== "active") throw new GrowthActionError("Choose draft or active status.");
    const problem = cleanText(input?.problem, "Problem statement", 2000, 20);
    const play = cleanText(input?.play, "Repeatable play", 5000, 20);
    const evidence = cleanText(input?.evidence, "Evidence", 3000, 20);
    const adoptionNotes = optionalText(input?.adoptionNotes, "Adoption notes", 3000);
    const db = getDb();
    if (!(await activeStaff(db, ownerUserId))) throw new GrowthActionError("Choose an active staff playbook owner.");
    if (!(await db.prepare(
          `SELECT 1 FROM growth_campaigns
        WHERE id = ? AND status = 'completed' AND result_value IS NOT NULL
          AND decision IS NOT NULL AND length(trim(COALESCE(learning,''))) >= 20`,
        ).get(sourceCampaignId))) {
      throw new GrowthActionError("A playbook needs a completed campaign with a result, decision, and reusable learning.");
    }
    const baseSlug = slugify(title);
    if (baseSlug.length < 3) throw new GrowthActionError("Use a playbook title that can form a readable URL slug.");
    let slug = baseSlug;
    if ((await db.prepare("SELECT 1 FROM growth_playbooks WHERE slug = ?").get(slug))) slug = `${baseSlug}-${randomBytes(3).toString("hex")}`;
    const id = `gpb-${randomUUID()}`;
    const now = Date.now();
    (await transaction(db, async () => {
            (await db.prepare(
                      `INSERT INTO growth_playbooks
          (id, slug, title, status, source_campaign_id, owner_user_id, problem, play,
           evidence, adoption_notes, published_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    ).run(id, slug, title, input.status, sourceCampaignId, ownerUserId, problem, play, evidence, adoptionNotes, input.status === "active" ? now : null, now, now));
            (await logActivity("growth_playbook", id, "created", `${title} promoted from campaign ${sourceCampaignId} as ${input.status}.`, me.id));
          }));
    revalidateGrowth();
    return { ok: true, id, updatedAt: now };
  } catch (error) {
    return actionError(error);
  }
}
