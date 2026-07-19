import type { DatabaseSync } from "node:sqlite";

export const OPERATING_SYSTEM_V7_GROWTH_MIGRATION_ID =
  "2026-07-19-bow-operating-system-v7-growth-evidence";

export const GROWTH_CHANNELS = [
  { id: "gch-student-referral", code: "student_referral", name: "Student or family referral", category: "referral", description: "A current learner or family directly introduced the prospective learner." },
  { id: "gch-instructor-referral", code: "instructor_referral", name: "Instructor referral", category: "referral", description: "A BOW instructor directly introduced the prospective learner." },
  { id: "gch-ambassador-outreach", code: "ambassador_outreach", name: "Ambassador outreach", category: "community", description: "A named growth-network contributor created the relationship." },
  { id: "gch-school-distribution", code: "school_distribution", name: "School distribution", category: "partner", description: "A school or partner distributed the opportunity to its community." },
  { id: "gch-local-event", code: "local_event", name: "Local event", category: "community", description: "An in-person event or community activation created the relationship." },
  { id: "gch-organic-social", code: "organic_social", name: "Organic social", category: "owned", description: "Unpaid BOW social or creator content created the relationship." },
  { id: "gch-paid-acquisition", code: "paid_acquisition", name: "Paid acquisition", category: "paid", description: "Paid media or a paid distribution partner created the relationship." },
  { id: "gch-direct-inquiry", code: "direct_inquiry", name: "Direct inquiry", category: "owned", description: "The prospective learner or family contacted BOW without another known source." },
  { id: "gch-partner-referral", code: "partner_referral", name: "Partner referral", category: "partner", description: "A partner organization directly introduced the prospective learner." },
  { id: "gch-alumni-family", code: "alumni_family", name: "Alumni or returning family", category: "referral", description: "A BOW alumnus or returning family initiated a new relationship." },
] as const;

const CHANNEL_CATEGORIES = "'referral','community','partner','owned','paid'";
const CAMPAIGN_STATUSES = "'draft','active','paused','completed','cancelled'";
const CAMPAIGN_DECISIONS = "'scale','iterate','hold','stop'";
const CAMPAIGN_METRICS = "'leads','registrations','confirmations','verified_participants','repeat_participants','successful_referrals'";
const GROWTH_METRICS = "'leads','registrations','confirmations','verified_participants','repeat_participants','successful_referrals','active_contributors','ready_instructors','available_seats'";
const CONTRIBUTOR_STATUSES = "'candidate','active','paused','alumni'";
const ASSIGNMENT_ROLES = "'ambassador','growth_captain','market_lead','regional_lead'";
const ASSIGNMENT_STATUSES = "'active','completed','cancelled'";
const GOAL_SCOPE_TYPES = "'organization','region','location','campaign','assignment','program'";
const GOAL_STATUSES = "'active','achieved','missed','cancelled'";
const TOUCHPOINT_TYPES = "'inquiry','referral','outreach','event','partner_distribution','organic_social','paid','other'";
const ATTRIBUTION_METHODS = "'direct','self_reported','referral','imported','operator_verified'";
const OUTCOME_TYPES = "'completed','progressed','graduated','withdrawn','transferred'";
const PLAYBOOK_STATUSES = "'draft','active','retired'";
const CONFIRMATION_SOURCES = "'student','guardian','partner','staff','imported'";

const OPERATING_SYSTEM_V8_GROWTH_HARDENING_MIGRATION_ID =
  "2026-07-19-bow-operating-system-v8-growth-lifecycle-hardening";
const OPERATING_SYSTEM_V10_GROWTH_LIFECYCLE_MIGRATION_ID =
  "2026-07-19-bow-operating-system-v10-contributor-lifecycle";

function invalidCampaignLifecycleEvidence(alias: string): string {
  return `(
    (${alias}.status IN ('draft','active','paused') AND (
      ${alias}.result_value IS NOT NULL OR ${alias}.decision IS NOT NULL OR ${alias}.learning IS NOT NULL
    ))
    OR (${alias}.status = 'completed' AND (
      ${alias}.result_value IS NULL OR ${alias}.result_value < 0
      OR ${alias}.decision IS NULL OR length(trim(COALESCE(${alias}.learning,''))) < 20
    ))
    OR (${alias}.status = 'cancelled' AND (
      ${alias}.result_value IS NULL OR ${alias}.result_value < 0
      OR ${alias}.decision IS NOT 'stop' OR length(trim(COALESCE(${alias}.learning,''))) < 10
    ))
  )`;
}

type SqlRow = Record<string, unknown>;

function normalizeSql(value: string | null): string {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function assertNoRow(db: DatabaseSync, label: string, sql: string): void {
  const row = db.prepare(sql).get() as unknown as SqlRow | undefined;
  if (row) throw new Error(`[bow:v7] ${label}: ${JSON.stringify(row)}.`);
}

function assertV7Columns(db: DatabaseSync): void {
  const required: [string, string[]][] = [
    ["class_enrollments", ["confirmed_at", "confirmation_source"]],
    ["growth_channels", ["id", "code", "category", "status"]],
    ["growth_campaigns", ["channel_id", "hypothesis", "target_metric", "budget_cents", "spend_cents", "decision", "learning"]],
    ["growth_contributors", ["person_id", "status", "joined_on", "exited_on"]],
    ["growth_assignments", ["contributor_id", "role", "manager_assignment_id", "region_id", "location_id", "starts_on", "ends_on", "closed_by_user_id", "closure_reason"]],
    ["operating_goals", ["scope_type", "scope_id", "metric", "target_value", "starts_on", "ends_on", "result_value", "closed_at", "decision_note"]],
    ["student_acquisition_touchpoints", ["person_id", "student_id", "channel_id", "campaign_id", "contributor_id", "occurred_on", "timezone", "recorded_by_user_id", "source_type", "source_id", "voided_at"]],
    ["student_acquisition_attributions", ["student_id", "touchpoint_id", "method", "effective_from", "effective_to", "decided_by_user_id", "decision_source", "decision_source_id"]],
    ["student_referrals", ["referrer_person_id", "referred_person_id", "referred_student_id", "touchpoint_id", "referral_code", "voided_at"]],
    ["student_program_outcomes", ["student_id", "program_id", "outcome_type", "occurred_on", "evidence_note"]],
    ["growth_playbooks", ["slug", "source_campaign_id", "status", "problem", "play", "evidence"]],
  ];
  for (const [tableName, expected] of required) {
    const columns = new Set(
      (db.prepare(`PRAGMA table_info(${tableName})`).all() as unknown as { name: string }[])
        .map((column) => column.name),
    );
    for (const columnName of expected) {
      if (!columns.has(columnName)) {
        throw new Error(`[bow:v7] Required growth-evidence column ${tableName}.${columnName} is missing.`);
      }
    }
  }
}

function assertV7Rows(db: DatabaseSync): void {
  assertV7Columns(db);
  const expectedChannelIds = GROWTH_CHANNELS.map((channel) => `'${channel.id}'`).join(",");
  const expectedChannelCount = GROWTH_CHANNELS.length;
  const referenceCount = db.prepare(
    `SELECT COUNT(*) AS count FROM growth_channels WHERE id IN (${expectedChannelIds})`,
  ).get() as unknown as { count: number };
  if (Number(referenceCount.count) !== expectedChannelCount) {
    throw new Error("[bow:v7] One or more canonical growth channels are missing.");
  }

  const assertions: [string, string][] = [
    [
      "enrollment confirmation evidence is inconsistent",
      `SELECT id, enrolled_at, confirmed_at, confirmation_source
         FROM class_enrollments
        WHERE (confirmed_at IS NULL) <> (confirmation_source IS NULL)
           OR confirmed_at < enrolled_at
           OR confirmation_source NOT IN (${CONFIRMATION_SOURCES})
        LIMIT 1`,
    ],
    [
      "growth channel shape is invalid",
      `SELECT id, code, name, category, status
         FROM growth_channels
        WHERE trim(code) = '' OR length(code) > 80 OR code <> lower(code)
           OR code GLOB '*[^a-z0-9_]*'
           OR trim(name) = '' OR length(name) > 160
           OR category NOT IN (${CHANNEL_CATEGORIES})
           OR status NOT IN ('active','inactive')
        LIMIT 1`,
    ],
    [
      "campaign evidence or operating scope is invalid",
      `SELECT c.id, c.status, c.starts_on, c.ends_on, c.target_metric
         FROM growth_campaigns c
        WHERE trim(c.name) = '' OR length(c.name) > 160
           OR length(trim(c.hypothesis)) < 20 OR length(c.hypothesis) > 2000
           OR c.status NOT IN (${CAMPAIGN_STATUSES})
           OR date(c.starts_on) IS NULL OR date(c.starts_on) <> c.starts_on
           OR date(c.ends_on) IS NULL OR date(c.ends_on) <> c.ends_on OR c.ends_on < c.starts_on
           OR c.target_metric NOT IN (${CAMPAIGN_METRICS}) OR c.target_value <= 0
           OR c.budget_cents < 0 OR c.spend_cents < 0
           OR NOT EXISTS (SELECT 1 FROM growth_channels ch WHERE ch.id = c.channel_id)
           OR (c.region_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM operating_regions r WHERE r.id = c.region_id))
           OR (c.location_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM locations l WHERE l.id = c.location_id))
           OR (c.location_id IS NOT NULL AND c.region_id IS NOT NULL AND NOT EXISTS (
             SELECT 1 FROM locations l WHERE l.id = c.location_id AND l.region_id = c.region_id
           ))
           OR (c.status IN ('active','paused','completed') AND NOT EXISTS (
             SELECT 1 FROM users u WHERE u.id = c.owner_user_id AND u.status = 'active' AND u.role IN ('admin','growth')
           ))
           OR (c.decision IS NOT NULL AND c.decision NOT IN (${CAMPAIGN_DECISIONS}))
           OR ${invalidCampaignLifecycleEvidence("c")}
           OR c.updated_at < c.created_at
        LIMIT 1`,
    ],
    [
      "contributor identity or lifecycle is invalid",
      `SELECT c.id, c.person_id, c.status, c.joined_on, c.exited_on
         FROM growth_contributors c
        WHERE c.status NOT IN (${CONTRIBUTOR_STATUSES})
           OR NOT EXISTS (SELECT 1 FROM people p WHERE p.id = c.person_id)
           OR (c.source_channel_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM growth_channels ch WHERE ch.id = c.source_channel_id))
           OR (c.joined_on IS NOT NULL AND (date(c.joined_on) IS NULL OR date(c.joined_on) <> c.joined_on))
           OR (c.exited_on IS NOT NULL AND (date(c.exited_on) IS NULL OR date(c.exited_on) <> c.exited_on))
           OR (c.status IN ('active','paused','alumni') AND c.joined_on IS NULL)
           OR (c.status = 'alumni' AND c.exited_on IS NULL)
           OR (c.status <> 'alumni' AND c.exited_on IS NOT NULL)
           OR (c.joined_on IS NOT NULL AND c.exited_on IS NOT NULL AND c.exited_on < c.joined_on)
           OR c.updated_at < c.created_at
        LIMIT 1`,
    ],
    [
      "contributor assignment hierarchy or lifecycle is invalid",
      `SELECT a.id, a.role, a.status, a.manager_assignment_id
         FROM growth_assignments a
        WHERE a.role NOT IN (${ASSIGNMENT_ROLES}) OR a.status NOT IN (${ASSIGNMENT_STATUSES})
           OR date(a.starts_on) IS NULL OR date(a.starts_on) <> a.starts_on
           OR (a.ends_on IS NOT NULL AND (date(a.ends_on) IS NULL OR date(a.ends_on) <> a.ends_on OR a.ends_on < a.starts_on))
           OR (a.status = 'active' AND a.ends_on IS NOT NULL)
           OR (a.status <> 'active' AND a.ends_on IS NULL)
           OR (a.status = 'active' AND (a.closed_by_user_id IS NOT NULL OR a.closure_reason IS NOT NULL))
           OR ((a.closed_by_user_id IS NULL) <> (a.closure_reason IS NULL))
           OR (a.closed_by_user_id IS NOT NULL AND (
             length(trim(a.closure_reason)) < 10 OR length(a.closure_reason) > 1000
             OR NOT EXISTS (SELECT 1 FROM users closing_user WHERE closing_user.id = a.closed_by_user_id)
           ))
           OR length(trim(a.decision_reason)) < 10 OR length(a.decision_reason) > 1000
           OR NOT EXISTS (SELECT 1 FROM growth_contributors c WHERE c.id = a.contributor_id)
           OR (a.status = 'active' AND NOT EXISTS (
             SELECT 1 FROM growth_contributors c WHERE c.id = a.contributor_id AND c.status = 'active'
           ))
           OR (a.region_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM operating_regions r WHERE r.id = a.region_id))
           OR (a.location_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM locations l WHERE l.id = a.location_id))
           OR (a.location_id IS NOT NULL AND a.region_id IS NOT NULL AND NOT EXISTS (
             SELECT 1 FROM locations l WHERE l.id = a.location_id AND l.region_id = a.region_id
           ))
           OR EXISTS (
             SELECT 1 FROM growth_assignments overlap
              WHERE overlap.id <> a.id AND overlap.contributor_id = a.contributor_id
                AND overlap.starts_on <= COALESCE(a.ends_on, '9999-12-31')
                AND a.starts_on <= COALESCE(overlap.ends_on, '9999-12-31')
           )
           OR (a.role = 'regional_lead' AND (a.region_id IS NULL OR a.location_id IS NOT NULL OR a.manager_assignment_id IS NOT NULL))
           OR (a.role IN ('market_lead','growth_captain') AND a.location_id IS NULL)
           OR (a.role <> 'regional_lead' AND a.manager_assignment_id IS NOT NULL AND NOT EXISTS (
             SELECT 1 FROM growth_assignments m
              WHERE m.id = a.manager_assignment_id AND m.contributor_id <> a.contributor_id
                AND a.starts_on >= m.starts_on
                AND (a.status <> 'active' OR (m.status = 'active' AND m.ends_on IS NULL))
                AND (a.ends_on IS NULL OR m.ends_on IS NULL OR a.ends_on <= m.ends_on)
                AND (m.region_id IS NULL OR a.region_id = m.region_id)
                AND (m.location_id IS NULL OR a.location_id = m.location_id)
                AND ((a.role = 'market_lead' AND m.role = 'regional_lead')
                  OR (a.role = 'growth_captain' AND m.role IN ('market_lead','regional_lead'))
                  OR (a.role = 'ambassador' AND m.role IN ('growth_captain','market_lead','regional_lead')))
           ))
           OR (a.role <> 'regional_lead' AND a.status = 'active' AND a.manager_assignment_id IS NULL)
           OR a.updated_at < a.created_at
        LIMIT 1`,
    ],
    [
      "operating goal is invalid",
      `SELECT g.id, g.scope_type, g.scope_id, g.metric, g.status
         FROM operating_goals g
        WHERE g.scope_type NOT IN (${GOAL_SCOPE_TYPES}) OR g.metric NOT IN (${GROWTH_METRICS})
           OR g.target_value <= 0
           OR date(g.starts_on) IS NULL OR date(g.starts_on) <> g.starts_on
           OR date(g.ends_on) IS NULL OR date(g.ends_on) <> g.ends_on OR g.ends_on < g.starts_on
           OR g.status NOT IN (${GOAL_STATUSES})
           OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = g.owner_user_id AND u.status = 'active' AND u.role IN ('admin','growth'))
           OR (g.scope_type = 'organization' AND NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = g.scope_id))
           OR (g.scope_type = 'region' AND NOT EXISTS (SELECT 1 FROM operating_regions r WHERE r.id = g.scope_id))
           OR (g.scope_type = 'location' AND NOT EXISTS (SELECT 1 FROM locations l WHERE l.id = g.scope_id))
           OR (g.scope_type = 'campaign' AND NOT EXISTS (SELECT 1 FROM growth_campaigns c WHERE c.id = g.scope_id))
           OR (g.scope_type = 'assignment' AND NOT EXISTS (SELECT 1 FROM growth_assignments a WHERE a.id = g.scope_id))
           OR (g.scope_type = 'program' AND NOT EXISTS (SELECT 1 FROM programs p WHERE p.id = g.scope_id))
           OR g.result_value < 0
           OR (g.status = 'active' AND (g.result_value IS NOT NULL OR g.closed_at IS NOT NULL OR g.decision_note IS NOT NULL))
           OR (g.status <> 'active' AND (
             g.result_value IS NULL OR g.closed_at IS NULL OR g.closed_at < g.created_at
             OR length(trim(COALESCE(g.decision_note,''))) < 10 OR length(g.decision_note) > 2000
           ))
           OR (g.status = 'achieved' AND g.result_value < g.target_value)
           OR (g.status = 'missed' AND g.result_value >= g.target_value)
           OR g.updated_at < g.created_at
        LIMIT 1`,
    ],
    [
      "acquisition touchpoint identity or provenance is invalid",
      `SELECT t.id, t.person_id, t.student_id, t.channel_id, t.campaign_id
         FROM student_acquisition_touchpoints t
        WHERE (t.person_id IS NULL AND t.student_id IS NULL)
           OR t.touchpoint_type NOT IN (${TOUCHPOINT_TYPES})
           OR NOT EXISTS (SELECT 1 FROM growth_channels ch WHERE ch.id = t.channel_id)
           OR (t.person_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM people p WHERE p.id = t.person_id))
           OR (t.student_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM students s WHERE s.id = t.student_id))
           OR (t.person_id IS NOT NULL AND t.student_id IS NOT NULL AND NOT EXISTS (
             SELECT 1 FROM students s
              WHERE s.id = t.student_id AND t.person_id IN (s.person_id, s.guardian_person_id)
           ))
           OR t.occurred_at <= 0 OR t.created_at <= 0 OR t.occurred_at > t.created_at + 300000
           OR date(t.occurred_on) IS NULL OR date(t.occurred_on) <> t.occurred_on
           OR trim(t.timezone) = '' OR length(t.timezone) > 100
           OR (t.campaign_id IS NOT NULL AND NOT EXISTS (
             SELECT 1 FROM growth_campaigns c
              WHERE c.id = t.campaign_id AND c.channel_id = t.channel_id AND c.status <> 'draft'
                AND t.occurred_on BETWEEN c.starts_on AND c.ends_on
           ))
           OR (t.contributor_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM growth_contributors c WHERE c.id = t.contributor_id))
           OR (t.contributor_id IS NOT NULL AND NOT EXISTS (
             SELECT 1 FROM growth_assignments a
              WHERE a.contributor_id = t.contributor_id
                AND a.starts_on <= t.occurred_on
                AND COALESCE(a.ends_on, '9999-12-31') >= t.occurred_on
                AND (t.campaign_id IS NULL OR EXISTS (
                  SELECT 1 FROM growth_campaigns c
                   WHERE c.id = t.campaign_id
                     AND (c.region_id IS NULL OR a.region_id = c.region_id)
                     AND (c.location_id IS NULL OR a.location_id = c.location_id
                       OR (a.location_id IS NULL AND a.region_id = c.region_id))
                ))
           ))
           OR (t.external_key IS NOT NULL AND (length(trim(t.external_key)) < 12 OR length(t.external_key) > 160))
           OR t.source_type NOT IN ('operator','public_inquiry','import')
           OR (t.source_type = 'operator' AND (
             t.source_id IS NOT NULL OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = t.recorded_by_user_id AND u.status = 'active' AND u.role IN ('admin','growth'))
           ))
           OR (t.source_type = 'import' AND (
             length(trim(COALESCE(t.source_id,''))) < 3 OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = t.recorded_by_user_id AND u.status = 'active' AND u.role IN ('admin','growth'))
           ))
           OR (t.source_type = 'public_inquiry' AND (
             t.recorded_by_user_id IS NOT NULL
             OR t.external_key IS NOT ('public-inquiry:' || t.source_id)
             OR NOT EXISTS (
               SELECT 1 FROM inquiries i JOIN people p ON p.id = t.person_id
                WHERE i.id = t.source_id
                  AND lower(trim(i.email)) = lower(trim(p.email))
                  AND lower(trim(i.type)) IN ('student','parent','family','join as a student or family')
             )
           ))
           OR (t.voided_at IS NULL) <> (t.voided_by_user_id IS NULL)
           OR (t.voided_at IS NULL) <> (t.void_reason IS NULL)
           OR (t.voided_at IS NOT NULL AND length(trim(t.void_reason)) < 10)
        LIMIT 1`,
    ],
    [
      "student acquisition attribution is invalid",
      `SELECT a.id, a.student_id, a.touchpoint_id, a.method
         FROM student_acquisition_attributions a
        WHERE a.method NOT IN (${ATTRIBUTION_METHODS})
           OR length(trim(a.evidence_note)) < 10 OR length(a.evidence_note) > 1000
           OR a.effective_from <= 0 OR (a.effective_to IS NOT NULL AND a.effective_to <= a.effective_from)
           OR NOT EXISTS (SELECT 1 FROM students s WHERE s.id = a.student_id)
           OR NOT EXISTS (
             SELECT 1
              FROM student_acquisition_touchpoints t
               JOIN students s ON s.id = a.student_id
              WHERE t.id = a.touchpoint_id AND t.voided_at IS NULL
                AND (t.student_id = a.student_id OR (
                  t.student_id IS NULL AND t.person_id IN (s.person_id, s.guardian_person_id)
                ))
           )
           OR a.decision_source NOT IN ('operator','migration')
           OR (a.decision_source = 'operator' AND (
             a.decision_source_id IS NOT NULL OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = a.decided_by_user_id AND u.status = 'active' AND u.role IN ('admin','growth'))
           ))
           OR (a.decision_source = 'migration' AND (
             a.decided_by_user_id IS NOT NULL OR a.decision_source_id <> '${OPERATING_SYSTEM_V7_GROWTH_MIGRATION_ID}'
           ))
        LIMIT 1`,
    ],
    [
      "referral identity or evidence is invalid",
      `SELECT r.id, r.referrer_person_id, r.referred_person_id, r.referred_student_id, r.referral_code
         FROM student_referrals r
        WHERE r.referrer_person_id = r.referred_person_id
           OR r.touchpoint_id IS NULL OR r.submitted_at <= 0 OR r.created_at <= 0
           OR r.submitted_at > r.created_at + 300000
           OR NOT EXISTS (SELECT 1 FROM people p WHERE p.id = r.referrer_person_id)
           OR NOT EXISTS (SELECT 1 FROM people p WHERE p.id = r.referred_person_id)
           OR (r.referred_student_id IS NOT NULL AND NOT EXISTS (
             SELECT 1 FROM students s WHERE s.id = r.referred_student_id AND s.person_id = r.referred_person_id
           ))
           OR NOT EXISTS (
             SELECT 1 FROM student_acquisition_touchpoints t
             JOIN growth_channels ch ON ch.id = t.channel_id
              WHERE t.id = r.touchpoint_id AND t.voided_at IS NULL AND ch.category = 'referral'
                AND (t.person_id = r.referred_person_id OR t.student_id = r.referred_student_id)
                AND t.campaign_id IS r.campaign_id AND t.contributor_id IS r.contributor_id
           )
           OR length(trim(r.referral_code)) < 8 OR length(r.referral_code) > 80
           OR r.referral_code <> lower(r.referral_code) OR r.referral_code GLOB '*[^a-z0-9_-]*'
           OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = r.created_by_user_id AND u.status = 'active' AND u.role IN ('admin','growth'))
           OR (r.voided_at IS NULL) <> (r.voided_by_user_id IS NULL)
           OR (r.voided_at IS NULL) <> (r.void_reason IS NULL)
           OR (r.voided_at IS NOT NULL AND length(trim(r.void_reason)) < 10)
           OR (r.voided_by_user_id IS NOT NULL AND NOT EXISTS (
             SELECT 1 FROM users u WHERE u.id = r.voided_by_user_id AND u.status = 'active' AND u.role IN ('admin','growth')
           ))
           OR (r.voided_at IS NOT NULL AND NOT EXISTS (
             SELECT 1 FROM student_acquisition_touchpoints t
              WHERE t.id = r.touchpoint_id AND t.voided_at = r.voided_at
                AND t.voided_by_user_id = r.voided_by_user_id AND t.void_reason = r.void_reason
           ))
        LIMIT 1`,
    ],
    [
      "student Program outcome lacks a valid enrollment or evidence record",
      `SELECT o.id, o.student_id, o.program_id, o.outcome_type
         FROM student_program_outcomes o
        WHERE o.outcome_type NOT IN (${OUTCOME_TYPES})
           OR date(o.occurred_on) IS NULL OR date(o.occurred_on) <> o.occurred_on
           OR length(trim(o.evidence_note)) < 10 OR length(o.evidence_note) > 2000
           OR NOT EXISTS (SELECT 1 FROM students s WHERE s.id = o.student_id)
           OR NOT EXISTS (SELECT 1 FROM programs p WHERE p.id = o.program_id)
           OR NOT EXISTS (
             SELECT 1 FROM class_enrollments ce
             JOIN classes c ON c.id = ce.class_id
              WHERE ce.student_id = o.student_id AND c.program_id = o.program_id
           )
           OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = o.recorded_by_user_id AND u.status = 'active' AND u.role IN ('admin','growth'))
        LIMIT 1`,
    ],
    [
      "growth playbook is not backed by completed campaign evidence",
      `SELECT p.id, p.slug, p.status, p.source_campaign_id
         FROM growth_playbooks p
        WHERE length(trim(p.slug)) < 3 OR length(p.slug) > 100 OR p.slug <> lower(p.slug) OR p.slug GLOB '*[^a-z0-9-]*'
           OR length(trim(p.title)) < 3 OR length(p.title) > 180
           OR p.status NOT IN (${PLAYBOOK_STATUSES})
           OR length(trim(p.problem)) < 20 OR length(p.problem) > 2000
           OR length(trim(p.play)) < 20 OR length(p.play) > 5000
           OR length(trim(p.evidence)) < 20 OR length(p.evidence) > 3000
           OR NOT EXISTS (
             SELECT 1 FROM growth_campaigns c
              WHERE c.id = p.source_campaign_id AND c.status = 'completed'
                AND c.result_value IS NOT NULL AND c.decision IS NOT NULL AND length(trim(COALESCE(c.learning,''))) >= 20
           )
           OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = p.owner_user_id AND u.status = 'active' AND u.role IN ('admin','growth'))
           OR (p.status = 'active' AND p.published_at IS NULL)
           OR (p.status = 'draft' AND p.published_at IS NOT NULL)
           OR p.updated_at < p.created_at
        LIMIT 1`,
    ],
  ];
  for (const [label, sql] of assertions) assertNoRow(db, label, sql);
}

function installV7Indexes(db: DatabaseSync): void {
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_v7_growth_channels_code
      ON growth_channels (code);
    CREATE INDEX IF NOT EXISTS idx_v7_growth_campaigns_status_dates
      ON growth_campaigns (status, starts_on, ends_on);
    CREATE INDEX IF NOT EXISTS idx_v7_growth_campaigns_scope
      ON growth_campaigns (region_id, location_id, status);
    CREATE UNIQUE INDEX IF NOT EXISTS ux_v7_growth_contributors_person
      ON growth_contributors (person_id);
    CREATE UNIQUE INDEX IF NOT EXISTS ux_v7_growth_assignments_current_contributor
      ON growth_assignments (contributor_id)
      WHERE status = 'active' AND ends_on IS NULL;
    CREATE INDEX IF NOT EXISTS idx_v7_growth_assignments_manager
      ON growth_assignments (manager_assignment_id, status, ends_on);
    CREATE UNIQUE INDEX IF NOT EXISTS ux_v7_operating_goals_window
      ON operating_goals (scope_type, scope_id, metric, starts_on, ends_on)
      WHERE status = 'active';
    CREATE INDEX IF NOT EXISTS idx_v7_touchpoints_channel_time
      ON student_acquisition_touchpoints (channel_id, occurred_on, occurred_at)
      WHERE voided_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_v7_touchpoints_campaign_time
      ON student_acquisition_touchpoints (campaign_id, occurred_on, occurred_at)
      WHERE voided_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_v7_touchpoints_contributor_time
      ON student_acquisition_touchpoints (contributor_id, occurred_on, occurred_at)
      WHERE voided_at IS NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS ux_v7_touchpoints_external_key
      ON student_acquisition_touchpoints (external_key)
      WHERE external_key IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS ux_v7_attributions_current_student
      ON student_acquisition_attributions (student_id)
      WHERE effective_to IS NULL;
    CREATE INDEX IF NOT EXISTS idx_v7_attributions_touchpoint
      ON student_acquisition_attributions (touchpoint_id, effective_from, effective_to);
    CREATE UNIQUE INDEX IF NOT EXISTS ux_v7_referrals_code
      ON student_referrals (referral_code);
    CREATE UNIQUE INDEX IF NOT EXISTS ux_v7_referrals_touchpoint
      ON student_referrals (touchpoint_id);
    CREATE UNIQUE INDEX IF NOT EXISTS ux_v7_referrals_current_referred_person
      ON student_referrals (referred_person_id)
      WHERE voided_at IS NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS ux_v7_student_program_outcomes_identity
      ON student_program_outcomes (student_id, program_id, outcome_type);
    CREATE INDEX IF NOT EXISTS idx_v7_student_program_outcomes_date
      ON student_program_outcomes (occurred_on, outcome_type);
    CREATE UNIQUE INDEX IF NOT EXISTS ux_v7_growth_playbooks_slug
      ON growth_playbooks (slug);
  `);
}

function installV7Protections(db: DatabaseSync): void {
  db.exec(`
    DROP TRIGGER IF EXISTS trg_v7_enrollment_confirmation_insert;
    CREATE TRIGGER trg_v7_enrollment_confirmation_insert
    BEFORE INSERT ON class_enrollments
    WHEN (NEW.confirmed_at IS NULL) <> (NEW.confirmation_source IS NULL)
      OR NEW.confirmed_at < NEW.enrolled_at
      OR NEW.confirmation_source NOT IN (${CONFIRMATION_SOURCES})
    BEGIN
      SELECT RAISE(ABORT, 'Enrollment confirmation evidence is invalid');
    END;

    DROP TRIGGER IF EXISTS trg_v7_enrollment_confirmation_update;
    CREATE TRIGGER trg_v7_enrollment_confirmation_update
    BEFORE UPDATE OF enrolled_at, confirmed_at, confirmation_source ON class_enrollments
    WHEN (NEW.confirmed_at IS NULL) <> (NEW.confirmation_source IS NULL)
      OR NEW.confirmed_at < NEW.enrolled_at
      OR NEW.confirmation_source NOT IN (${CONFIRMATION_SOURCES})
    BEGIN
      SELECT RAISE(ABORT, 'Enrollment confirmation evidence is invalid');
    END;

    DROP TRIGGER IF EXISTS trg_v7_enrollment_confirmation_immutable;
    CREATE TRIGGER trg_v7_enrollment_confirmation_immutable
    BEFORE UPDATE OF confirmed_at, confirmation_source ON class_enrollments
    WHEN OLD.confirmed_at IS NOT NULL
      AND (NEW.confirmed_at IS NOT OLD.confirmed_at OR NEW.confirmation_source IS NOT OLD.confirmation_source)
    BEGIN
      SELECT RAISE(ABORT, 'Enrollment confirmation evidence is immutable');
    END;

    DROP TRIGGER IF EXISTS trg_v7_growth_channel_insert;
    CREATE TRIGGER trg_v7_growth_channel_insert
    BEFORE INSERT ON growth_channels
    WHEN trim(NEW.code) = '' OR length(NEW.code) > 80 OR NEW.code <> lower(NEW.code)
      OR NEW.code GLOB '*[^a-z0-9_]*' OR trim(NEW.name) = '' OR length(NEW.name) > 160
      OR NEW.category NOT IN (${CHANNEL_CATEGORIES}) OR NEW.status NOT IN ('active','inactive')
      OR NEW.updated_at < NEW.created_at
    BEGIN
      SELECT RAISE(ABORT, 'Growth channel shape is invalid');
    END;

    DROP TRIGGER IF EXISTS trg_v7_growth_channel_update;
    CREATE TRIGGER trg_v7_growth_channel_update
    BEFORE UPDATE ON growth_channels
    WHEN NEW.id IS NOT OLD.id OR NEW.code IS NOT OLD.code
      OR trim(NEW.name) = '' OR length(NEW.name) > 160
      OR NEW.category NOT IN (${CHANNEL_CATEGORIES}) OR NEW.status NOT IN ('active','inactive')
      OR NEW.created_at IS NOT OLD.created_at OR NEW.updated_at < OLD.updated_at
    BEGIN
      SELECT RAISE(ABORT, 'Growth channel shape is invalid');
    END;

    DROP TRIGGER IF EXISTS trg_v7_growth_channel_no_delete;
    CREATE TRIGGER trg_v7_growth_channel_no_delete BEFORE DELETE ON growth_channels
    BEGIN SELECT RAISE(ABORT, 'Growth channels are durable reference data'); END;

    DROP TRIGGER IF EXISTS trg_v7_growth_campaign_insert;
    CREATE TRIGGER trg_v7_growth_campaign_insert
    BEFORE INSERT ON growth_campaigns
    WHEN trim(NEW.name) = '' OR length(NEW.name) > 160
      OR length(trim(NEW.hypothesis)) < 20 OR length(NEW.hypothesis) > 2000
      OR NEW.status NOT IN (${CAMPAIGN_STATUSES})
      OR date(NEW.starts_on) IS NULL OR date(NEW.starts_on) <> NEW.starts_on
      OR date(NEW.ends_on) IS NULL OR date(NEW.ends_on) <> NEW.ends_on OR NEW.ends_on < NEW.starts_on
      OR NEW.target_metric NOT IN (${CAMPAIGN_METRICS}) OR NEW.target_value <= 0
      OR NEW.budget_cents < 0 OR NEW.spend_cents < 0
      OR NOT EXISTS (SELECT 1 FROM growth_channels ch WHERE ch.id = NEW.channel_id)
      OR (NEW.region_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM operating_regions r WHERE r.id = NEW.region_id))
      OR (NEW.location_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM locations l WHERE l.id = NEW.location_id))
      OR (NEW.location_id IS NOT NULL AND NEW.region_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM locations l WHERE l.id = NEW.location_id AND l.region_id = NEW.region_id
      ))
      OR (NEW.status IN ('active','paused','completed') AND NOT EXISTS (
        SELECT 1 FROM users u WHERE u.id = NEW.owner_user_id AND u.status = 'active' AND u.role IN ('admin','growth')
      ))
      OR (NEW.decision IS NOT NULL AND NEW.decision NOT IN (${CAMPAIGN_DECISIONS}))
      OR ${invalidCampaignLifecycleEvidence("NEW")}
      OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = NEW.created_by_user_id AND u.status = 'active' AND u.role IN ('admin','growth'))
      OR NEW.updated_at < NEW.created_at
    BEGIN
      SELECT RAISE(ABORT, 'Growth campaign evidence is invalid');
    END;

    DROP TRIGGER IF EXISTS trg_v7_growth_campaign_update;
    CREATE TRIGGER trg_v7_growth_campaign_update
    BEFORE UPDATE ON growth_campaigns
    WHEN NEW.id IS NOT OLD.id OR NEW.created_by_user_id IS NOT OLD.created_by_user_id OR NEW.created_at IS NOT OLD.created_at
      OR OLD.status IN ('completed','cancelled')
      OR (OLD.status = 'active' AND NEW.status = 'draft')
      OR (OLD.status <> 'draft' AND (
        NEW.name IS NOT OLD.name OR NEW.channel_id IS NOT OLD.channel_id
        OR NEW.region_id IS NOT OLD.region_id OR NEW.location_id IS NOT OLD.location_id
        OR NEW.hypothesis IS NOT OLD.hypothesis OR NEW.starts_on IS NOT OLD.starts_on
        OR NEW.ends_on IS NOT OLD.ends_on OR NEW.target_metric IS NOT OLD.target_metric
        OR NEW.target_value IS NOT OLD.target_value OR NEW.budget_cents IS NOT OLD.budget_cents
      ))
      OR trim(NEW.name) = '' OR length(NEW.name) > 160
      OR length(trim(NEW.hypothesis)) < 20 OR length(NEW.hypothesis) > 2000
      OR NEW.status NOT IN (${CAMPAIGN_STATUSES})
      OR date(NEW.starts_on) IS NULL OR date(NEW.starts_on) <> NEW.starts_on
      OR date(NEW.ends_on) IS NULL OR date(NEW.ends_on) <> NEW.ends_on OR NEW.ends_on < NEW.starts_on
      OR NEW.target_metric NOT IN (${CAMPAIGN_METRICS}) OR NEW.target_value <= 0
      OR NEW.budget_cents < 0 OR NEW.spend_cents < 0
      OR NOT EXISTS (SELECT 1 FROM growth_channels ch WHERE ch.id = NEW.channel_id)
      OR (NEW.region_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM operating_regions r WHERE r.id = NEW.region_id))
      OR (NEW.location_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM locations l WHERE l.id = NEW.location_id))
      OR (NEW.location_id IS NOT NULL AND NEW.region_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM locations l WHERE l.id = NEW.location_id AND l.region_id = NEW.region_id
      ))
      OR (NEW.status IN ('active','paused','completed') AND NOT EXISTS (
        SELECT 1 FROM users u WHERE u.id = NEW.owner_user_id AND u.status = 'active' AND u.role IN ('admin','growth')
      ))
      OR (NEW.decision IS NOT NULL AND NEW.decision NOT IN (${CAMPAIGN_DECISIONS}))
      OR ${invalidCampaignLifecycleEvidence("NEW")}
      OR NEW.updated_at <= OLD.updated_at
    BEGIN
      SELECT RAISE(ABORT, 'Growth campaign evidence is invalid');
    END;

    DROP TRIGGER IF EXISTS trg_v7_growth_campaign_no_delete;
    CREATE TRIGGER trg_v7_growth_campaign_no_delete BEFORE DELETE ON growth_campaigns
    BEGIN SELECT RAISE(ABORT, 'Growth campaigns are durable operating history'); END;

    DROP TRIGGER IF EXISTS trg_v7_contributor_insert;
    CREATE TRIGGER trg_v7_contributor_insert
    BEFORE INSERT ON growth_contributors
    WHEN NEW.status NOT IN (${CONTRIBUTOR_STATUSES})
      OR NOT EXISTS (SELECT 1 FROM people p WHERE p.id = NEW.person_id)
      OR (NEW.source_channel_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM growth_channels ch WHERE ch.id = NEW.source_channel_id))
      OR (NEW.joined_on IS NOT NULL AND (date(NEW.joined_on) IS NULL OR date(NEW.joined_on) <> NEW.joined_on))
      OR (NEW.exited_on IS NOT NULL AND (date(NEW.exited_on) IS NULL OR date(NEW.exited_on) <> NEW.exited_on))
      OR (NEW.status IN ('active','paused','alumni') AND NEW.joined_on IS NULL)
      OR (NEW.status = 'alumni' AND NEW.exited_on IS NULL)
      OR (NEW.status <> 'alumni' AND NEW.exited_on IS NOT NULL)
      OR (NEW.joined_on IS NOT NULL AND NEW.exited_on IS NOT NULL AND NEW.exited_on < NEW.joined_on)
      OR NEW.updated_at < NEW.created_at
    BEGIN
      SELECT RAISE(ABORT, 'Growth contributor lifecycle is invalid');
    END;

    DROP TRIGGER IF EXISTS trg_v7_contributor_update;
    CREATE TRIGGER trg_v7_contributor_update
    BEFORE UPDATE ON growth_contributors
    WHEN NEW.id IS NOT OLD.id OR NEW.person_id IS NOT OLD.person_id OR NEW.created_at IS NOT OLD.created_at
      OR OLD.status = 'alumni'
      OR (OLD.joined_on IS NOT NULL AND NEW.joined_on IS NOT OLD.joined_on)
      OR NEW.status NOT IN (${CONTRIBUTOR_STATUSES})
      OR (NEW.source_channel_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM growth_channels ch WHERE ch.id = NEW.source_channel_id))
      OR (NEW.joined_on IS NOT NULL AND (date(NEW.joined_on) IS NULL OR date(NEW.joined_on) <> NEW.joined_on))
      OR (NEW.exited_on IS NOT NULL AND (date(NEW.exited_on) IS NULL OR date(NEW.exited_on) <> NEW.exited_on))
      OR (NEW.status IN ('active','paused','alumni') AND NEW.joined_on IS NULL)
      OR (NEW.status = 'alumni' AND NEW.exited_on IS NULL)
      OR (NEW.status <> 'alumni' AND NEW.exited_on IS NOT NULL)
      OR (NEW.joined_on IS NOT NULL AND NEW.exited_on IS NOT NULL AND NEW.exited_on < NEW.joined_on)
      OR (NEW.status <> 'active' AND EXISTS (
        SELECT 1 FROM growth_assignments a
         WHERE a.contributor_id = OLD.id AND a.status = 'active' AND a.ends_on IS NULL
      ))
      OR NEW.updated_at <= OLD.updated_at
    BEGIN
      SELECT RAISE(ABORT, 'Growth contributor lifecycle is invalid');
    END;

    DROP TRIGGER IF EXISTS trg_v7_contributor_no_delete;
    CREATE TRIGGER trg_v7_contributor_no_delete BEFORE DELETE ON growth_contributors
    BEGIN SELECT RAISE(ABORT, 'Growth contributors are durable operating history'); END;

    DROP TRIGGER IF EXISTS trg_v7_assignment_insert;
    CREATE TRIGGER trg_v7_assignment_insert
    BEFORE INSERT ON growth_assignments
    WHEN NEW.role NOT IN (${ASSIGNMENT_ROLES}) OR NEW.status NOT IN (${ASSIGNMENT_STATUSES})
      OR date(NEW.starts_on) IS NULL OR date(NEW.starts_on) <> NEW.starts_on
      OR (NEW.ends_on IS NOT NULL AND (date(NEW.ends_on) IS NULL OR date(NEW.ends_on) <> NEW.ends_on OR NEW.ends_on < NEW.starts_on))
      OR (NEW.status = 'active' AND NEW.ends_on IS NOT NULL) OR (NEW.status <> 'active' AND NEW.ends_on IS NULL)
      OR (NEW.status = 'active' AND (NEW.closed_by_user_id IS NOT NULL OR NEW.closure_reason IS NOT NULL))
      OR (NEW.status <> 'active' AND (
        NEW.closed_by_user_id IS NULL OR length(trim(COALESCE(NEW.closure_reason,''))) < 10
        OR length(NEW.closure_reason) > 1000
        OR NOT EXISTS (
          SELECT 1 FROM users closing_user
           WHERE closing_user.id = NEW.closed_by_user_id
             AND closing_user.status = 'active' AND closing_user.role IN ('admin','growth')
        )
      ))
      OR length(trim(NEW.decision_reason)) < 10 OR length(NEW.decision_reason) > 1000
      OR NOT EXISTS (SELECT 1 FROM growth_contributors c WHERE c.id = NEW.contributor_id)
      OR (NEW.status = 'active' AND NOT EXISTS (SELECT 1 FROM growth_contributors c WHERE c.id = NEW.contributor_id AND c.status = 'active'))
      OR (NEW.region_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM operating_regions r WHERE r.id = NEW.region_id))
      OR (NEW.location_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM locations l WHERE l.id = NEW.location_id))
      OR (NEW.location_id IS NOT NULL AND NEW.region_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM locations l WHERE l.id = NEW.location_id AND l.region_id = NEW.region_id
      ))
      OR EXISTS (
        SELECT 1 FROM growth_assignments overlap
         WHERE overlap.contributor_id = NEW.contributor_id
           AND overlap.starts_on <= COALESCE(NEW.ends_on, '9999-12-31')
           AND NEW.starts_on <= COALESCE(overlap.ends_on, '9999-12-31')
      )
      OR (NEW.role = 'regional_lead' AND (NEW.region_id IS NULL OR NEW.location_id IS NOT NULL OR NEW.manager_assignment_id IS NOT NULL))
      OR (NEW.role IN ('market_lead','growth_captain') AND NEW.location_id IS NULL)
      OR (NEW.role <> 'regional_lead' AND NEW.status = 'active' AND NEW.manager_assignment_id IS NULL)
      OR (NEW.manager_assignment_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM growth_assignments m
         WHERE m.id = NEW.manager_assignment_id AND m.contributor_id <> NEW.contributor_id
           AND m.status = 'active' AND m.ends_on IS NULL
           AND NEW.starts_on >= m.starts_on
           AND (m.region_id IS NULL OR NEW.region_id = m.region_id)
           AND (m.location_id IS NULL OR NEW.location_id = m.location_id)
           AND ((NEW.role = 'market_lead' AND m.role = 'regional_lead')
             OR (NEW.role = 'growth_captain' AND m.role IN ('market_lead','regional_lead'))
             OR (NEW.role = 'ambassador' AND m.role IN ('growth_captain','market_lead','regional_lead')))
      ))
      OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = NEW.created_by_user_id AND u.status = 'active' AND u.role IN ('admin','growth'))
      OR NEW.updated_at < NEW.created_at
    BEGIN
      SELECT RAISE(ABORT, 'Growth assignment hierarchy is invalid');
    END;

    DROP TRIGGER IF EXISTS trg_v7_assignment_update;
    CREATE TRIGGER trg_v7_assignment_update
    BEFORE UPDATE ON growth_assignments
    WHEN NEW.id IS NOT OLD.id OR NEW.contributor_id IS NOT OLD.contributor_id OR NEW.role IS NOT OLD.role
      OR NEW.manager_assignment_id IS NOT OLD.manager_assignment_id OR NEW.region_id IS NOT OLD.region_id
      OR NEW.location_id IS NOT OLD.location_id OR NEW.starts_on IS NOT OLD.starts_on
      OR NEW.decision_reason IS NOT OLD.decision_reason OR NEW.created_by_user_id IS NOT OLD.created_by_user_id
      OR NEW.created_at IS NOT OLD.created_at OR OLD.status <> 'active'
      OR NEW.status NOT IN (${ASSIGNMENT_STATUSES})
      OR (NEW.status = 'active' AND NEW.ends_on IS NOT NULL) OR (NEW.status <> 'active' AND NEW.ends_on IS NULL)
      OR (NEW.ends_on IS NOT NULL AND (date(NEW.ends_on) IS NULL OR date(NEW.ends_on) <> NEW.ends_on OR NEW.ends_on < NEW.starts_on))
      OR (NEW.status = 'active' AND (NEW.closed_by_user_id IS NOT NULL OR NEW.closure_reason IS NOT NULL))
      OR (NEW.status <> 'active' AND (
        NEW.closed_by_user_id IS NULL OR length(trim(COALESCE(NEW.closure_reason,''))) < 10
        OR length(NEW.closure_reason) > 1000
        OR NOT EXISTS (
          SELECT 1 FROM users closing_user
           WHERE closing_user.id = NEW.closed_by_user_id
             AND closing_user.status = 'active' AND closing_user.role IN ('admin','growth')
        )
      ))
      OR (OLD.status = 'active' AND NEW.status <> 'active' AND EXISTS (
        SELECT 1 FROM growth_assignments child
         WHERE child.manager_assignment_id = OLD.id
           AND (child.ends_on IS NULL OR child.ends_on > NEW.ends_on)
      ))
      OR (OLD.status = 'active' AND NEW.status <> 'active' AND EXISTS (
        SELECT 1 FROM student_acquisition_touchpoints evidence
         WHERE evidence.contributor_id = OLD.contributor_id
           AND evidence.occurred_on > NEW.ends_on
           AND evidence.occurred_on >= OLD.starts_on
      ))
      OR NEW.updated_at <= OLD.updated_at
    BEGIN
      SELECT RAISE(ABORT, 'Growth assignment history is immutable');
    END;

    DROP TRIGGER IF EXISTS trg_v7_assignment_no_delete;
    CREATE TRIGGER trg_v7_assignment_no_delete BEFORE DELETE ON growth_assignments
    BEGIN SELECT RAISE(ABORT, 'Growth assignments are durable operating history'); END;

    DROP TRIGGER IF EXISTS trg_v7_goal_insert;
    CREATE TRIGGER trg_v7_goal_insert
    BEFORE INSERT ON operating_goals
    WHEN NEW.scope_type NOT IN (${GOAL_SCOPE_TYPES}) OR NEW.metric NOT IN (${GROWTH_METRICS}) OR NEW.target_value <= 0
      OR date(NEW.starts_on) IS NULL OR date(NEW.starts_on) <> NEW.starts_on
      OR date(NEW.ends_on) IS NULL OR date(NEW.ends_on) <> NEW.ends_on OR NEW.ends_on < NEW.starts_on
      OR NEW.status NOT IN (${GOAL_STATUSES})
      OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = NEW.owner_user_id AND u.status = 'active' AND u.role IN ('admin','growth'))
      OR (NEW.scope_type = 'organization' AND NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = NEW.scope_id))
      OR (NEW.scope_type = 'region' AND NOT EXISTS (SELECT 1 FROM operating_regions r WHERE r.id = NEW.scope_id))
      OR (NEW.scope_type = 'location' AND NOT EXISTS (SELECT 1 FROM locations l WHERE l.id = NEW.scope_id))
      OR (NEW.scope_type = 'campaign' AND NOT EXISTS (SELECT 1 FROM growth_campaigns c WHERE c.id = NEW.scope_id))
      OR (NEW.scope_type = 'assignment' AND NOT EXISTS (SELECT 1 FROM growth_assignments a WHERE a.id = NEW.scope_id))
      OR (NEW.scope_type = 'program' AND NOT EXISTS (SELECT 1 FROM programs p WHERE p.id = NEW.scope_id))
      OR NEW.result_value < 0
      OR (NEW.status = 'active' AND (NEW.result_value IS NOT NULL OR NEW.closed_at IS NOT NULL OR NEW.decision_note IS NOT NULL))
      OR (NEW.status <> 'active' AND (
        NEW.result_value IS NULL OR NEW.closed_at IS NULL OR NEW.closed_at < NEW.created_at
        OR length(trim(COALESCE(NEW.decision_note,''))) < 10 OR length(NEW.decision_note) > 2000
      ))
      OR (NEW.status = 'achieved' AND NEW.result_value < NEW.target_value)
      OR (NEW.status = 'missed' AND NEW.result_value >= NEW.target_value)
      OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = NEW.created_by_user_id AND u.status = 'active' AND u.role IN ('admin','growth'))
      OR NEW.updated_at < NEW.created_at
    BEGIN
      SELECT RAISE(ABORT, 'Operating goal evidence is invalid');
    END;

    DROP TRIGGER IF EXISTS trg_v7_goal_update;
    CREATE TRIGGER trg_v7_goal_update
    BEFORE UPDATE ON operating_goals
    WHEN NEW.id IS NOT OLD.id OR NEW.scope_type IS NOT OLD.scope_type OR NEW.scope_id IS NOT OLD.scope_id
      OR NEW.metric IS NOT OLD.metric OR NEW.starts_on IS NOT OLD.starts_on OR NEW.ends_on IS NOT OLD.ends_on
      OR NEW.created_by_user_id IS NOT OLD.created_by_user_id OR NEW.created_at IS NOT OLD.created_at
      OR OLD.status <> 'active' OR NEW.target_value IS NOT OLD.target_value
      OR NEW.target_value <= 0 OR NEW.status NOT IN (${GOAL_STATUSES})
      OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = NEW.owner_user_id AND u.status = 'active' AND u.role IN ('admin','growth'))
      OR NEW.result_value < 0
      OR (NEW.status = 'active' AND (NEW.result_value IS NOT NULL OR NEW.closed_at IS NOT NULL OR NEW.decision_note IS NOT NULL))
      OR (NEW.status <> 'active' AND (
        NEW.result_value IS NULL OR NEW.closed_at IS NULL OR NEW.closed_at < NEW.created_at
        OR length(trim(COALESCE(NEW.decision_note,''))) < 10 OR length(NEW.decision_note) > 2000
      ))
      OR (NEW.status = 'achieved' AND NEW.result_value < NEW.target_value)
      OR (NEW.status = 'missed' AND NEW.result_value >= NEW.target_value)
      OR NEW.updated_at <= OLD.updated_at
    BEGIN
      SELECT RAISE(ABORT, 'Operating goal evidence is invalid');
    END;

    DROP TRIGGER IF EXISTS trg_v7_goal_no_delete;
    CREATE TRIGGER trg_v7_goal_no_delete BEFORE DELETE ON operating_goals
    BEGIN SELECT RAISE(ABORT, 'Operating goals are durable operating history'); END;

    DROP TRIGGER IF EXISTS trg_v7_touchpoint_insert;
    CREATE TRIGGER trg_v7_touchpoint_insert
    BEFORE INSERT ON student_acquisition_touchpoints
    WHEN (NEW.person_id IS NULL AND NEW.student_id IS NULL)
      OR NEW.touchpoint_type NOT IN (${TOUCHPOINT_TYPES})
      OR NOT EXISTS (SELECT 1 FROM growth_channels ch WHERE ch.id = NEW.channel_id)
      OR (NEW.person_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM people p WHERE p.id = NEW.person_id))
      OR (NEW.student_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM students s WHERE s.id = NEW.student_id))
      OR (NEW.person_id IS NOT NULL AND NEW.student_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM students s
         WHERE s.id = NEW.student_id AND NEW.person_id IN (s.person_id, s.guardian_person_id)
      ))
      OR NEW.occurred_at <= 0 OR NEW.created_at <= 0 OR NEW.occurred_at > NEW.created_at + 300000
      OR date(NEW.occurred_on) IS NULL OR date(NEW.occurred_on) <> NEW.occurred_on
      OR trim(NEW.timezone) = '' OR length(NEW.timezone) > 100
      OR (NEW.campaign_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM growth_campaigns c
         WHERE c.id = NEW.campaign_id AND c.channel_id = NEW.channel_id AND c.status = 'active'
           AND NEW.occurred_on BETWEEN c.starts_on AND c.ends_on
      ))
      OR (NEW.contributor_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM growth_contributors c WHERE c.id = NEW.contributor_id AND c.status = 'active'
      ))
      OR (NEW.contributor_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM growth_assignments a
         WHERE a.contributor_id = NEW.contributor_id
           AND a.starts_on <= NEW.occurred_on
           AND COALESCE(a.ends_on, '9999-12-31') >= NEW.occurred_on
           AND (NEW.campaign_id IS NULL OR EXISTS (
             SELECT 1 FROM growth_campaigns c
              WHERE c.id = NEW.campaign_id
                AND (c.region_id IS NULL OR a.region_id = c.region_id)
                AND (c.location_id IS NULL OR a.location_id = c.location_id
                  OR (a.location_id IS NULL AND a.region_id = c.region_id))
           ))
      ))
      OR (NEW.external_key IS NOT NULL AND (length(trim(NEW.external_key)) < 12 OR length(NEW.external_key) > 160))
      OR NEW.source_type NOT IN ('operator','public_inquiry','import')
      OR (NEW.source_type = 'operator' AND (
        NEW.source_id IS NOT NULL OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = NEW.recorded_by_user_id AND u.status = 'active' AND u.role IN ('admin','growth'))
      ))
      OR (NEW.source_type = 'import' AND (
        length(trim(COALESCE(NEW.source_id,''))) < 3 OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = NEW.recorded_by_user_id AND u.status = 'active' AND u.role IN ('admin','growth'))
      ))
      OR (NEW.source_type = 'public_inquiry' AND (
        NEW.recorded_by_user_id IS NOT NULL
        OR NEW.external_key IS NOT ('public-inquiry:' || NEW.source_id)
        OR NOT EXISTS (
          SELECT 1 FROM inquiries i JOIN people p ON p.id = NEW.person_id
           WHERE i.id = NEW.source_id
             AND lower(trim(i.email)) = lower(trim(p.email))
             AND lower(trim(i.type)) IN ('student','parent','family','join as a student or family')
        )
      ))
      OR NEW.voided_at IS NOT NULL OR NEW.voided_by_user_id IS NOT NULL OR NEW.void_reason IS NOT NULL
    BEGIN
      SELECT RAISE(ABORT, 'Acquisition touchpoint evidence is invalid');
    END;

    DROP TRIGGER IF EXISTS trg_v7_touchpoint_update;
    CREATE TRIGGER trg_v7_touchpoint_update
    BEFORE UPDATE ON student_acquisition_touchpoints
    WHEN NEW.id IS NOT OLD.id OR NEW.person_id IS NOT OLD.person_id OR NEW.student_id IS NOT OLD.student_id
      OR NEW.channel_id IS NOT OLD.channel_id OR NEW.campaign_id IS NOT OLD.campaign_id
      OR NEW.contributor_id IS NOT OLD.contributor_id OR NEW.touchpoint_type IS NOT OLD.touchpoint_type
      OR NEW.occurred_at IS NOT OLD.occurred_at OR NEW.occurred_on IS NOT OLD.occurred_on
      OR NEW.timezone IS NOT OLD.timezone OR NEW.external_key IS NOT OLD.external_key
      OR NEW.detail IS NOT OLD.detail OR NEW.recorded_by_user_id IS NOT OLD.recorded_by_user_id
      OR NEW.source_type IS NOT OLD.source_type OR NEW.source_id IS NOT OLD.source_id
      OR NEW.created_at IS NOT OLD.created_at OR OLD.voided_at IS NOT NULL
      OR NEW.voided_at IS NULL OR NEW.voided_by_user_id IS NULL OR length(trim(COALESCE(NEW.void_reason,''))) < 10
      OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = NEW.voided_by_user_id AND u.status = 'active' AND u.role IN ('admin','growth'))
      OR EXISTS (
        SELECT 1 FROM student_acquisition_attributions a
         WHERE a.touchpoint_id = OLD.id AND a.effective_to IS NULL
      )
    BEGIN
      SELECT RAISE(ABORT, 'Acquisition touchpoints can only be voided with accountable evidence');
    END;

    DROP TRIGGER IF EXISTS trg_v7_touchpoint_void_referral;
    CREATE TRIGGER trg_v7_touchpoint_void_referral
    AFTER UPDATE OF voided_at ON student_acquisition_touchpoints
    WHEN OLD.voided_at IS NULL AND NEW.voided_at IS NOT NULL
    BEGIN
      UPDATE student_referrals
         SET voided_at = NEW.voided_at,
             voided_by_user_id = NEW.voided_by_user_id,
             void_reason = NEW.void_reason
       WHERE touchpoint_id = NEW.id AND voided_at IS NULL;
    END;

    DROP TRIGGER IF EXISTS trg_v7_touchpoint_no_delete;
    CREATE TRIGGER trg_v7_touchpoint_no_delete BEFORE DELETE ON student_acquisition_touchpoints
    BEGIN SELECT RAISE(ABORT, 'Acquisition touchpoints are append-only evidence'); END;

    DROP TRIGGER IF EXISTS trg_v7_attribution_insert;
    CREATE TRIGGER trg_v7_attribution_insert
    BEFORE INSERT ON student_acquisition_attributions
    WHEN NEW.method NOT IN (${ATTRIBUTION_METHODS})
      OR length(trim(NEW.evidence_note)) < 10 OR length(NEW.evidence_note) > 1000
      OR NEW.effective_from <= 0 OR NEW.effective_to IS NOT NULL
      OR NOT EXISTS (SELECT 1 FROM students s WHERE s.id = NEW.student_id)
      OR NOT EXISTS (
        SELECT 1 FROM student_acquisition_touchpoints t
        JOIN students s ON s.id = NEW.student_id
         WHERE t.id = NEW.touchpoint_id AND t.voided_at IS NULL
           AND (t.student_id = NEW.student_id OR (
             t.student_id IS NULL AND t.person_id IN (s.person_id, s.guardian_person_id)
           ))
      )
      OR NEW.decision_source NOT IN ('operator','migration')
      OR (NEW.decision_source = 'operator' AND (
        NEW.decision_source_id IS NOT NULL OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = NEW.decided_by_user_id AND u.status = 'active' AND u.role IN ('admin','growth'))
      ))
      OR (NEW.decision_source = 'migration' AND (
        NEW.decided_by_user_id IS NOT NULL OR NEW.decision_source_id <> '${OPERATING_SYSTEM_V7_GROWTH_MIGRATION_ID}'
      ))
    BEGIN
      SELECT RAISE(ABORT, 'Student acquisition attribution is invalid');
    END;

    DROP TRIGGER IF EXISTS trg_v7_attribution_update;
    CREATE TRIGGER trg_v7_attribution_update
    BEFORE UPDATE ON student_acquisition_attributions
    WHEN NEW.id IS NOT OLD.id OR NEW.student_id IS NOT OLD.student_id OR NEW.touchpoint_id IS NOT OLD.touchpoint_id
      OR NEW.method IS NOT OLD.method OR NEW.evidence_note IS NOT OLD.evidence_note
      OR NEW.effective_from IS NOT OLD.effective_from OR NEW.decided_by_user_id IS NOT OLD.decided_by_user_id
      OR NEW.decision_source IS NOT OLD.decision_source OR NEW.decision_source_id IS NOT OLD.decision_source_id
      OR NEW.created_at IS NOT OLD.created_at OR OLD.effective_to IS NOT NULL
      OR NEW.effective_to IS NULL OR NEW.effective_to <= OLD.effective_from
    BEGIN
      SELECT RAISE(ABORT, 'Student acquisition attribution history is immutable');
    END;

    DROP TRIGGER IF EXISTS trg_v7_attribution_no_delete;
    CREATE TRIGGER trg_v7_attribution_no_delete BEFORE DELETE ON student_acquisition_attributions
    BEGIN SELECT RAISE(ABORT, 'Student acquisition attribution is append-only history'); END;

    DROP TRIGGER IF EXISTS trg_v7_referral_insert;
    CREATE TRIGGER trg_v7_referral_insert
    BEFORE INSERT ON student_referrals
    WHEN NEW.referrer_person_id = NEW.referred_person_id
      OR NEW.touchpoint_id IS NULL OR NEW.submitted_at <= 0 OR NEW.created_at <= 0
      OR NEW.submitted_at > NEW.created_at + 300000
      OR NOT EXISTS (SELECT 1 FROM people p WHERE p.id = NEW.referrer_person_id)
      OR NOT EXISTS (SELECT 1 FROM people p WHERE p.id = NEW.referred_person_id)
      OR (NEW.referred_student_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM students s WHERE s.id = NEW.referred_student_id AND s.person_id = NEW.referred_person_id
      ))
      OR NOT EXISTS (
        SELECT 1 FROM student_acquisition_touchpoints t
        JOIN growth_channels ch ON ch.id = t.channel_id
         WHERE t.id = NEW.touchpoint_id AND t.voided_at IS NULL AND ch.category = 'referral'
           AND (t.person_id = NEW.referred_person_id OR t.student_id = NEW.referred_student_id)
           AND t.campaign_id IS NEW.campaign_id AND t.contributor_id IS NEW.contributor_id
      )
      OR length(trim(NEW.referral_code)) < 8 OR length(NEW.referral_code) > 80
      OR NEW.referral_code <> lower(NEW.referral_code) OR NEW.referral_code GLOB '*[^a-z0-9_-]*'
      OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = NEW.created_by_user_id AND u.status = 'active' AND u.role IN ('admin','growth'))
      OR NEW.voided_at IS NOT NULL OR NEW.voided_by_user_id IS NOT NULL OR NEW.void_reason IS NOT NULL
    BEGIN
      SELECT RAISE(ABORT, 'Student referral evidence is invalid');
    END;

    DROP TRIGGER IF EXISTS trg_v7_referral_update;
    CREATE TRIGGER trg_v7_referral_update
    BEFORE UPDATE ON student_referrals
    WHEN NEW.id IS NOT OLD.id OR NEW.referrer_person_id IS NOT OLD.referrer_person_id
      OR NEW.referred_person_id IS NOT OLD.referred_person_id OR NEW.touchpoint_id IS NOT OLD.touchpoint_id
      OR NEW.campaign_id IS NOT OLD.campaign_id OR NEW.contributor_id IS NOT OLD.contributor_id
      OR NEW.referral_code IS NOT OLD.referral_code OR NEW.submitted_at IS NOT OLD.submitted_at
      OR NEW.notes IS NOT OLD.notes OR NEW.created_by_user_id IS NOT OLD.created_by_user_id OR NEW.created_at IS NOT OLD.created_at
      OR (OLD.referred_student_id IS NOT NULL AND NEW.referred_student_id IS NOT OLD.referred_student_id)
      OR (OLD.referred_student_id IS NULL AND NEW.referred_student_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM students s WHERE s.id = NEW.referred_student_id AND s.person_id = NEW.referred_person_id
      ))
      OR (OLD.voided_at IS NOT NULL AND NEW.voided_at IS NOT OLD.voided_at)
      OR ((NEW.voided_at IS NULL) <> (NEW.voided_by_user_id IS NULL))
      OR ((NEW.voided_at IS NULL) <> (NEW.void_reason IS NULL))
      OR (NEW.voided_at IS NOT NULL AND length(trim(COALESCE(NEW.void_reason,''))) < 10)
      OR (NEW.voided_by_user_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM users u WHERE u.id = NEW.voided_by_user_id AND u.status = 'active' AND u.role IN ('admin','growth')
      ))
      OR (NEW.voided_at IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM student_acquisition_touchpoints t
         WHERE t.id = NEW.touchpoint_id AND t.voided_at = NEW.voided_at
           AND t.voided_by_user_id = NEW.voided_by_user_id AND t.void_reason = NEW.void_reason
      ))
    BEGIN
      SELECT RAISE(ABORT, 'Student referral history is immutable');
    END;

    DROP TRIGGER IF EXISTS trg_v7_referral_no_delete;
    CREATE TRIGGER trg_v7_referral_no_delete BEFORE DELETE ON student_referrals
    BEGIN SELECT RAISE(ABORT, 'Student referrals are durable evidence'); END;

    DROP TRIGGER IF EXISTS trg_v7_outcome_insert;
    CREATE TRIGGER trg_v7_outcome_insert
    BEFORE INSERT ON student_program_outcomes
    WHEN NEW.outcome_type NOT IN (${OUTCOME_TYPES})
      OR date(NEW.occurred_on) IS NULL OR date(NEW.occurred_on) <> NEW.occurred_on
      OR length(trim(NEW.evidence_note)) < 10 OR length(NEW.evidence_note) > 2000
      OR NOT EXISTS (SELECT 1 FROM students s WHERE s.id = NEW.student_id)
      OR NOT EXISTS (SELECT 1 FROM programs p WHERE p.id = NEW.program_id)
      OR NOT EXISTS (
        SELECT 1 FROM class_enrollments ce JOIN classes c ON c.id = ce.class_id
         WHERE ce.student_id = NEW.student_id AND c.program_id = NEW.program_id
      )
      OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = NEW.recorded_by_user_id AND u.status = 'active' AND u.role IN ('admin','growth'))
    BEGIN
      SELECT RAISE(ABORT, 'Student Program outcome evidence is invalid');
    END;

    DROP TRIGGER IF EXISTS trg_v7_outcome_no_update;
    CREATE TRIGGER trg_v7_outcome_no_update BEFORE UPDATE ON student_program_outcomes
    BEGIN SELECT RAISE(ABORT, 'Student Program outcomes are immutable evidence'); END;

    DROP TRIGGER IF EXISTS trg_v7_outcome_no_delete;
    CREATE TRIGGER trg_v7_outcome_no_delete BEFORE DELETE ON student_program_outcomes
    BEGIN SELECT RAISE(ABORT, 'Student Program outcomes are immutable evidence'); END;

    DROP TRIGGER IF EXISTS trg_v7_playbook_insert;
    CREATE TRIGGER trg_v7_playbook_insert
    BEFORE INSERT ON growth_playbooks
    WHEN length(trim(NEW.slug)) < 3 OR length(NEW.slug) > 100 OR NEW.slug <> lower(NEW.slug) OR NEW.slug GLOB '*[^a-z0-9-]*'
      OR length(trim(NEW.title)) < 3 OR length(NEW.title) > 180 OR NEW.status NOT IN (${PLAYBOOK_STATUSES})
      OR length(trim(NEW.problem)) < 20 OR length(NEW.problem) > 2000
      OR length(trim(NEW.play)) < 20 OR length(NEW.play) > 5000
      OR length(trim(NEW.evidence)) < 20 OR length(NEW.evidence) > 3000
      OR NOT EXISTS (
        SELECT 1 FROM growth_campaigns c WHERE c.id = NEW.source_campaign_id AND c.status = 'completed'
          AND c.result_value IS NOT NULL AND c.decision IS NOT NULL AND length(trim(COALESCE(c.learning,''))) >= 20
      )
      OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = NEW.owner_user_id AND u.status = 'active' AND u.role IN ('admin','growth'))
      OR (NEW.status = 'active' AND NEW.published_at IS NULL) OR (NEW.status = 'draft' AND NEW.published_at IS NOT NULL)
      OR NEW.updated_at < NEW.created_at
    BEGIN
      SELECT RAISE(ABORT, 'Growth playbook evidence is invalid');
    END;

    DROP TRIGGER IF EXISTS trg_v7_playbook_update;
    CREATE TRIGGER trg_v7_playbook_update
    BEFORE UPDATE ON growth_playbooks
    WHEN NEW.id IS NOT OLD.id OR NEW.slug IS NOT OLD.slug OR NEW.source_campaign_id IS NOT OLD.source_campaign_id
      OR NEW.created_at IS NOT OLD.created_at OR (OLD.status = 'retired' AND NEW.status IS NOT OLD.status)
      OR length(trim(NEW.title)) < 3 OR length(NEW.title) > 180 OR NEW.status NOT IN (${PLAYBOOK_STATUSES})
      OR length(trim(NEW.problem)) < 20 OR length(NEW.problem) > 2000
      OR length(trim(NEW.play)) < 20 OR length(NEW.play) > 5000
      OR length(trim(NEW.evidence)) < 20 OR length(NEW.evidence) > 3000
      OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = NEW.owner_user_id AND u.status = 'active' AND u.role IN ('admin','growth'))
      OR (NEW.status = 'active' AND NEW.published_at IS NULL) OR (NEW.status = 'draft' AND NEW.published_at IS NOT NULL)
      OR NEW.updated_at <= OLD.updated_at
    BEGIN
      SELECT RAISE(ABORT, 'Growth playbook evidence is invalid');
    END;

    DROP TRIGGER IF EXISTS trg_v7_playbook_no_delete;
    CREATE TRIGGER trg_v7_playbook_no_delete BEFORE DELETE ON growth_playbooks
    BEGIN SELECT RAISE(ABORT, 'Growth playbooks are durable organizational memory'); END;
  `);
}

function verifyV7Protections(db: DatabaseSync): void {
  const expectedTriggers: [string, string, string][] = [
    ["trg_v7_enrollment_confirmation_insert", "class_enrollments", "Enrollment confirmation evidence is invalid"],
    ["trg_v7_enrollment_confirmation_update", "class_enrollments", "Enrollment confirmation evidence is invalid"],
    ["trg_v7_enrollment_confirmation_immutable", "class_enrollments", "Enrollment confirmation evidence is immutable"],
    ["trg_v7_growth_channel_insert", "growth_channels", "Growth channel shape is invalid"],
    ["trg_v7_growth_channel_update", "growth_channels", "Growth channel shape is invalid"],
    ["trg_v7_growth_channel_no_delete", "growth_channels", "Growth channels are durable reference data"],
    ["trg_v7_growth_campaign_insert", "growth_campaigns", "Growth campaign evidence is invalid"],
    ["trg_v7_growth_campaign_update", "growth_campaigns", "Growth campaign evidence is invalid"],
    ["trg_v7_growth_campaign_no_delete", "growth_campaigns", "Growth campaigns are durable operating history"],
    ["trg_v7_contributor_insert", "growth_contributors", "Growth contributor lifecycle is invalid"],
    ["trg_v7_contributor_update", "growth_contributors", "Growth contributor lifecycle is invalid"],
    ["trg_v7_contributor_no_delete", "growth_contributors", "Growth contributors are durable operating history"],
    ["trg_v7_assignment_insert", "growth_assignments", "Growth assignment hierarchy is invalid"],
    ["trg_v7_assignment_update", "growth_assignments", "Growth assignment history is immutable"],
    ["trg_v7_assignment_no_delete", "growth_assignments", "Growth assignments are durable operating history"],
    ["trg_v7_goal_insert", "operating_goals", "Operating goal evidence is invalid"],
    ["trg_v7_goal_update", "operating_goals", "Operating goal evidence is invalid"],
    ["trg_v7_goal_no_delete", "operating_goals", "Operating goals are durable operating history"],
    ["trg_v7_touchpoint_insert", "student_acquisition_touchpoints", "Acquisition touchpoint evidence is invalid"],
    ["trg_v7_touchpoint_update", "student_acquisition_touchpoints", "Acquisition touchpoints can only be voided with accountable evidence"],
    ["trg_v7_touchpoint_no_delete", "student_acquisition_touchpoints", "Acquisition touchpoints are append-only evidence"],
    ["trg_v7_attribution_insert", "student_acquisition_attributions", "Student acquisition attribution is invalid"],
    ["trg_v7_attribution_update", "student_acquisition_attributions", "Student acquisition attribution history is immutable"],
    ["trg_v7_attribution_no_delete", "student_acquisition_attributions", "Student acquisition attribution is append-only history"],
    ["trg_v7_referral_insert", "student_referrals", "Student referral evidence is invalid"],
    ["trg_v7_referral_update", "student_referrals", "Student referral history is immutable"],
    ["trg_v7_referral_no_delete", "student_referrals", "Student referrals are durable evidence"],
    ["trg_v7_outcome_insert", "student_program_outcomes", "Student Program outcome evidence is invalid"],
    ["trg_v7_outcome_no_update", "student_program_outcomes", "Student Program outcomes are immutable evidence"],
    ["trg_v7_outcome_no_delete", "student_program_outcomes", "Student Program outcomes are immutable evidence"],
    ["trg_v7_playbook_insert", "growth_playbooks", "Growth playbook evidence is invalid"],
    ["trg_v7_playbook_update", "growth_playbooks", "Growth playbook evidence is invalid"],
    ["trg_v7_playbook_no_delete", "growth_playbooks", "Growth playbooks are durable organizational memory"],
  ];
  for (const [name, tableName, message] of expectedTriggers) {
    const row = db.prepare(
      "SELECT tbl_name, sql FROM sqlite_master WHERE type = 'trigger' AND name = ?",
    ).get(name) as unknown as { tbl_name: string; sql: string | null } | undefined;
    if (!row || row.tbl_name !== tableName || !normalizeSql(row.sql).includes(normalizeSql(`RAISE(ABORT, '${message}')`))) {
      throw new Error(`[bow:v7] Required growth-evidence trigger ${name} is missing or incorrect.`);
    }
  }
  const referralCascade = db.prepare(
    "SELECT tbl_name, sql FROM sqlite_master WHERE type = 'trigger' AND name = 'trg_v7_touchpoint_void_referral'",
  ).get() as unknown as { tbl_name: string; sql: string | null } | undefined;
  if (
    !referralCascade
    || referralCascade.tbl_name !== "student_acquisition_touchpoints"
    || !normalizeSql(referralCascade.sql).includes("update student_referrals")
  ) {
    throw new Error("[bow:v7] Required referral-evidence void cascade is missing or incorrect.");
  }

  const expectedIndexes: [string, string][] = [
    ["ux_v7_growth_channels_code", "growth_channels"],
    ["ux_v7_growth_contributors_person", "growth_contributors"],
    ["ux_v7_growth_assignments_current_contributor", "growth_assignments"],
    ["ux_v7_operating_goals_window", "operating_goals"],
    ["ux_v7_touchpoints_external_key", "student_acquisition_touchpoints"],
    ["ux_v7_attributions_current_student", "student_acquisition_attributions"],
    ["ux_v7_referrals_code", "student_referrals"],
    ["ux_v7_referrals_touchpoint", "student_referrals"],
    ["ux_v7_referrals_current_referred_person", "student_referrals"],
    ["ux_v7_student_program_outcomes_identity", "student_program_outcomes"],
    ["ux_v7_growth_playbooks_slug", "growth_playbooks"],
  ];
  for (const [name, tableName] of expectedIndexes) {
    const row = db.prepare(
      "SELECT tbl_name, sql FROM sqlite_master WHERE type = 'index' AND name = ?",
    ).get(name) as unknown as { tbl_name: string; sql: string | null } | undefined;
    if (!row || row.tbl_name !== tableName || !normalizeSql(row.sql).startsWith("create unique index")) {
      throw new Error(`[bow:v7] Required unique growth-evidence index ${name} is missing or incorrect.`);
    }
  }
}

export function verifyOperatingSystemV7GrowthHealth(db: DatabaseSync): void {
  assertV7Rows(db);
  verifyV7Protections(db);
}

function seedCanonicalGrowthChannels(db: DatabaseSync): void {
  const now = Date.now();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO growth_channels
      (id, code, name, category, status, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'active', ?, ?, ?)`,
  );
  for (const channel of GROWTH_CHANNELS) {
    insert.run(channel.id, channel.code, channel.name, channel.category, channel.description, now, now);
  }
}

function normalizePreV7TouchpointCalendarEvidence(db: DatabaseSync): void {
  // Rows can only predate the V7 marker in a development database that loaded
  // an earlier draft of this schema. Preserve the exact instant and label the
  // deterministic UTC calendar interpretation instead of guessing a city.
  db.exec(`UPDATE student_acquisition_touchpoints
              SET occurred_on = date(occurred_at / 1000, 'unixepoch'),
                  timezone = 'UTC'
            WHERE occurred_on IS NULL OR trim(occurred_on) = ''
               OR timezone IS NULL OR trim(timezone) = ''`);
}

function backfillLegacyLearnerInquiries(db: DatabaseSync): void {
  const learnerType = "lower(trim(i.type)) IN ('student','parent','family','join as a student or family')";
  const activityTime = `(SELECT MIN(a.created_at) FROM crm_activity a
    WHERE a.entity_type = 'inquiry' AND a.entity_id = i.id AND a.kind = 'submitted')`;
  const now = Date.now();
  db.prepare(
    `INSERT OR IGNORE INTO migration_conflicts
      (id, migration_id, entity_type, entity_key, detail, resolved_at, created_at)
     SELECT 'v7-inquiry-person:' || i.id, ?, 'inquiry', i.id,
            'Learner inquiry could not be linked to exactly one Person by normalized email; acquisition history was not guessed.',
            NULL, ?
       FROM inquiries i
      WHERE ${learnerType}
        AND ${activityTime} IS NOT NULL
        AND (SELECT COUNT(*) FROM people p WHERE lower(trim(p.email)) = lower(trim(i.email))) <> 1`,
  ).run(OPERATING_SYSTEM_V7_GROWTH_MIGRATION_ID, now);

  db.exec(
    `INSERT OR IGNORE INTO student_acquisition_touchpoints
      (id, person_id, student_id, channel_id, campaign_id, contributor_id, touchpoint_type,
       occurred_at, occurred_on, timezone, external_key, detail, recorded_by_user_id, source_type, source_id,
       voided_at, voided_by_user_id, void_reason, created_at)
     SELECT 'sat-legacy-' || i.id,
            (SELECT p.id FROM people p WHERE lower(trim(p.email)) = lower(trim(i.email)) LIMIT 1),
            NULL, 'gch-direct-inquiry', NULL, NULL, 'inquiry',
            ${activityTime}, date(${activityTime} / 1000, 'unixepoch'), 'UTC', 'public-inquiry:' || i.id,
            substr('Legacy public learner inquiry: ' || i.type || '. ' || i.summary, 1, 2000),
            NULL, 'public_inquiry', i.id, NULL, NULL, NULL, ${activityTime}
       FROM inquiries i
      WHERE ${learnerType}
        AND ${activityTime} IS NOT NULL
        AND (SELECT COUNT(*) FROM people p WHERE lower(trim(p.email)) = lower(trim(i.email))) = 1`,
  );

  const matchingTouchpoint = `(SELECT t.id
    FROM student_acquisition_touchpoints t
   WHERE t.voided_at IS NULL
     AND (t.person_id = s.person_id OR (
       t.person_id = s.guardian_person_id
       AND (SELECT COUNT(*) FROM students sibling WHERE sibling.guardian_person_id = s.guardian_person_id) = 1
     ))
   ORDER BY t.occurred_at, t.created_at, t.id
   LIMIT 1)`;
  db.prepare(
    `INSERT OR IGNORE INTO student_acquisition_attributions
      (id, student_id, touchpoint_id, method, evidence_note, effective_from, effective_to,
       decided_by_user_id, decision_source, decision_source_id, created_at)
     SELECT 'saa-v7-' || s.id, s.id, ${matchingTouchpoint}, 'direct',
            'Deterministic first-touch attribution linked during V7 migration from an exact Student Person or one-child guardian identity.',
            ?, NULL, NULL, 'migration', ?, ?
       FROM students s
      WHERE NOT EXISTS (
        SELECT 1 FROM student_acquisition_attributions current
         WHERE current.student_id = s.id AND current.effective_to IS NULL
      ) AND ${matchingTouchpoint} IS NOT NULL`,
  ).run(now, OPERATING_SYSTEM_V7_GROWTH_MIGRATION_ID, now);
}

export function runOperatingSystemV7GrowthMigration(db: DatabaseSync): void {
  const applied = db.prepare(
    "SELECT 1 FROM schema_migrations WHERE id = ?",
  ).get(OPERATING_SYSTEM_V7_GROWTH_MIGRATION_ID);
  if (applied) {
    verifyOperatingSystemV7GrowthHealth(db);
    return;
  }

  db.exec("SAVEPOINT bow_os_v7_growth_evidence");
  try {
    seedCanonicalGrowthChannels(db);
    normalizePreV7TouchpointCalendarEvidence(db);
    backfillLegacyLearnerInquiries(db);
    assertV7Rows(db);
    installV7Indexes(db);
    installV7Protections(db);
    verifyOperatingSystemV7GrowthHealth(db);
    db.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)")
      .run(OPERATING_SYSTEM_V7_GROWTH_MIGRATION_ID, Date.now());
    db.exec("RELEASE SAVEPOINT bow_os_v7_growth_evidence");
  } catch (error) {
    try {
      db.exec("ROLLBACK TO SAVEPOINT bow_os_v7_growth_evidence");
      db.exec("RELEASE SAVEPOINT bow_os_v7_growth_evidence");
    } catch {
      // Preserve the exact row or protection error that makes migration unsafe.
    }
    throw error;
  }
}

function verifyV8GrowthHardeningProtections(db: DatabaseSync): void {
  for (const triggerName of ["trg_v7_growth_campaign_insert", "trg_v7_growth_campaign_update"]) {
    const trigger = db.prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name = ?",
    ).get(triggerName) as unknown as { sql: string | null } | undefined;
    if (
      !trigger
      || !normalizeSql(trigger.sql).includes(normalizeSql(invalidCampaignLifecycleEvidence("NEW")))
    ) {
      throw new Error(`[bow:v8] Campaign lifecycle protection ${triggerName} is missing terminal evidence rules.`);
    }
  }
}

/**
 * V7 evolved through several pre-release hardening passes. This one-time
 * migration deliberately reinstalls the final V7 indexes and triggers for any
 * database that may already carry an earlier V7 marker, then records a new
 * marker so normal startup remains read-only afterward.
 */
export function runOperatingSystemV8GrowthHardeningMigration(db: DatabaseSync): void {
  const applied = db.prepare(
    "SELECT 1 FROM schema_migrations WHERE id = ?",
  ).get(OPERATING_SYSTEM_V8_GROWTH_HARDENING_MIGRATION_ID);
  if (applied) {
    verifyOperatingSystemV7GrowthHealth(db);
    verifyV8GrowthHardeningProtections(db);
    return;
  }

  db.exec("SAVEPOINT bow_os_v8_growth_lifecycle_hardening");
  try {
    assertV7Rows(db);
    installV7Indexes(db);
    installV7Protections(db);
    verifyOperatingSystemV7GrowthHealth(db);
    verifyV8GrowthHardeningProtections(db);
    db.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)")
      .run(OPERATING_SYSTEM_V8_GROWTH_HARDENING_MIGRATION_ID, Date.now());
    db.exec("RELEASE SAVEPOINT bow_os_v8_growth_lifecycle_hardening");
  } catch (error) {
    try {
      db.exec("ROLLBACK TO SAVEPOINT bow_os_v8_growth_lifecycle_hardening");
      db.exec("RELEASE SAVEPOINT bow_os_v8_growth_lifecycle_hardening");
    } catch {
      // Preserve the lifecycle row or trigger error that makes refresh unsafe.
    }
    throw error;
  }
}

function verifyV10ContributorLifecycleProtections(db: DatabaseSync): void {
  for (const triggerName of ["trg_v7_assignment_insert", "trg_v7_assignment_update"]) {
    const trigger = db.prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name = ?",
    ).get(triggerName) as unknown as { sql: string | null } | undefined;
    const sql = normalizeSql(trigger?.sql ?? null);
    if (!trigger || !sql.includes("closed_by_user_id") || !sql.includes("closure_reason")) {
      throw new Error(`[bow:v10] Assignment closure protection ${triggerName} is missing accountable evidence rules.`);
    }
  }
}

/**
 * Complete contributor lifecycle evidence without inventing the actor behind
 * a legacy terminal assignment. New closures require an accountable staff
 * user and reason; older terminal rows remain immutable and are surfaced as a
 * migration conflict for explicit reconciliation.
 */
export function runOperatingSystemV10GrowthLifecycleMigration(db: DatabaseSync): void {
  const applied = db.prepare(
    "SELECT 1 FROM schema_migrations WHERE id = ?",
  ).get(OPERATING_SYSTEM_V10_GROWTH_LIFECYCLE_MIGRATION_ID);
  if (applied) {
    verifyOperatingSystemV7GrowthHealth(db);
    verifyV10ContributorLifecycleProtections(db);
    return;
  }

  db.exec("SAVEPOINT bow_os_v10_contributor_lifecycle");
  try {
    const now = Date.now();
    db.prepare(
      `INSERT OR IGNORE INTO migration_conflicts
        (id, migration_id, entity_type, entity_key, detail, resolved_at, created_at)
       SELECT 'v10-assignment-closure:' || a.id, ?, 'growth_assignment', a.id,
              'Terminal assignment predates accountable closure evidence; actor and reason were not guessed.',
              NULL, ?
         FROM growth_assignments a
        WHERE a.status <> 'active' AND a.closed_by_user_id IS NULL AND a.closure_reason IS NULL`,
    ).run(OPERATING_SYSTEM_V10_GROWTH_LIFECYCLE_MIGRATION_ID, now);
    assertV7Rows(db);
    installV7Indexes(db);
    installV7Protections(db);
    verifyOperatingSystemV7GrowthHealth(db);
    verifyV10ContributorLifecycleProtections(db);
    db.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)")
      .run(OPERATING_SYSTEM_V10_GROWTH_LIFECYCLE_MIGRATION_ID, now);
    db.exec("RELEASE SAVEPOINT bow_os_v10_contributor_lifecycle");
  } catch (error) {
    try {
      db.exec("ROLLBACK TO SAVEPOINT bow_os_v10_contributor_lifecycle");
      db.exec("RELEASE SAVEPOINT bow_os_v10_contributor_lifecycle");
    } catch {
      // Preserve the historical row or protection error that makes migration unsafe.
    }
    throw error;
  }
}
