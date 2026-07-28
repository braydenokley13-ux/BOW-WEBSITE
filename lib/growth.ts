import { getDb } from "@/lib/db";
import { canonicalDateInZone } from "@/lib/timezone";
import {
  GROWTH_METRICS,
  type CampaignMetric,
  type GoalScopeType,
  type GrowthMetric,
} from "@/lib/growth-contracts";

export { CAMPAIGN_METRICS, GROWTH_METRICS } from "@/lib/growth-contracts";
export type { CampaignMetric, GoalScopeType, GrowthMetric } from "@/lib/growth-contracts";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface GrowthFunnel {
  windowLabel: string;
  startsOn: string;
  endsOn: string;
  leads: number;
  registrations: number;
  confirmations: number;
  verifiedParticipants: number;
  repeatParticipants: number;
  successfulReferrals: number;
  completions: number;
}

export interface GrowthCampaignSummary {
  id: string;
  name: string;
  channelId: string;
  channelName: string;
  ownerUserId: string | null;
  ownerName: string | null;
  scopeLabel: string;
  status: string;
  startsOn: string;
  endsOn: string;
  targetMetric: CampaignMetric;
  targetValue: number;
  budgetCents: number;
  spendCents: number;
  leads: number;
  registrations: number;
  confirmations: number;
  verifiedParticipants: number;
  repeatParticipants: number;
  successfulReferrals: number;
  resultValue: number | null;
  decision: string | null;
  learning: string | null;
  updatedAt: number;
}

export interface GrowthContributorSummary {
  id: string;
  personId: string;
  name: string;
  email: string;
  status: string;
  contributorUpdatedAt: number;
  assignmentId: string | null;
  assignmentStartsOn: string | null;
  assignmentUpdatedAt: number | null;
  role: string | null;
  managerName: string | null;
  scopeLabel: string;
  leads: number;
  registrations: number;
  verifiedParticipants: number;
  successfulReferrals: number;
  lastContributionAt: number | null;
}

export interface OperatingGoalSummary {
  id: string;
  scopeType: GoalScopeType;
  scopeId: string;
  scopeLabel: string;
  metric: GrowthMetric;
  targetValue: number;
  actualValue: number;
  startsOn: string;
  endsOn: string;
  ownerName: string;
  status: string;
  resultValue: number | null;
  closedAt: number | null;
  decisionNote: string | null;
  pace: "achieved" | "on_track" | "behind" | "not_started";
  updatedAt: number;
}

export interface MarketGrowthSummary {
  id: string;
  name: string;
  regionName: string | null;
  leaderName: string | null;
  attributableLeads: number;
  verifiedParticipants: number;
  upcomingClasses: number;
  upcomingSeats: number;
  registrations: number;
  waitlisted: number;
  availableSeats: number;
  imbalance: "demand" | "capacity" | "leadership" | "balanced";
}

export interface GrowthException {
  id: string;
  severity: "urgent" | "warning" | "info";
  title: string;
  detail: string;
  href: string;
  owner?: string | null;
}

export interface GrowthPlaybookSummary {
  id: string;
  slug: string;
  title: string;
  status: string;
  sourceCampaignName: string;
  ownerName: string;
  problem: string;
  play: string;
  evidence: string;
  publishedAt: number | null;
}

export interface GrowthOption {
  id: string;
  label: string;
  meta?: string;
}

export interface GrowthCommandCenter {
  funnel: GrowthFunnel;
  campaigns: GrowthCampaignSummary[];
  contributors: GrowthContributorSummary[];
  goals: OperatingGoalSummary[];
  markets: MarketGrowthSummary[];
  playbooks: GrowthPlaybookSummary[];
  exceptions: GrowthException[];
  options: {
    channels: GrowthOption[];
    staff: GrowthOption[];
    organizations: GrowthOption[];
    assignableContributors: GrowthOption[];
    assignedContributors: GrowthOption[];
    campaigns: GrowthOption[];
    activeCampaigns: GrowthOption[];
    assignments: GrowthOption[];
    regions: GrowthOption[];
    locations: GrowthOption[];
    completedCampaigns: GrowthOption[];
  };
}

export interface GrowthLeadershipSnapshot {
  exceptions: GrowthException[];
}

interface CountRow {
  count: number;
}

function numberValue(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function count(sql: string, ...parameters: Array<string | number>): Promise<number> {
  const row = (await getDb().prepare(sql).get(...parameters)) as unknown as CountRow | undefined;
  return numberValue(row?.count);
}

/**
 * Resolve a lead to the strongest learner identity that exists today without
 * guessing between siblings. This keeps a Person-only inquiry and the later
 * Student-linked touchpoint from becoming two leads after identity resolution.
 */
function canonicalLeadIdentitySql(alias: string): string {
  return `CASE
    WHEN ${alias}.student_id IS NOT NULL THEN 's:' || ${alias}.student_id
    WHEN EXISTS (SELECT 1 FROM students direct_student WHERE direct_student.person_id = ${alias}.person_id)
      THEN 's:' || (SELECT MIN(direct_student.id) FROM students direct_student WHERE direct_student.person_id = ${alias}.person_id)
    WHEN 1 = (SELECT COUNT(*) FROM students guarded_student WHERE guarded_student.guardian_person_id = ${alias}.person_id)
      THEN 's:' || (SELECT MIN(guarded_student.id) FROM students guarded_student WHERE guarded_student.guardian_person_id = ${alias}.person_id)
    ELSE 'p:' || ${alias}.person_id
  END`;
}

function sessionCalendarSql(alias: string): string {
  return `COALESCE(${alias}.session_on, date(${alias}.session_date / 1000, 'unixepoch'))`;
}

async function readFunnel(now: number): Promise<GrowthFunnel> {
  const endsOn = canonicalDateInZone(now);
  const startsOn = canonicalDateInZone(now - 89 * DAY_MS);
  const row = (await getDb().prepare(
      `WITH current_attribution AS (
       SELECT a.student_id, t.id AS touchpoint_id
         FROM student_acquisition_attributions a
         JOIN student_acquisition_touchpoints t ON t.id = a.touchpoint_id
        WHERE a.effective_to IS NULL AND t.voided_at IS NULL
          AND t.occurred_on BETWEEN ? AND ?
     ), verified AS (
       SELECT DISTINCT ar.student_id, c.program_id
         FROM attendance_records ar
         JOIN class_sessions cs ON cs.id = ar.session_id
         JOIN class_session_reports sr ON sr.session_id = cs.id AND sr.completed = 1
         JOIN classes c ON c.id = cs.class_id
        WHERE ar.status IN ('present','late')
          AND ${sessionCalendarSql("cs")} BETWEEN ? AND ?
     ), lifetime_programs AS (
       SELECT ar.student_id, COUNT(DISTINCT c.program_id) AS program_count
         FROM attendance_records ar
         JOIN class_sessions cs ON cs.id = ar.session_id
         JOIN class_session_reports sr ON sr.session_id = cs.id AND sr.completed = 1
         JOIN classes c ON c.id = cs.class_id
        WHERE ar.status IN ('present','late') AND c.program_id IS NOT NULL
        GROUP BY ar.student_id
     )
     SELECT
       (SELECT COUNT(DISTINCT ${canonicalLeadIdentitySql("t")})
          FROM student_acquisition_touchpoints t
         WHERE t.voided_at IS NULL
           AND t.occurred_on BETWEEN ? AND ?) AS leads,
       (SELECT COUNT(DISTINCT ca.student_id)
          FROM current_attribution ca
          JOIN class_enrollments ce ON ce.student_id = ca.student_id
         WHERE date(ce.enrolled_at / 1000, 'unixepoch') BETWEEN ? AND ?) AS registrations,
       (SELECT COUNT(DISTINCT ca.student_id)
          FROM current_attribution ca
          JOIN class_enrollments ce ON ce.student_id = ca.student_id
         WHERE ce.confirmed_at IS NOT NULL
           AND date(ce.confirmed_at / 1000, 'unixepoch') BETWEEN ? AND ?) AS confirmations,
       (SELECT COUNT(DISTINCT ca.student_id)
          FROM current_attribution ca JOIN verified v ON v.student_id = ca.student_id) AS verified_participants,
       (SELECT COUNT(DISTINCT ca.student_id)
          FROM current_attribution ca
          JOIN verified v ON v.student_id = ca.student_id
          JOIN lifetime_programs lp ON lp.student_id = ca.student_id AND lp.program_count >= 2) AS repeat_participants,
       (SELECT COUNT(DISTINCT r.id)
          FROM student_referrals r
          JOIN student_acquisition_touchpoints referral_touchpoint ON referral_touchpoint.id = r.touchpoint_id
          JOIN students s ON s.id = r.referred_student_id OR (r.referred_student_id IS NULL AND s.person_id = r.referred_person_id)
          JOIN verified v ON v.student_id = s.id
         WHERE r.voided_at IS NULL
           AND referral_touchpoint.voided_at IS NULL
           AND referral_touchpoint.occurred_on BETWEEN ? AND ?) AS successful_referrals,
       (SELECT COUNT(DISTINCT o.student_id || ':' || o.program_id)
          FROM student_program_outcomes o
         WHERE o.outcome_type IN ('completed','graduated') AND o.occurred_on BETWEEN ? AND ?) AS completions`,
    ).get(
      startsOn,
      endsOn,
      startsOn,
      endsOn,
      startsOn,
      endsOn,
      startsOn,
      endsOn,
      startsOn,
      endsOn,
      startsOn,
      endsOn,
      startsOn,
      endsOn,
    )) as unknown as Record<string, unknown>;
  return {
    windowLabel: "Trailing 90 days",
    startsOn,
    endsOn,
    leads: numberValue(row.leads),
    registrations: numberValue(row.registrations),
    confirmations: numberValue(row.confirmations),
    verifiedParticipants: numberValue(row.verified_participants),
    repeatParticipants: numberValue(row.repeat_participants),
    successfulReferrals: numberValue(row.successful_referrals),
    completions: numberValue(row.completions),
  };
}

async function readCampaigns(): Promise<GrowthCampaignSummary[]> {
  const rows = (await getDb().prepare(
      `SELECT c.id, c.name, c.channel_id, ch.name AS channel_name, c.owner_user_id, owner.name AS owner_name,
            COALESCE(l.name, r.name, 'Organization-wide') AS scope_label,
            c.status, c.starts_on, c.ends_on, c.target_metric, c.target_value,
            c.budget_cents, c.spend_cents, c.result_value, c.decision, c.learning, c.updated_at,
            COUNT(DISTINCT ${canonicalLeadIdentitySql("t")}) AS leads,
            COUNT(DISTINCT CASE WHEN EXISTS (
              SELECT 1 FROM class_enrollments ce
               WHERE ce.student_id = a.student_id
                 AND date(ce.enrolled_at / 1000, 'unixepoch') BETWEEN c.starts_on AND c.ends_on
            ) THEN a.student_id END) AS registrations,
            COUNT(DISTINCT CASE WHEN EXISTS (
              SELECT 1 FROM class_enrollments ce
               WHERE ce.student_id = a.student_id AND ce.confirmed_at IS NOT NULL
                 AND date(ce.confirmed_at / 1000, 'unixepoch') BETWEEN c.starts_on AND c.ends_on
            ) THEN a.student_id END) AS confirmations,
            COUNT(DISTINCT CASE WHEN EXISTS (
              SELECT 1 FROM attendance_records ar
              JOIN class_sessions cs ON cs.id = ar.session_id
              JOIN class_session_reports sr ON sr.session_id = cs.id AND sr.completed = 1
               WHERE ar.student_id = a.student_id AND ar.status IN ('present','late')
                 AND ${sessionCalendarSql("cs")} BETWEEN c.starts_on AND c.ends_on
            ) THEN a.student_id END) AS verified_participants,
            COUNT(DISTINCT CASE WHEN (
              SELECT COUNT(DISTINCT delivered.program_id)
                FROM attendance_records ar
                JOIN class_sessions cs ON cs.id = ar.session_id
                JOIN class_session_reports sr ON sr.session_id = cs.id AND sr.completed = 1
                JOIN classes delivered ON delivered.id = cs.class_id
               WHERE ar.student_id = a.student_id AND ar.status IN ('present','late')
            ) >= 2 THEN a.student_id END) AS repeat_participants,
            (SELECT COUNT(DISTINCT ref.id)
                FROM student_referrals ref
                JOIN student_acquisition_touchpoints referral_touchpoint ON referral_touchpoint.id = ref.touchpoint_id
               WHERE ref.campaign_id = c.id AND ref.voided_at IS NULL AND referral_touchpoint.voided_at IS NULL
                 AND referral_touchpoint.occurred_on BETWEEN c.starts_on AND c.ends_on
                 AND EXISTS (
                   SELECT 1 FROM students referred
                   JOIN attendance_records ar ON ar.student_id = referred.id AND ar.status IN ('present','late')
                   JOIN class_session_reports sr ON sr.session_id = ar.session_id AND sr.completed = 1
                    WHERE referred.id = ref.referred_student_id
                       OR (ref.referred_student_id IS NULL AND referred.person_id = ref.referred_person_id)
                 )) AS successful_referrals
       FROM growth_campaigns c
       JOIN growth_channels ch ON ch.id = c.channel_id
       LEFT JOIN users owner ON owner.id = c.owner_user_id
       LEFT JOIN operating_regions r ON r.id = c.region_id
       LEFT JOIN locations l ON l.id = c.location_id
       LEFT JOIN student_acquisition_touchpoints t ON t.campaign_id = c.id AND t.voided_at IS NULL
         AND t.occurred_on BETWEEN c.starts_on AND c.ends_on
       LEFT JOIN student_acquisition_attributions a ON a.touchpoint_id = t.id AND a.effective_to IS NULL
      GROUP BY c.id, ch.name, owner.name, l.name, r.name
      ORDER BY CASE c.status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 WHEN 'draft' THEN 2 WHEN 'completed' THEN 3 ELSE 4 END,
               c.ends_on, c.name`,
    ).all()) as unknown as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    channelId: String(row.channel_id),
    channelName: String(row.channel_name),
    ownerUserId: row.owner_user_id == null ? null : String(row.owner_user_id),
    ownerName: row.owner_name == null ? null : String(row.owner_name),
    scopeLabel: String(row.scope_label),
    status: String(row.status),
    startsOn: String(row.starts_on),
    endsOn: String(row.ends_on),
    targetMetric: String(row.target_metric) as CampaignMetric,
    targetValue: numberValue(row.target_value),
    budgetCents: numberValue(row.budget_cents),
    spendCents: numberValue(row.spend_cents),
    leads: numberValue(row.leads),
    registrations: numberValue(row.registrations),
    confirmations: numberValue(row.confirmations),
    verifiedParticipants: numberValue(row.verified_participants),
    repeatParticipants: numberValue(row.repeat_participants),
    successfulReferrals: numberValue(row.successful_referrals),
    resultValue: row.result_value == null ? null : numberValue(row.result_value),
    decision: row.decision == null ? null : String(row.decision),
    learning: row.learning == null ? null : String(row.learning),
    updatedAt: numberValue(row.updated_at),
  }));
}

async function readContributors(): Promise<GrowthContributorSummary[]> {
  const rows = (await getDb().prepare(
      `SELECT gc.id, gc.person_id, p.name, p.email, gc.status,
            gc.updated_at AS contributor_updated_at,
            ga.id AS assignment_id, ga.role, ga.starts_on AS assignment_starts_on,
            ga.updated_at AS assignment_updated_at,
            manager_person.name AS manager_name,
            CASE WHEN ga.id IS NULL THEN 'No current scope'
                 ELSE COALESCE(l.name, r.name, 'Organization-wide') END AS scope_label,
            COUNT(DISTINCT ${canonicalLeadIdentitySql("t")}) AS leads,
            COUNT(DISTINCT CASE WHEN EXISTS (
              SELECT 1 FROM class_enrollments ce WHERE ce.student_id = attr.student_id
            ) THEN attr.student_id END) AS registrations,
            COUNT(DISTINCT CASE WHEN EXISTS (
              SELECT 1 FROM attendance_records ar
              JOIN class_sessions cs ON cs.id = ar.session_id
              JOIN class_session_reports sr ON sr.session_id = cs.id AND sr.completed = 1
               WHERE ar.student_id = attr.student_id AND ar.status IN ('present','late')
            ) THEN attr.student_id END) AS verified_participants,
            COUNT(DISTINCT CASE WHEN EXISTS (
              SELECT 1 FROM students referred
              JOIN attendance_records ar ON ar.student_id = referred.id AND ar.status IN ('present','late')
              JOIN class_session_reports sr ON sr.session_id = ar.session_id AND sr.completed = 1
               WHERE referred.id = ref.referred_student_id
                  OR (ref.referred_student_id IS NULL AND referred.person_id = ref.referred_person_id)
            ) THEN ref.id END) AS successful_referrals,
            MAX(t.occurred_at) AS last_contribution_at
       FROM growth_contributors gc
       JOIN people p ON p.id = gc.person_id
       LEFT JOIN growth_assignments ga ON ga.contributor_id = gc.id AND ga.status = 'active' AND ga.ends_on IS NULL
       LEFT JOIN growth_assignments manager_assignment ON manager_assignment.id = ga.manager_assignment_id
       LEFT JOIN growth_contributors manager_contributor ON manager_contributor.id = manager_assignment.contributor_id
       LEFT JOIN people manager_person ON manager_person.id = manager_contributor.person_id
       LEFT JOIN operating_regions r ON r.id = ga.region_id
       LEFT JOIN locations l ON l.id = ga.location_id
       LEFT JOIN student_acquisition_touchpoints t ON t.contributor_id = gc.id AND t.voided_at IS NULL
       LEFT JOIN student_acquisition_attributions attr ON attr.touchpoint_id = t.id AND attr.effective_to IS NULL
       LEFT JOIN student_referrals ref ON ref.contributor_id = gc.id AND ref.voided_at IS NULL
      GROUP BY gc.id, ga.id, p.name, p.email, manager_person.name, l.name, r.name
      ORDER BY CASE gc.status WHEN 'active' THEN 0 WHEN 'candidate' THEN 1 WHEN 'paused' THEN 2 ELSE 3 END,
               CASE ga.role WHEN 'regional_lead' THEN 0 WHEN 'market_lead' THEN 1 WHEN 'growth_captain' THEN 2 ELSE 3 END,
               p.name`,
    ).all()) as unknown as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    id: String(row.id),
    personId: String(row.person_id),
    name: String(row.name),
    email: String(row.email),
    status: String(row.status),
    contributorUpdatedAt: numberValue(row.contributor_updated_at),
    assignmentId: row.assignment_id == null ? null : String(row.assignment_id),
    assignmentStartsOn: row.assignment_starts_on == null ? null : String(row.assignment_starts_on),
    assignmentUpdatedAt: row.assignment_updated_at == null ? null : numberValue(row.assignment_updated_at),
    role: row.role == null ? null : String(row.role),
    managerName: row.manager_name == null ? null : String(row.manager_name),
    scopeLabel: String(row.scope_label),
    leads: numberValue(row.leads),
    registrations: numberValue(row.registrations),
    verifiedParticipants: numberValue(row.verified_participants),
    successfulReferrals: numberValue(row.successful_referrals),
    lastContributionAt: row.last_contribution_at == null ? null : numberValue(row.last_contribution_at),
  }));
}

function touchpointScope(alias: string, scopeType: GoalScopeType, scopeId: string): { sql: string; parameters: string[] } {
  if (scopeType === "organization") return { sql: "1 = 1", parameters: [] };
  if (scopeType === "campaign") return { sql: `${alias}.campaign_id = ?`, parameters: [scopeId] };
  if (scopeType === "assignment") {
    return {
      sql: `EXISTS (
        SELECT 1 FROM growth_assignments scoped_assignment
         WHERE scoped_assignment.id = ? AND scoped_assignment.contributor_id = ${alias}.contributor_id
           AND scoped_assignment.starts_on <= ${alias}.occurred_on
           AND COALESCE(scoped_assignment.ends_on, '9999-12-31') >= ${alias}.occurred_on
      )`,
      parameters: [scopeId],
    };
  }
  if (scopeType === "region") {
    return {
      sql: `(
        EXISTS (
          SELECT 1 FROM growth_campaigns scoped_campaign
           WHERE scoped_campaign.id = ${alias}.campaign_id
             AND COALESCE(scoped_campaign.region_id, (
               SELECT region_id FROM locations WHERE id = scoped_campaign.location_id
             )) = ?
        )
        OR EXISTS (
          SELECT 1 FROM growth_assignments scoped_assignment
           WHERE scoped_assignment.contributor_id = ${alias}.contributor_id
             AND scoped_assignment.starts_on <= ${alias}.occurred_on
             AND COALESCE(scoped_assignment.ends_on, '9999-12-31') >= ${alias}.occurred_on
             AND COALESCE(scoped_assignment.region_id, (
               SELECT region_id FROM locations WHERE id = scoped_assignment.location_id
             )) = ?
        )
      )`,
      parameters: [scopeId, scopeId],
    };
  }
  if (scopeType === "location") {
    return {
      sql: `(
        EXISTS (
          SELECT 1 FROM growth_campaigns scoped_campaign
           WHERE scoped_campaign.id = ${alias}.campaign_id AND scoped_campaign.location_id = ?
        )
        OR EXISTS (
          SELECT 1 FROM growth_assignments scoped_assignment
           WHERE scoped_assignment.contributor_id = ${alias}.contributor_id
             AND scoped_assignment.starts_on <= ${alias}.occurred_on
             AND COALESCE(scoped_assignment.ends_on, '9999-12-31') >= ${alias}.occurred_on
             AND scoped_assignment.location_id = ?
        )
      )`,
      parameters: [scopeId, scopeId],
    };
  }
  return {
    sql: `EXISTS (
      SELECT 1 FROM student_acquisition_attributions scoped_attr
      JOIN class_enrollments scoped_enrollment ON scoped_enrollment.student_id = scoped_attr.student_id
      JOIN classes scoped_class ON scoped_class.id = scoped_enrollment.class_id
       WHERE scoped_attr.touchpoint_id = ${alias}.id AND scoped_attr.effective_to IS NULL AND scoped_class.program_id = ?
    )`,
    parameters: [scopeId],
  };
}

function classScope(alias: string, scopeType: GoalScopeType, scopeId: string): { sql: string; parameters: string[] } {
  if (scopeType === "organization") return { sql: "1 = 1", parameters: [] };
  if (scopeType === "program") return { sql: `${alias}.program_id = ?`, parameters: [scopeId] };
  if (scopeType === "location") return { sql: `${alias}.location_id = ?`, parameters: [scopeId] };
  if (scopeType === "region") {
    return {
      sql: `EXISTS (SELECT 1 FROM locations scoped_location WHERE scoped_location.id = ${alias}.location_id AND scoped_location.region_id = ?)`,
      parameters: [scopeId],
    };
  }
  if (scopeType === "campaign") {
    return {
      sql: `EXISTS (
        SELECT 1 FROM growth_campaigns scoped_campaign
         WHERE scoped_campaign.id = ?
           AND ((scoped_campaign.location_id IS NULL AND scoped_campaign.region_id IS NULL)
             OR scoped_campaign.location_id = ${alias}.location_id
             OR (scoped_campaign.location_id IS NULL AND scoped_campaign.region_id = (
               SELECT region_id FROM locations WHERE id = ${alias}.location_id
             )))
      )`,
      parameters: [scopeId],
    };
  }
  return {
    sql: `EXISTS (
      SELECT 1 FROM growth_assignments scoped_assignment
       WHERE scoped_assignment.id = ?
         AND (scoped_assignment.location_id = ${alias}.location_id
           OR (scoped_assignment.location_id IS NULL AND scoped_assignment.region_id = (
             SELECT region_id FROM locations WHERE id = ${alias}.location_id
           )))
    )`,
    parameters: [scopeId],
  };
}

async function metricActual(
  metric: GrowthMetric,
  scopeType: GoalScopeType,
  scopeId: string,
  startsOn: string,
  endsOn: string,
): Promise<number> {
  const tpScope = touchpointScope("t", scopeType, scopeId);
  if (metric === "leads") {
    return (await count(
          `SELECT COUNT(DISTINCT ${canonicalLeadIdentitySql("t")}) AS count
         FROM student_acquisition_touchpoints t
        WHERE t.voided_at IS NULL AND t.occurred_on BETWEEN ? AND ?
          AND (${tpScope.sql})`,
          startsOn,
          endsOn,
          ...tpScope.parameters,
        ));
  }
  if (["registrations", "confirmations", "verified_participants", "repeat_participants"].includes(metric)) {
    const evidence = metric === "registrations"
      ? `EXISTS (SELECT 1 FROM class_enrollments ce JOIN classes c ON c.id = ce.class_id
           WHERE ce.student_id = a.student_id AND date(ce.enrolled_at / 1000, 'unixepoch') BETWEEN ? AND ?
             ${scopeType === "program" ? "AND c.program_id = ?" : ""})`
      : metric === "confirmations"
        ? `EXISTS (SELECT 1 FROM class_enrollments ce JOIN classes c ON c.id = ce.class_id
             WHERE ce.student_id = a.student_id AND ce.confirmed_at IS NOT NULL
               AND date(ce.confirmed_at / 1000, 'unixepoch') BETWEEN ? AND ?
               ${scopeType === "program" ? "AND c.program_id = ?" : ""})`
        : metric === "verified_participants"
          ? `EXISTS (SELECT 1 FROM attendance_records ar
               JOIN class_sessions cs ON cs.id = ar.session_id
               JOIN class_session_reports sr ON sr.session_id = cs.id AND sr.completed = 1
               JOIN classes c ON c.id = cs.class_id
              WHERE ar.student_id = a.student_id AND ar.status IN ('present','late')
                AND ${sessionCalendarSql("cs")} BETWEEN ? AND ?
                ${scopeType === "program" ? "AND c.program_id = ?" : ""})`
          : `EXISTS (SELECT 1 FROM attendance_records ar
               JOIN class_sessions cs ON cs.id = ar.session_id
               JOIN class_session_reports sr ON sr.session_id = cs.id AND sr.completed = 1
              WHERE ar.student_id = a.student_id AND ar.status IN ('present','late')
                AND ${sessionCalendarSql("cs")} BETWEEN ? AND ?)
             AND (SELECT COUNT(DISTINCT delivered.program_id)
                    FROM attendance_records lifetime_ar
                    JOIN class_sessions lifetime_session ON lifetime_session.id = lifetime_ar.session_id
                    JOIN class_session_reports lifetime_report ON lifetime_report.session_id = lifetime_session.id AND lifetime_report.completed = 1
                    JOIN classes delivered ON delivered.id = lifetime_session.class_id
                   WHERE lifetime_ar.student_id = a.student_id AND lifetime_ar.status IN ('present','late')) >= 2`;
    const parameters: Array<string> = [startsOn, endsOn];
    if (scopeType === "program" && metric !== "repeat_participants") parameters.push(scopeId);
    parameters.push(...tpScope.parameters);
    return (await count(
          `SELECT COUNT(DISTINCT a.student_id) AS count
         FROM student_acquisition_attributions a
         JOIN student_acquisition_touchpoints t ON t.id = a.touchpoint_id
        WHERE a.effective_to IS NULL AND t.voided_at IS NULL
          AND ${evidence} AND (${tpScope.sql})`,
          ...parameters,
        ));
  }
  if (metric === "successful_referrals") {
    const referralScope = scopeType === "program"
      ? { sql: "1 = 1", parameters: [] as string[] }
      : touchpointScope("referral_touchpoint", scopeType, scopeId);
    const programSql = scopeType === "program" ? "AND delivered.program_id = ?" : "";
    const parameters = [startsOn, endsOn, ...(scopeType === "program" ? [scopeId] : []), ...referralScope.parameters];
    return (await count(
          `SELECT COUNT(DISTINCT r.id) AS count
         FROM student_referrals r
         JOIN student_acquisition_touchpoints referral_touchpoint ON referral_touchpoint.id = r.touchpoint_id
        WHERE r.voided_at IS NULL AND referral_touchpoint.voided_at IS NULL
          AND referral_touchpoint.occurred_on BETWEEN ? AND ?
          AND EXISTS (
            SELECT 1 FROM students referred
            JOIN attendance_records ar ON ar.student_id = referred.id AND ar.status IN ('present','late')
            JOIN class_session_reports sr ON sr.session_id = ar.session_id AND sr.completed = 1
            JOIN class_sessions cs ON cs.id = ar.session_id
            JOIN classes delivered ON delivered.id = cs.class_id
             WHERE (referred.id = r.referred_student_id OR (r.referred_student_id IS NULL AND referred.person_id = r.referred_person_id))
               ${programSql}
          ) AND (${referralScope.sql})`,
          ...parameters,
        ));
  }
  if (metric === "active_contributors") {
    let predicate = "1 = 1";
    const parameters: string[] = [];
    if (scopeType === "region") { predicate = "a.region_id = ?"; parameters.push(scopeId); }
    if (scopeType === "location") { predicate = "a.location_id = ?"; parameters.push(scopeId); }
    if (scopeType === "assignment") { predicate = "a.id = ?"; parameters.push(scopeId); }
    if (scopeType === "campaign") {
      predicate = "EXISTS (SELECT 1 FROM student_acquisition_touchpoints t WHERE t.contributor_id = a.contributor_id AND t.campaign_id = ? AND t.voided_at IS NULL)";
      parameters.push(scopeId);
    }
    if (scopeType === "program") {
      predicate = `EXISTS (
        SELECT 1 FROM student_acquisition_touchpoints t
        JOIN student_acquisition_attributions attr ON attr.touchpoint_id = t.id AND attr.effective_to IS NULL
        JOIN class_enrollments ce ON ce.student_id = attr.student_id
        JOIN classes c ON c.id = ce.class_id
         WHERE t.contributor_id = a.contributor_id AND t.voided_at IS NULL AND c.program_id = ?
      )`;
      parameters.push(scopeId);
    }
    return (await count(
          `SELECT COUNT(DISTINCT a.contributor_id) AS count
         FROM growth_assignments a
         JOIN growth_contributors c ON c.id = a.contributor_id
        WHERE a.status = 'active' AND a.ends_on IS NULL AND c.status = 'active' AND (${predicate})`,
          ...parameters,
        ));
  }

  const scopedClass = classScope("c", scopeType, scopeId);
  if (metric === "ready_instructors") {
    return (await count(
          `SELECT COUNT(DISTINCT i.id) AS count
         FROM instructors i
         JOIN class_instructors ci ON ci.instructor_id = i.id AND ci.removed_at IS NULL
         JOIN classes c ON c.id = ci.class_id
        WHERE i.stage IN ('eligible','active') AND i.eligibility_status = 'eligible'
          AND i.onboarding_status = 'complete' AND i.training_status = 'complete'
          AND (${scopedClass.sql})`,
          ...scopedClass.parameters,
        ));
  }
  return (await count(
      // GREATEST, not MAX: SQLite's two-argument scalar MAX() has no Postgres
      // equivalent, and toPostgresSql() does not translate it.
      `SELECT COALESCE(SUM(GREATEST(0, COALESCE(c.capacity, 0) - COALESCE(enrolled.count, 0))), 0) AS count
       FROM classes c
       LEFT JOIN (
         SELECT class_id, COUNT(*) AS count FROM class_enrollments WHERE status = 'enrolled' GROUP BY class_id
       ) enrolled ON enrolled.class_id = c.id
      WHERE c.status NOT IN ('completed','cancelled')
        AND EXISTS (
          SELECT 1 FROM class_sessions cs WHERE cs.class_id = c.id
            AND ${sessionCalendarSql("cs")} BETWEEN ? AND ?
        ) AND (${scopedClass.sql})`,
      startsOn,
      endsOn,
      ...scopedClass.parameters,
    ));
}

/**
 * Derive an operating result from canonical evidence. Mutations use this when
 * closing campaigns or goals so a leader never types a success number that
 * disagrees with registrations, finalized attendance, or referral evidence.
 */
export async function deriveGrowthMetricActual(
  metric: GrowthMetric,
  scopeType: GoalScopeType,
  scopeId: string,
  startsOn: string,
  endsOn: string,
): Promise<number> {
  if (!GROWTH_METRICS.includes(metric)) throw new Error("Unsupported growth metric.");
  return (await metricActual(metric, scopeType, scopeId, startsOn, endsOn));
}

async function scopeLabel(scopeType: GoalScopeType, scopeId: string): Promise<string> {
  const db = getDb();
  if (scopeType === "organization") {
    return String(((await db.prepare("SELECT name FROM organizations WHERE id = ?").get(scopeId)) as unknown as { name: string }).name);
  }
  if (scopeType === "region") return String(((await db.prepare("SELECT name FROM operating_regions WHERE id = ?").get(scopeId)) as unknown as { name: string }).name);
  if (scopeType === "location") return String(((await db.prepare("SELECT name FROM locations WHERE id = ?").get(scopeId)) as unknown as { name: string }).name);
  if (scopeType === "campaign") return String(((await db.prepare("SELECT name FROM growth_campaigns WHERE id = ?").get(scopeId)) as unknown as { name: string }).name);
  if (scopeType === "program") return String(((await db.prepare("SELECT name FROM programs WHERE id = ?").get(scopeId)) as unknown as { name: string }).name);
  const row = (await db.prepare(
      `SELECT p.name, a.role FROM growth_assignments a
     JOIN growth_contributors c ON c.id = a.contributor_id JOIN people p ON p.id = c.person_id WHERE a.id = ?`,
    ).get(scopeId)) as unknown as { name: string; role: string };
  return `${row.name} · ${row.role.replace(/_/g, " ")}`;
}

function goalPace(goal: { startsOn: string; endsOn: string; targetValue: number; actualValue: number }, now: number): OperatingGoalSummary["pace"] {
  if (goal.actualValue >= goal.targetValue) return "achieved";
  const startsAt = Date.parse(`${goal.startsOn}T00:00:00Z`);
  const endsAt = Date.parse(`${goal.endsOn}T23:59:59Z`);
  if (now < startsAt) return "not_started";
  const elapsed = Math.min(1, Math.max(0, (now - startsAt) / Math.max(DAY_MS, endsAt - startsAt)));
  const progress = goal.actualValue / goal.targetValue;
  return progress + 0.1 >= elapsed ? "on_track" : "behind";
}

async function readGoals(now: number): Promise<OperatingGoalSummary[]> {
  const rows = (await getDb().prepare(
      `SELECT g.*, owner.name AS owner_name
       FROM operating_goals g JOIN users owner ON owner.id = g.owner_user_id
      ORDER BY CASE g.status WHEN 'active' THEN 0 ELSE 1 END, g.ends_on, g.metric`,
    ).all()) as unknown as Array<Record<string, unknown>>;
  return (await Promise.all(rows.map(async (row) => {
      const scopeType = String(row.scope_type) as GoalScopeType;
      const metric = String(row.metric) as GrowthMetric;
      const targetValue = numberValue(row.target_value);
      const status = String(row.status);
      const resultValue = row.result_value == null ? null : numberValue(row.result_value);
      const actualValue = status === "active"
        ? (await metricActual(metric, scopeType, String(row.scope_id), String(row.starts_on), String(row.ends_on)))
        : resultValue ?? 0;
      const goal = {
        id: String(row.id),
        scopeType,
        scopeId: String(row.scope_id),
        scopeLabel: (await scopeLabel(scopeType, String(row.scope_id))),
        metric,
        targetValue,
        actualValue,
        startsOn: String(row.starts_on),
        endsOn: String(row.ends_on),
        ownerName: String(row.owner_name),
        status,
        resultValue,
        closedAt: row.closed_at == null ? null : numberValue(row.closed_at),
        decisionNote: row.decision_note == null ? null : String(row.decision_note),
        pace: "on_track" as OperatingGoalSummary["pace"],
        updatedAt: numberValue(row.updated_at),
      };
      goal.pace = goalPace(goal, now);
      return goal;
    })));
}

function locationTouchpointScopeSql(touchpointAlias: string, locationAlias: string): string {
  return `(
    EXISTS (
      SELECT 1 FROM growth_campaigns market_campaign
       WHERE market_campaign.id = ${touchpointAlias}.campaign_id
         AND market_campaign.location_id = ${locationAlias}.id
    )
    OR EXISTS (
      SELECT 1 FROM growth_assignments market_assignment
       WHERE market_assignment.contributor_id = ${touchpointAlias}.contributor_id
         AND market_assignment.location_id = ${locationAlias}.id
         AND market_assignment.starts_on <= ${touchpointAlias}.occurred_on
         AND COALESCE(market_assignment.ends_on, '9999-12-31') >= ${touchpointAlias}.occurred_on
    )
  )`;
}

async function readMarkets(now: number): Promise<MarketGrowthSummary[]> {
  const startsOn = canonicalDateInZone(now - 89 * DAY_MS);
  const endsOn = canonicalDateInZone(now);
  const nextNinetyDays = canonicalDateInZone(now + 90 * DAY_MS);
  const rows = (await getDb().prepare(
      `SELECT l.id, l.name, r.name AS region_name, leader.name AS leader_name,
            (SELECT COUNT(DISTINCT ${canonicalLeadIdentitySql("t")})
               FROM student_acquisition_touchpoints t
              WHERE t.voided_at IS NULL AND t.occurred_on BETWEEN ? AND ?
                AND ${locationTouchpointScopeSql("t", "l")}) AS attributable_leads,
            (SELECT COUNT(DISTINCT attr.student_id)
               FROM student_acquisition_touchpoints t
               JOIN student_acquisition_attributions attr ON attr.touchpoint_id = t.id AND attr.effective_to IS NULL
              WHERE t.voided_at IS NULL AND t.occurred_on BETWEEN ? AND ?
                AND ${locationTouchpointScopeSql("t", "l")}
                AND EXISTS (
                  SELECT 1 FROM attendance_records ar
                  JOIN class_sessions cs ON cs.id = ar.session_id
                  JOIN class_session_reports sr ON sr.session_id = cs.id AND sr.completed = 1
                   WHERE ar.student_id = attr.student_id AND ar.status IN ('present','late')
                     AND ${sessionCalendarSql("cs")} BETWEEN ? AND ?
                )) AS verified_participants,
            (SELECT COUNT(DISTINCT c.id) FROM classes c
              WHERE c.location_id = l.id AND c.status NOT IN ('completed','cancelled')
                AND EXISTS (SELECT 1 FROM class_sessions upcoming WHERE upcoming.class_id = c.id
                  AND ${sessionCalendarSql("upcoming")} BETWEEN ? AND ?)) AS upcoming_classes,
            (SELECT COALESCE(SUM(COALESCE(c.capacity, 0)), 0) FROM classes c
              WHERE c.location_id = l.id AND c.status NOT IN ('completed','cancelled')
                AND EXISTS (SELECT 1 FROM class_sessions upcoming WHERE upcoming.class_id = c.id
                  AND ${sessionCalendarSql("upcoming")} BETWEEN ? AND ?)) AS upcoming_seats,
            (SELECT COUNT(DISTINCT ce.id) FROM class_enrollments ce JOIN classes c ON c.id = ce.class_id
              WHERE c.location_id = l.id AND c.status NOT IN ('completed','cancelled') AND ce.status = 'enrolled'
                AND EXISTS (SELECT 1 FROM class_sessions upcoming WHERE upcoming.class_id = c.id
                  AND ${sessionCalendarSql("upcoming")} BETWEEN ? AND ?)) AS registrations,
            (SELECT COUNT(DISTINCT ce.id) FROM class_enrollments ce JOIN classes c ON c.id = ce.class_id
              WHERE c.location_id = l.id AND c.status NOT IN ('completed','cancelled') AND ce.status = 'waitlisted'
                AND EXISTS (SELECT 1 FROM class_sessions upcoming WHERE upcoming.class_id = c.id
                  AND ${sessionCalendarSql("upcoming")} BETWEEN ? AND ?)) AS waitlisted
       FROM locations l
       LEFT JOIN operating_regions r ON r.id = l.region_id
       LEFT JOIN users leader ON leader.id = l.primary_leader_user_id
      WHERE l.stage <> 'closed'
      ORDER BY CASE l.stage WHEN 'active' THEN 0 WHEN 'launching' THEN 1 ELSE 2 END, l.name`,
    ).all(
      startsOn,
      endsOn,
      startsOn,
      endsOn,
      startsOn,
      endsOn,
      endsOn,
      nextNinetyDays,
      endsOn,
      nextNinetyDays,
      endsOn,
      nextNinetyDays,
      endsOn,
      nextNinetyDays,
    )) as unknown as Array<Record<string, unknown>>;
  return rows.map((row) => {
    const upcomingSeats = numberValue(row.upcoming_seats);
    const registrations = numberValue(row.registrations);
    const waitlisted = numberValue(row.waitlisted);
    const attributableLeads = numberValue(row.attributable_leads);
    const availableSeats = Math.max(0, upcomingSeats - registrations);
    const imbalance: MarketGrowthSummary["imbalance"] = !row.leader_name
      ? "leadership"
      : waitlisted > 0 || attributableLeads > upcomingSeats
        ? "capacity"
        : availableSeats >= 10 && attributableLeads < Math.max(3, availableSeats / 2)
          ? "demand"
          : "balanced";
    return {
      id: String(row.id),
      name: String(row.name),
      regionName: row.region_name == null ? null : String(row.region_name),
      leaderName: row.leader_name == null ? null : String(row.leader_name),
      attributableLeads,
      verifiedParticipants: numberValue(row.verified_participants),
      upcomingClasses: numberValue(row.upcoming_classes),
      upcomingSeats,
      registrations,
      waitlisted,
      availableSeats,
      imbalance,
    };
  });
}

function readExceptions(
  campaigns: GrowthCampaignSummary[],
  contributors: GrowthContributorSummary[],
  goals: OperatingGoalSummary[],
  markets: MarketGrowthSummary[],
  now: number,
): GrowthException[] {
  const today = canonicalDateInZone(now);
  const exceptions: GrowthException[] = [];
  for (const campaign of campaigns) {
    if (campaign.status === "active" && campaign.endsOn < today) {
      exceptions.push({
        id: `campaign-expired-${campaign.id}`,
        severity: "urgent",
        title: `${campaign.name} needs a decision`,
        detail: `The campaign ended ${campaign.endsOn} but is still active. Record the result, learning, and scale / iterate / hold / stop decision.`,
        href: `/app/growth#campaign-${campaign.id}`,
        owner: campaign.ownerName,
      });
    } else if (campaign.status === "active" && campaign.spendCents > campaign.budgetCents && campaign.budgetCents > 0) {
      exceptions.push({
        id: `campaign-budget-${campaign.id}`,
        severity: "warning",
        title: `${campaign.name} is over budget`,
        detail: `Spend is $${(campaign.spendCents / 100).toLocaleString()} against a $${(campaign.budgetCents / 100).toLocaleString()} budget.`,
        href: `/app/growth#campaign-${campaign.id}`,
        owner: campaign.ownerName,
      });
    } else if (campaign.status === "active" && campaign.spendCents > 0 && campaign.verifiedParticipants === 0) {
      exceptions.push({
        id: `campaign-no-service-${campaign.id}`,
        severity: "warning",
        title: `${campaign.name} has spend but no verified participation`,
        detail: "Registrations do not count as service. Check attribution, delivery timing, or stop the tactic before adding spend.",
        href: `/app/growth#campaign-${campaign.id}`,
        owner: campaign.ownerName,
      });
    }
  }
  for (const contributor of contributors) {
    if (contributor.status === "active" && !contributor.assignmentId) {
      exceptions.push({
        id: `contributor-unassigned-${contributor.id}`,
        severity: "urgent",
        title: `${contributor.name} has no owned role`,
        detail: "An active contributor needs one explicit scope and reporting line; the founder cannot remain the implicit manager.",
        href: `/app/growth#contributor-${contributor.id}`,
        owner: null,
      });
    }
  }
  for (const goal of goals) {
    if (goal.status === "active" && goal.pace === "behind") {
      exceptions.push({
        id: `goal-behind-${goal.id}`,
        severity: "warning",
        title: `${goal.scopeLabel} is behind on ${goal.metric.replace(/_/g, " ")}`,
        detail: `${goal.actualValue.toLocaleString()} of ${goal.targetValue.toLocaleString()} achieved; the window ends ${goal.endsOn}.`,
        href: "/app/growth#goals",
        owner: goal.ownerName,
      });
    }
  }
  for (const market of markets) {
    if (market.imbalance === "leadership") {
      exceptions.push({
        id: `market-leader-${market.id}`,
        severity: "urgent",
        title: `${market.name} has no accountable location leader`,
        detail: "Assign leadership before scaling demand or delivery in this market.",
        href: `/app/locations/${market.id}`,
        owner: null,
      });
    } else if (market.waitlisted > 0) {
      exceptions.push({
        id: `market-waitlist-${market.id}`,
        severity: "warning",
        title: `${market.name} has unmet demand`,
        detail: `${market.waitlisted} learner${market.waitlisted === 1 ? " is" : "s are"} waitlisted while ${market.availableSeats} upcoming seats remain attributable.`,
        href: `/app/locations/${market.id}`,
        owner: market.leaderName,
      });
    } else if (market.imbalance === "demand") {
      exceptions.push({
        id: `market-demand-${market.id}`,
        severity: "info",
        title: `${market.name} has unused near-term capacity`,
        detail: `${market.availableSeats} upcoming seats are open against ${market.attributableLeads} attributable leads in the last 90 days.`,
        href: `/app/locations/${market.id}`,
        owner: market.leaderName,
      });
    }
  }
  const severityRank = { urgent: 0, warning: 1, info: 2 } as const;
  return exceptions.sort((left, right) => severityRank[left.severity] - severityRank[right.severity] || left.title.localeCompare(right.title));
}

async function readPlaybooks(): Promise<GrowthPlaybookSummary[]> {
  const rows = (await getDb().prepare(
      `SELECT p.id, p.slug, p.title, p.status, campaign.name AS source_campaign_name,
            owner.name AS owner_name, p.problem, p.play, p.evidence, p.published_at
       FROM growth_playbooks p
       JOIN growth_campaigns campaign ON campaign.id = p.source_campaign_id
       JOIN users owner ON owner.id = p.owner_user_id
      ORDER BY CASE p.status WHEN 'active' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END,
               p.published_at DESC, p.title`,
    ).all()) as unknown as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    status: String(row.status),
    sourceCampaignName: String(row.source_campaign_name),
    ownerName: String(row.owner_name),
    problem: String(row.problem),
    play: String(row.play),
    evidence: String(row.evidence),
    publishedAt: row.published_at == null ? null : numberValue(row.published_at),
  }));
}

async function readOptions(): Promise<GrowthCommandCenter["options"]> {
  const db = getDb();
  const mapOptions = (rows: Array<Record<string, unknown>>): GrowthOption[] => rows.map((row) => ({
    id: String(row.id),
    label: String(row.label),
    meta: row.meta == null ? undefined : String(row.meta),
  }));
  return {
    channels: mapOptions((await db.prepare("SELECT id, name AS label, category AS meta FROM growth_channels WHERE status = 'active' ORDER BY name").all()) as unknown as Array<Record<string, unknown>>),
    staff: mapOptions((await db.prepare("SELECT id, name AS label, role AS meta FROM users WHERE status = 'active' AND role IN ('admin','growth') ORDER BY name").all()) as unknown as Array<Record<string, unknown>>),
    organizations: mapOptions((await db.prepare("SELECT id, name AS label, type AS meta FROM organizations WHERE status = 'active' ORDER BY CASE WHEN id = 'org-bow' THEN 0 ELSE 1 END, name").all()) as unknown as Array<Record<string, unknown>>),
    assignableContributors: mapOptions((await db.prepare(`SELECT c.id, p.name AS label, c.status AS meta
      FROM growth_contributors c JOIN people p ON p.id = c.person_id
      WHERE c.status IN ('candidate','active')
        AND NOT EXISTS (SELECT 1 FROM growth_assignments a WHERE a.contributor_id = c.id AND a.status = 'active' AND a.ends_on IS NULL)
      ORDER BY p.name`).all()) as unknown as Array<Record<string, unknown>>),
    assignedContributors: mapOptions((await db.prepare(`SELECT c.id, p.name AS label,
      replace(a.role, '_', ' ') || ' · ' || COALESCE(l.name, r.name, 'Organization-wide') AS meta
      FROM growth_contributors c JOIN people p ON p.id = c.person_id
      JOIN growth_assignments a ON a.contributor_id = c.id AND a.status = 'active' AND a.ends_on IS NULL
      LEFT JOIN locations l ON l.id = a.location_id LEFT JOIN operating_regions r ON r.id = a.region_id
      WHERE c.status = 'active' ORDER BY p.name`).all()) as unknown as Array<Record<string, unknown>>),
    campaigns: mapOptions((await db.prepare("SELECT id, name AS label, status AS meta FROM growth_campaigns WHERE status NOT IN ('cancelled') ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'draft' THEN 1 WHEN 'paused' THEN 2 ELSE 3 END, name").all()) as unknown as Array<Record<string, unknown>>),
    activeCampaigns: mapOptions((await db.prepare("SELECT id, name AS label, status AS meta FROM growth_campaigns WHERE status = 'active' ORDER BY ends_on, name").all()) as unknown as Array<Record<string, unknown>>),
    assignments: mapOptions((await db.prepare(`SELECT a.id, p.name || ' · ' || replace(a.role, '_', ' ') AS label,
      COALESCE(l.name, r.name, 'Organization-wide') AS meta FROM growth_assignments a
      JOIN growth_contributors c ON c.id = a.contributor_id JOIN people p ON p.id = c.person_id
      LEFT JOIN locations l ON l.id = a.location_id LEFT JOIN operating_regions r ON r.id = a.region_id
      WHERE a.status = 'active' AND a.ends_on IS NULL ORDER BY p.name`).all()) as unknown as Array<Record<string, unknown>>),
    regions: mapOptions((await db.prepare("SELECT id, name AS label, stage AS meta FROM operating_regions WHERE stage <> 'closed' ORDER BY name").all()) as unknown as Array<Record<string, unknown>>),
    locations: mapOptions((await db.prepare("SELECT id, name AS label, COALESCE(city || ', ' || state, stage) AS meta FROM locations WHERE stage <> 'closed' ORDER BY name").all()) as unknown as Array<Record<string, unknown>>),
    completedCampaigns: mapOptions((await db.prepare("SELECT id, name AS label, decision AS meta FROM growth_campaigns WHERE status = 'completed' ORDER BY ends_on DESC, name").all()) as unknown as Array<Record<string, unknown>>),
  };
}

export async function getGrowthCommandCenter(now = Date.now()): Promise<GrowthCommandCenter> {
  const funnel = (await readFunnel(now));
  const campaigns = (await readCampaigns());
  const contributors = (await readContributors());
  const goals = (await readGoals(now));
  const markets = (await readMarkets(now));
  const playbooks = (await readPlaybooks());
  return {
    funnel,
    campaigns,
    contributors,
    goals,
    markets,
    playbooks,
    exceptions: readExceptions(campaigns, contributors, goals, markets, now),
    options: (await readOptions()),
  };
}

/**
 * Founder Home only needs escalations. Keep large form-option lists, the
 * funnel, and playbook payload in the Growth workspace instead of rebuilding
 * and serializing them on every leadership landing-page request.
 */
export async function getGrowthLeadershipSnapshot(now = Date.now()): Promise<GrowthLeadershipSnapshot> {
  const campaigns = (await readCampaigns());
  const contributors = (await readContributors());
  const goals = (await readGoals(now));
  const markets = (await readMarkets(now));
  return { exceptions: readExceptions(campaigns, contributors, goals, markets, now) };
}
