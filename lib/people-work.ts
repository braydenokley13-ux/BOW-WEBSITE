import "server-only";

import { getDb } from "@/lib/db";

export type ApplicationLifecycle =
  | "applied"
  | "screening"
  | "interviewing"
  | "decision"
  | "accepted"
  | "rejected"
  | "withdrawn";

export interface OpeningQuestion {
  key: string;
  label: string;
  type: "text" | "textarea" | "select";
  required: boolean;
  options?: string[];
}

export interface PublicOpening {
  openingId: string;
  openingVersionId: string;
  processVersionId: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  responsibilities: string[];
  timeCommitment: string;
  engagementTypes: string[];
  eligibility: string[];
  questions: OpeningQuestion[];
  stages: { id: string; key: string; title: string; type: string; ordinal: number }[];
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function getPublicOpening(slug: string): Promise<PublicOpening | null> {
  const db = getDb();
  const row = (await db.prepare(
    `SELECT o.id AS opening_id, o.slug, ov.*, q.questions
       FROM openings o
       JOIN opening_versions ov ON ov.id = o.current_version_id
       LEFT JOIN question_set_versions q ON q.id = ov.application_question_set_version_id
      WHERE o.slug = ? AND o.status = 'published' AND ov.status = 'published'`,
  ).get(slug)) as Record<string, unknown> | undefined;
  if (!row) return null;
  const stages = (await db.prepare(
    `SELECT id, stage_key, title, stage_type, ordinal
       FROM hiring_stage_versions WHERE process_version_id = ? ORDER BY ordinal`,
  ).all(row.process_version_id)) as Record<string, unknown>[];
  return {
    openingId: String(row.opening_id),
    openingVersionId: String(row.id),
    processVersionId: String(row.process_version_id),
    slug: String(row.slug),
    title: String(row.title),
    summary: String(row.summary),
    description: String(row.description),
    responsibilities: parseJson<string[]>(row.responsibilities, []),
    timeCommitment: String(row.time_commitment),
    engagementTypes: parseJson<string[]>(row.engagement_types, []),
    eligibility: parseJson<string[]>(row.eligibility, []),
    questions: parseJson<OpeningQuestion[]>(row.questions, []),
    stages: stages.map((stage) => ({
      id: String(stage.id),
      key: String(stage.stage_key),
      title: String(stage.title),
      type: String(stage.stage_type),
      ordinal: Number(stage.ordinal),
    })),
  };
}

export interface HiringAttentionItem {
  id: string;
  personName: string;
  openingTitle: string;
  stageTitle: string;
  ownerName: string | null;
  reason: string;
  dueAt: number | null;
  tone: "negative" | "warning" | "info";
}

export interface HiringCandidateRow {
  id: string;
  personName: string;
  email: string;
  openingTitle: string;
  stageTitle: string;
  lifecycle: ApplicationLifecycle;
  ownerName: string | null;
  nextAction: string | null;
  updatedAt: number;
}

export interface HiringCommandData {
  attention: HiringAttentionItem[];
  candidates: HiringCandidateRow[];
  requisitions: {
    id: string;
    title: string;
    target: number;
    filled: number;
    pipeline: number;
    neededBy: string | null;
    ownerName: string | null;
  }[];
  openings: { id: string; slug: string; title: string; status: string; version: number }[];
  roles: { id: string; title: string; unitName: string; status: string }[];
  processes: { id: string; name: string; latestVersion: number; status: string }[];
}

export async function getHiringCommandData(now = Date.now()): Promise<HiringCommandData> {
  const db = getDb();
  const candidateRows = (await db.prepare(
    `SELECT a.*, p.name AS person_name, p.email, ov.title AS opening_title,
            hsv.title AS stage_title, owner.name AS owner_name
       FROM applications a
       JOIN people p ON p.id = a.person_id
       JOIN opening_versions ov ON ov.id = a.opening_version_id
       JOIN hiring_stage_versions hsv ON hsv.id = a.current_stage_version_id
       LEFT JOIN users owner ON owner.id = COALESCE(a.next_action_owner_user_id, a.owner_user_id)
      ORDER BY CASE WHEN a.lifecycle_status IN ('accepted','rejected','withdrawn') THEN 1 ELSE 0 END,
               COALESCE(a.next_action_due_at, a.waiting_expected_at, a.updated_at), a.created_at`,
  ).all()) as Record<string, unknown>[];
  const candidates: HiringCandidateRow[] = candidateRows.map((row) => ({
    id: String(row.id),
    personName: String(row.person_name),
    email: String(row.email),
    openingTitle: String(row.opening_title),
    stageTitle: String(row.stage_title),
    lifecycle: row.lifecycle_status as ApplicationLifecycle,
    ownerName: row.owner_name ? String(row.owner_name) : null,
    nextAction: row.next_action ? String(row.next_action) : row.waiting_on ? `Waiting on ${String(row.waiting_on)}` : null,
    updatedAt: Number(row.updated_at),
  }));
  const attention: HiringAttentionItem[] = candidateRows
    .filter((row) => !["accepted", "rejected", "withdrawn"].includes(String(row.lifecycle_status)))
    .map((row) => {
      const dueAt = row.next_action_due_at != null
        ? Number(row.next_action_due_at)
        : row.waiting_expected_at != null ? Number(row.waiting_expected_at) : null;
      const missing = !row.next_action && !row.waiting_on;
      const overdue = dueAt != null && dueAt < now;
      const dueSoon = dueAt != null && dueAt < now + 24 * 60 * 60 * 1000;
      return {
        id: String(row.id),
        personName: String(row.person_name),
        openingTitle: String(row.opening_title),
        stageTitle: String(row.stage_title),
        ownerName: row.owner_name ? String(row.owner_name) : null,
        reason: missing
          ? "No next action or waiting state"
          : overdue
            ? `${String(row.next_action ?? row.waiting_on)} is overdue`
            : dueSoon
              ? `${String(row.next_action ?? row.waiting_on)} is due within 24 hours`
              : String(row.next_action ?? `Waiting on ${String(row.waiting_on)}`),
        dueAt,
        tone: missing || overdue ? "negative" as const : dueSoon ? "warning" as const : "info" as const,
      };
    })
    .filter((item) => item.tone !== "info" || /schedule|decision|scorecard|review|waiting/i.test(item.reason));
  const failedMessages = (await db.prepare(
    `SELECT c.application_id AS id, p.name AS person_name, ov.title AS opening_title, hsv.title AS stage_title,
            owner.name AS owner_name, c.created_at
       FROM candidate_communications c
       JOIN applications a ON a.id = c.application_id
       JOIN people p ON p.id = a.person_id
       JOIN opening_versions ov ON ov.id = a.opening_version_id
       JOIN hiring_stage_versions hsv ON hsv.id = a.current_stage_version_id
       LEFT JOIN users owner ON owner.id = COALESCE(a.next_action_owner_user_id, a.owner_user_id)
      WHERE c.status = 'failed' ORDER BY c.created_at`,
  ).all()) as Record<string, unknown>[];
  for (const row of failedMessages) attention.unshift({
    id: String(row.id), personName: String(row.person_name), openingTitle: String(row.opening_title),
    stageTitle: String(row.stage_title), ownerName: row.owner_name ? String(row.owner_name) : null,
    reason: "Candidate communication failed and needs a safe retry", dueAt: Number(row.created_at), tone: "negative",
  });

  const requisitions = ((await db.prepare(
    `SELECT r.id, r.title, r.target_headcount, r.needed_by, u.name AS owner_name,
            COUNT(DISTINCT a.id) AS pipeline,
            COUNT(DISTINCT ra.id) FILTER (WHERE ra.status IN ('activating','active')) AS filled
       FROM hiring_requisitions r
       LEFT JOIN users u ON u.id = r.hiring_owner_user_id
       LEFT JOIN openings o ON o.requisition_id = r.id
       LEFT JOIN applications a ON a.opening_id = o.id AND a.lifecycle_status NOT IN ('rejected','withdrawn')
       LEFT JOIN role_assignments ra ON ra.role_id = r.role_id AND ra.organization_unit_id = r.organization_unit_id
      GROUP BY r.id, r.title, r.target_headcount, r.needed_by, u.name
      ORDER BY r.created_at DESC`,
  ).all()) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id), title: String(row.title), target: Number(row.target_headcount),
    filled: Number(row.filled), pipeline: Number(row.pipeline), neededBy: row.needed_by ? String(row.needed_by) : null,
    ownerName: row.owner_name ? String(row.owner_name) : null,
  }));
  const openings = ((await db.prepare(
    `SELECT o.id, o.slug, o.status, ov.title, ov.version FROM openings o
       JOIN opening_versions ov ON ov.id = o.current_version_id ORDER BY o.created_at DESC`,
  ).all()) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id), slug: String(row.slug), title: String(row.title), status: String(row.status), version: Number(row.version),
  }));
  const roles = ((await db.prepare(
    `SELECT r.id, r.title, r.status, ou.name AS unit_name FROM org_roles r
       JOIN organization_units ou ON ou.id = r.organization_unit_id ORDER BY r.title`,
  ).all()) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id), title: String(row.title), unitName: String(row.unit_name), status: String(row.status),
  }));
  const processes = ((await db.prepare(
    `SELECT hp.id, hp.name, hp.status, MAX(hpv.version) AS latest_version
       FROM hiring_processes hp LEFT JOIN hiring_process_versions hpv ON hpv.hiring_process_id = hp.id
      GROUP BY hp.id, hp.name, hp.status ORDER BY hp.name`,
  ).all()) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id), name: String(row.name), status: String(row.status), latestVersion: Number(row.latest_version ?? 0),
  }));
  return { attention, candidates, requisitions, openings, roles, processes };
}

export async function getApplicationCockpit(id: string): Promise<{
  application: Record<string, unknown> & { answers: Record<string, string> };
  stages: Record<string, unknown>[];
  events: Record<string, unknown>[];
  interviews: Record<string, unknown>[];
  evaluations: Array<Record<string, unknown> & { responses: Record<string, string> }>;
  communications: Record<string, unknown>[];
} | null> {
  const db = getDb();
  const application = (await db.prepare(
    `SELECT a.*, p.name, p.email, p.phone, p.identity_status, ov.title AS opening_title,
            ov.version AS opening_version, hsv.title AS stage_title, hpv.version AS process_version,
            owner.name AS owner_name, next_owner.name AS next_owner_name
       FROM applications a
       JOIN people p ON p.id = a.person_id
       JOIN opening_versions ov ON ov.id = a.opening_version_id
       JOIN hiring_stage_versions hsv ON hsv.id = a.current_stage_version_id
       JOIN hiring_process_versions hpv ON hpv.id = a.process_version_id
       LEFT JOIN users owner ON owner.id = a.owner_user_id
       LEFT JOIN users next_owner ON next_owner.id = a.next_action_owner_user_id
      WHERE a.id = ?`,
  ).get(id)) as Record<string, unknown> | undefined;
  if (!application) return null;
  const stages = (await db.prepare(
    "SELECT * FROM hiring_stage_versions WHERE process_version_id = ? ORDER BY ordinal",
  ).all(application.process_version_id)) as Record<string, unknown>[];
  const events = (await db.prepare(
    `SELECT e.*, f.title AS from_title, t.title AS to_title, u.name AS actor_name
       FROM application_stage_events e
       LEFT JOIN hiring_stage_versions f ON f.id = e.from_stage_version_id
       JOIN hiring_stage_versions t ON t.id = e.to_stage_version_id
       LEFT JOIN users u ON u.id = e.actor_user_id
      WHERE e.application_id = ? ORDER BY e.created_at DESC`,
  ).all(id)) as Record<string, unknown>[];
  const interviews = (await db.prepare(
    `SELECT ie.*, hsv.title AS stage_title FROM interview_events ie
       JOIN hiring_stage_versions hsv ON hsv.id = ie.stage_version_id
      WHERE ie.application_id = ? ORDER BY COALESCE(ie.scheduled_at, ie.created_at) DESC`,
  ).all(id)) as Record<string, unknown>[];
  const evaluations = (await db.prepare(
    `SELECT e.*, hsv.title AS stage_title, sc.name AS scorecard_name, u.name AS evaluator_name
       FROM evaluations e JOIN hiring_stage_versions hsv ON hsv.id = e.stage_version_id
       JOIN scorecard_versions sc ON sc.id = e.scorecard_version_id
       JOIN users u ON u.id = e.evaluator_user_id
      WHERE e.application_id = ? ORDER BY e.submitted_at DESC`,
  ).all(id)) as Record<string, unknown>[];
  const communications = (await db.prepare(
    "SELECT * FROM candidate_communications WHERE application_id = ? ORDER BY created_at DESC",
  ).all(id)) as Record<string, unknown>[];
  return {
    application: { ...application, answers: parseJson<Record<string, string>>(application.answers, {}) } as Record<string, unknown> & { answers: Record<string, string> },
    stages,
    events,
    interviews,
    evaluations: evaluations.map((row) => ({ ...row, responses: parseJson<Record<string, string>>(row.responses, {}) }) as Record<string, unknown> & { responses: Record<string, string> }),
    communications,
  };
}
