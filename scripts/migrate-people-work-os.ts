/**
 * BOW People & Work Engine v1 — incremental Postgres migration.
 *
 * This migration is intentionally explicit and never runs during a request.
 * Run with a direct/non-pooling connection after taking a database backup:
 *   npm run db:migrate:people-work
 */

import postgres from "postgres";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const MIGRATION_ID = "2026-07-21-people-work-instructor-recruitment-v1";
const targetUrl = (
  process.env.POSTGRES_URL_NON_POOLING
  ?? process.env.DATABASE_URL_NON_POOLING
  ?? process.env.DATABASE_URL
  ?? process.env.POSTGRES_URL
  ?? ""
).trim();

if (!targetUrl) throw new Error("Missing POSTGRES_URL_NON_POOLING (preferred) or POSTGRES_URL.");

const sql = postgres(targetUrl, { prepare: false, max: 1, connect_timeout: 20 });

async function main() {
  // Conflicts are recorded outside the schema transaction so a deliberate stop
  // does not erase the operator's reconciliation list.
  await sql.unsafe(`CREATE TABLE IF NOT EXISTS people_work_migration_conflicts (
    id text PRIMARY KEY,
    migration_id text NOT NULL,
    conflict_type text NOT NULL,
    entity_key text NOT NULL,
    detail text NOT NULL,
    resolved_at double precision,
    created_at double precision NOT NULL
  )`);
  const conflictNow = Date.now();
  await sql.unsafe(`INSERT INTO people_work_migration_conflicts
    (id, migration_id, conflict_type, entity_key, detail, created_at)
    SELECT 'pw-duplicate-email-' || md5(lower(trim(p.email))), $1, 'ambiguous_identity', lower(trim(p.email)),
           'Multiple canonical People share this normalized email; public intake must not guess an identity.', $2
      FROM people p WHERE trim(p.email) <> ''
     GROUP BY lower(trim(p.email)) HAVING COUNT(*) > 1
    ON CONFLICT (id) DO NOTHING`, [MIGRATION_ID, conflictNow]);
  await sql.unsafe(`INSERT INTO people_work_migration_conflicts
    (id, migration_id, conflict_type, entity_key, detail, created_at)
    SELECT 'pw-duplicate-instructor-' || i.person_id, $1, 'duplicate_active_application', i.person_id,
           'More than one current instructor record maps to the same Person and default Opening.', $2
      FROM instructors i WHERE i.stage <> 'rejected'
     GROUP BY i.person_id HAVING COUNT(*) > 1
    ON CONFLICT (id) DO NOTHING`, [MIGRATION_ID, conflictNow]);
  const unresolved = await sql.unsafe<{ count: string }[]>(
    "SELECT COUNT(*)::text AS count FROM people_work_migration_conflicts WHERE migration_id = $1 AND resolved_at IS NULL",
    [MIGRATION_ID],
  );
  if (Number(unresolved[0]?.count ?? 0) > 0) {
    throw new Error("People & Work migration stopped: resolve rows in people_work_migration_conflicts, set resolved_at, and rerun.");
  }
  await sql.begin(async (tx) => {
    await tx.unsafe(`CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      applied_at double precision NOT NULL
    )`);
    const applied = await tx.unsafe<{ id: string }[]>(
      "SELECT id FROM schema_migrations WHERE id = $1",
      [MIGRATION_ID],
    );
    if (applied.length) return;

    await tx.unsafe(`ALTER TABLE people
      ADD COLUMN IF NOT EXISTS identity_status text NOT NULL DEFAULT 'inactive'`);
    await tx.unsafe(`ALTER TABLE people
      DROP CONSTRAINT IF EXISTS people_identity_status_check`);
    await tx.unsafe(`ALTER TABLE people
      ADD CONSTRAINT people_identity_status_check
      CHECK (identity_status IN ('active','inactive','alumni','removed'))`);
    await tx.unsafe(`UPDATE people p SET identity_status = 'active'
      WHERE p.user_id IS NOT NULL
         OR EXISTS (SELECT 1 FROM instructors i WHERE i.person_id = p.id AND i.stage = 'active')`);

    await tx.unsafe(`CREATE TABLE organization_units (
      id text PRIMARY KEY,
      parent_id text REFERENCES organization_units(id),
      unit_type text NOT NULL,
      name text NOT NULL,
      status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
      created_at double precision NOT NULL,
      updated_at double precision NOT NULL
    )`);
    await tx.unsafe(`CREATE INDEX idx_organization_units_parent ON organization_units(parent_id, status)`);

    await tx.unsafe(`CREATE TABLE org_roles (
      id text PRIMARY KEY,
      organization_unit_id text REFERENCES organization_units(id),
      title text NOT NULL,
      purpose text NOT NULL DEFAULT '',
      responsibilities text NOT NULL DEFAULT '[]',
      success_metrics text NOT NULL DEFAULT '[]',
      default_autonomy integer NOT NULL DEFAULT 2 CHECK (default_autonomy BETWEEN 1 AND 4),
      review_cadence text NOT NULL DEFAULT 'quarterly',
      status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
      created_at double precision NOT NULL,
      updated_at double precision NOT NULL
    )`);

    await tx.unsafe(`CREATE TABLE org_positions (
      id text PRIMARY KEY,
      role_id text NOT NULL REFERENCES org_roles(id),
      organization_unit_id text NOT NULL REFERENCES organization_units(id),
      title text NOT NULL,
      scope_description text,
      status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','filled','paused','closed')),
      created_at double precision NOT NULL,
      updated_at double precision NOT NULL
    )`);

    await tx.unsafe(`CREATE TABLE role_assignments (
      id text PRIMARY KEY,
      person_id text NOT NULL REFERENCES people(id),
      role_id text NOT NULL REFERENCES org_roles(id),
      organization_unit_id text NOT NULL REFERENCES organization_units(id),
      position_id text REFERENCES org_positions(id),
      manager_assignment_id text REFERENCES role_assignments(id),
      engagement_type text NOT NULL DEFAULT 'volunteer'
        CHECK (engagement_type IN ('volunteer','employee','contractor','other')),
      status text NOT NULL DEFAULT 'activating'
        CHECK (status IN ('activating','active','paused','ended','revoked')),
      is_primary boolean NOT NULL DEFAULT false,
      autonomy_level integer NOT NULL DEFAULT 2 CHECK (autonomy_level BETWEEN 1 AND 4),
      starts_on text NOT NULL,
      ends_on text,
      created_at double precision NOT NULL,
      updated_at double precision NOT NULL,
      CHECK (ends_on IS NULL OR ends_on >= starts_on)
    )`);
    await tx.unsafe(`CREATE INDEX idx_role_assignments_person ON role_assignments(person_id, status)`);
    await tx.unsafe(`CREATE INDEX idx_role_assignments_manager ON role_assignments(manager_assignment_id, status)`);
    await tx.unsafe(`CREATE UNIQUE INDEX idx_role_assignments_primary_active
      ON role_assignments(person_id) WHERE is_primary AND status IN ('activating','active','paused')`);

    await tx.unsafe(`CREATE TABLE capabilities (
      key text PRIMARY KEY,
      description text NOT NULL
    )`);
    await tx.unsafe(`CREATE TABLE app_role_capabilities (
      app_role text NOT NULL,
      capability_key text NOT NULL REFERENCES capabilities(key),
      PRIMARY KEY (app_role, capability_key)
    )`);

    await tx.unsafe(`CREATE TABLE requirement_definitions (
      id text PRIMARY KEY,
      code text NOT NULL UNIQUE,
      title text NOT NULL,
      requirement_type text NOT NULL CHECK (requirement_type IN
        ('training','certification','code_of_conduct','safeguarding','partner','guardian','other')),
      description text NOT NULL DEFAULT '',
      status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
      created_at double precision NOT NULL,
      updated_at double precision NOT NULL
    )`);
    await tx.unsafe(`CREATE TABLE requirement_rules (
      id text PRIMARY KEY,
      requirement_id text NOT NULL REFERENCES requirement_definitions(id),
      scope_type text NOT NULL CHECK (scope_type IN ('role','position','opening','program','assignment')),
      scope_id text NOT NULL,
      required boolean NOT NULL DEFAULT true,
      exception_allowed boolean NOT NULL DEFAULT false,
      created_at double precision NOT NULL,
      UNIQUE (requirement_id, scope_type, scope_id)
    )`);
    await tx.unsafe(`CREATE TABLE person_requirement_evidence (
      id text PRIMARY KEY,
      person_id text NOT NULL REFERENCES people(id),
      requirement_id text NOT NULL REFERENCES requirement_definitions(id),
      status text NOT NULL CHECK (status IN ('pending','satisfied','expired','waived','rejected')),
      evidence text,
      decided_by_user_id text REFERENCES users(id),
      valid_from text,
      valid_until text,
      created_at double precision NOT NULL,
      updated_at double precision NOT NULL
    )`);
    await tx.unsafe(`CREATE INDEX idx_person_requirements ON person_requirement_evidence(person_id, requirement_id, status)`);

    await tx.unsafe(`CREATE TABLE responsibilities (
      id text PRIMARY KEY,
      title text NOT NULL,
      success_definition text NOT NULL,
      organization_unit_id text REFERENCES organization_units(id),
      accountable_assignment_id text REFERENCES role_assignments(id),
      backup_assignment_id text REFERENCES role_assignments(id),
      review_cadence text NOT NULL DEFAULT 'monthly',
      status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','ended')),
      created_at double precision NOT NULL,
      updated_at double precision NOT NULL
    )`);
    await tx.unsafe(`CREATE TABLE outcomes (
      id text PRIMARY KEY,
      responsibility_id text REFERENCES responsibilities(id),
      title text NOT NULL,
      expected_result text NOT NULL,
      accountable_assignment_id text REFERENCES role_assignments(id),
      due_on text,
      status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','achieved','missed','canceled')),
      result_evidence text,
      created_at double precision NOT NULL,
      updated_at double precision NOT NULL
    )`);

    await tx.unsafe(`CREATE TABLE hiring_processes (
      id text PRIMARY KEY,
      name text NOT NULL,
      status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
      created_at double precision NOT NULL,
      updated_at double precision NOT NULL
    )`);
    await tx.unsafe(`CREATE TABLE hiring_process_versions (
      id text PRIMARY KEY,
      hiring_process_id text NOT NULL REFERENCES hiring_processes(id),
      version integer NOT NULL,
      status text NOT NULL CHECK (status IN ('draft','published','retired')),
      published_at double precision,
      created_by_user_id text REFERENCES users(id),
      created_at double precision NOT NULL,
      UNIQUE (hiring_process_id, version)
    )`);
    await tx.unsafe(`CREATE TABLE question_set_versions (
      id text PRIMARY KEY,
      name text NOT NULL,
      version integer NOT NULL,
      questions text NOT NULL DEFAULT '[]',
      status text NOT NULL CHECK (status IN ('draft','published','retired')),
      published_at double precision,
      created_at double precision NOT NULL
    )`);
    await tx.unsafe(`CREATE TABLE scorecard_versions (
      id text PRIMARY KEY,
      name text NOT NULL,
      version integer NOT NULL,
      criteria text NOT NULL DEFAULT '[]',
      status text NOT NULL CHECK (status IN ('draft','published','retired')),
      published_at double precision,
      created_at double precision NOT NULL
    )`);
    await tx.unsafe(`CREATE TABLE communication_template_versions (
      id text PRIMARY KEY,
      name text NOT NULL,
      version integer NOT NULL,
      subject text NOT NULL,
      body text NOT NULL,
      status text NOT NULL CHECK (status IN ('draft','published','retired')),
      published_at double precision,
      created_at double precision NOT NULL
    )`);
    await tx.unsafe(`CREATE TABLE onboarding_template_versions (
      id text PRIMARY KEY,
      name text NOT NULL,
      version integer NOT NULL,
      requirements text NOT NULL DEFAULT '[]',
      status text NOT NULL CHECK (status IN ('draft','published','retired')),
      published_at double precision,
      created_at double precision NOT NULL
    )`);
    await tx.unsafe(`CREATE TABLE hiring_stage_versions (
      id text PRIMARY KEY,
      process_version_id text NOT NULL REFERENCES hiring_process_versions(id),
      stage_key text NOT NULL,
      title text NOT NULL,
      stage_type text NOT NULL CHECK (stage_type IN
        ('application','screen','interview','work_sample','teaching_demo','decision','onboarding')),
      ordinal integer NOT NULL,
      instructions text NOT NULL DEFAULT '',
      sla_hours integer,
      question_set_version_id text REFERENCES question_set_versions(id),
      scorecard_version_id text REFERENCES scorecard_versions(id),
      communication_template_version_id text REFERENCES communication_template_versions(id),
      UNIQUE (process_version_id, ordinal),
      UNIQUE (process_version_id, stage_key)
    )`);

    await tx.unsafe(`CREATE TABLE hiring_requisitions (
      id text PRIMARY KEY,
      role_id text NOT NULL REFERENCES org_roles(id),
      organization_unit_id text NOT NULL REFERENCES organization_units(id),
      hiring_owner_user_id text REFERENCES users(id),
      title text NOT NULL,
      target_headcount integer NOT NULL CHECK (target_headcount > 0),
      needed_by text,
      demand_source_type text,
      demand_source_id text,
      status text NOT NULL DEFAULT 'open' CHECK (status IN ('draft','open','paused','filled','canceled')),
      created_at double precision NOT NULL,
      updated_at double precision NOT NULL
    )`);
    await tx.unsafe(`CREATE TABLE openings (
      id text PRIMARY KEY,
      requisition_id text NOT NULL REFERENCES hiring_requisitions(id),
      slug text NOT NULL UNIQUE,
      status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','paused','closed')),
      current_version_id text,
      created_at double precision NOT NULL,
      updated_at double precision NOT NULL
    )`);
    await tx.unsafe(`CREATE TABLE opening_versions (
      id text PRIMARY KEY,
      opening_id text NOT NULL REFERENCES openings(id),
      version integer NOT NULL,
      process_version_id text NOT NULL REFERENCES hiring_process_versions(id),
      onboarding_template_version_id text REFERENCES onboarding_template_versions(id),
      title text NOT NULL,
      summary text NOT NULL,
      description text NOT NULL,
      responsibilities text NOT NULL DEFAULT '[]',
      time_commitment text NOT NULL,
      engagement_types text NOT NULL DEFAULT '[]',
      eligibility text NOT NULL DEFAULT '[]',
      application_question_set_version_id text REFERENCES question_set_versions(id),
      status text NOT NULL CHECK (status IN ('draft','published','retired')),
      published_at double precision,
      created_at double precision NOT NULL,
      UNIQUE (opening_id, version)
    )`);
    await tx.unsafe(`ALTER TABLE openings
      ADD CONSTRAINT openings_current_version_fk FOREIGN KEY (current_version_id) REFERENCES opening_versions(id)`);
    await tx.unsafe(`CREATE OR REPLACE FUNCTION bow_protect_published_version() RETURNS trigger AS $$
      BEGIN
        IF TG_OP = 'DELETE' AND OLD.status = 'published' THEN
          RAISE EXCEPTION 'Published versions are immutable';
        END IF;
        IF TG_OP = 'UPDATE' AND OLD.status = 'published' AND
           ((to_jsonb(NEW) - 'status') IS DISTINCT FROM (to_jsonb(OLD) - 'status') OR NEW.status NOT IN ('published','retired')) THEN
          RAISE EXCEPTION 'Published versions are immutable';
        END IF;
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
      END;
    $$ LANGUAGE plpgsql`);
    for (const table of [
      "hiring_process_versions", "opening_versions", "question_set_versions", "scorecard_versions",
      "communication_template_versions", "onboarding_template_versions",
    ]) {
      await tx.unsafe(`CREATE TRIGGER protect_${table}_published
        BEFORE UPDATE OR DELETE ON ${table} FOR EACH ROW EXECUTE FUNCTION bow_protect_published_version()`);
    }
    await tx.unsafe(`CREATE OR REPLACE FUNCTION bow_protect_published_stage() RETURNS trigger AS $$
      BEGIN
        IF EXISTS (SELECT 1 FROM hiring_process_versions hpv WHERE hpv.id = OLD.process_version_id AND hpv.status = 'published') THEN
          RAISE EXCEPTION 'Stages in a published hiring process are immutable';
        END IF;
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
      END;
    $$ LANGUAGE plpgsql`);
    await tx.unsafe(`CREATE TRIGGER protect_published_hiring_stages
      BEFORE UPDATE OR DELETE ON hiring_stage_versions FOR EACH ROW EXECUTE FUNCTION bow_protect_published_stage()`);

    await tx.unsafe(`CREATE TABLE applications (
      id text PRIMARY KEY,
      person_id text NOT NULL REFERENCES people(id),
      opening_id text NOT NULL REFERENCES openings(id),
      opening_version_id text NOT NULL REFERENCES opening_versions(id),
      process_version_id text NOT NULL REFERENCES hiring_process_versions(id),
      current_stage_version_id text NOT NULL REFERENCES hiring_stage_versions(id),
      lifecycle_status text NOT NULL CHECK (lifecycle_status IN
        ('applied','screening','interviewing','decision','accepted','rejected','withdrawn')),
      owner_user_id text REFERENCES users(id),
      next_action text,
      next_action_owner_user_id text REFERENCES users(id),
      next_action_due_at double precision,
      waiting_on text,
      waiting_expected_at double precision,
      source text,
      source_detail text,
      campaign text,
      referrer_person_id text REFERENCES people(id),
      answers text NOT NULL DEFAULT '{}',
      revision integer NOT NULL DEFAULT 1,
      decided_by_user_id text REFERENCES users(id),
      decided_at double precision,
      created_at double precision NOT NULL,
      updated_at double precision NOT NULL,
      CHECK (next_action IS NOT NULL OR waiting_on IS NOT NULL OR lifecycle_status IN ('accepted','rejected','withdrawn'))
    )`);
    await tx.unsafe(`CREATE UNIQUE INDEX idx_applications_one_active_per_opening
      ON applications(person_id, opening_id)
      WHERE lifecycle_status NOT IN ('rejected','withdrawn')`);
    await tx.unsafe(`CREATE INDEX idx_applications_attention ON applications(lifecycle_status, next_action_due_at, waiting_expected_at)`);
    await tx.unsafe(`CREATE TABLE application_stage_events (
      id text PRIMARY KEY,
      application_id text NOT NULL REFERENCES applications(id),
      from_stage_version_id text REFERENCES hiring_stage_versions(id),
      to_stage_version_id text NOT NULL REFERENCES hiring_stage_versions(id),
      event_type text NOT NULL CHECK (event_type IN ('created','advanced','returned','accepted','rejected','withdrawn','migrated')),
      note text,
      actor_user_id text REFERENCES users(id),
      created_at double precision NOT NULL
    )`);
    await tx.unsafe(`CREATE INDEX idx_application_stage_events ON application_stage_events(application_id, created_at)`);

    await tx.unsafe(`CREATE TABLE interview_events (
      id text PRIMARY KEY,
      application_id text NOT NULL REFERENCES applications(id),
      stage_version_id text NOT NULL REFERENCES hiring_stage_versions(id),
      interviewer_user_ids text NOT NULL DEFAULT '[]',
      scheduled_at double precision,
      timezone text,
      duration_minutes integer,
      location_type text CHECK (location_type IN ('video','phone','in_person')),
      meeting_link_or_location text,
      status text NOT NULL DEFAULT 'needs_scheduling' CHECK (status IN
        ('needs_scheduling','scheduled','rescheduled','completed','canceled','no_show')),
      revision integer NOT NULL DEFAULT 1,
      created_at double precision NOT NULL,
      updated_at double precision NOT NULL
    )`);
    await tx.unsafe(`CREATE TABLE interview_event_history (
      id text PRIMARY KEY,
      interview_event_id text NOT NULL REFERENCES interview_events(id),
      event_type text NOT NULL,
      prior_value text,
      next_value text,
      actor_user_id text REFERENCES users(id),
      created_at double precision NOT NULL
    )`);
    await tx.unsafe(`CREATE TABLE evaluations (
      id text PRIMARY KEY,
      application_id text NOT NULL REFERENCES applications(id),
      stage_version_id text NOT NULL REFERENCES hiring_stage_versions(id),
      scorecard_version_id text NOT NULL REFERENCES scorecard_versions(id),
      evaluator_user_id text NOT NULL REFERENCES users(id),
      responses text NOT NULL DEFAULT '{}',
      evidence_note text NOT NULL,
      recommendation text NOT NULL CHECK (recommendation IN ('strong_hire','hire','continue','do_not_hire')),
      submitted_at double precision NOT NULL
    )`);
    await tx.unsafe(`CREATE TABLE candidate_communications (
      id text PRIMARY KEY,
      application_id text NOT NULL REFERENCES applications(id),
      interview_event_id text REFERENCES interview_events(id),
      template_version_id text REFERENCES communication_template_versions(id),
      channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email','notification','phone','in_person')),
      recipient text NOT NULL,
      subject text,
      body text NOT NULL,
      status text NOT NULL CHECK (status IN ('draft','queued','sent','failed','canceled')),
      idempotency_key text NOT NULL UNIQUE,
      failure_detail text,
      created_by_user_id text REFERENCES users(id),
      created_at double precision NOT NULL,
      sent_at double precision
    )`);

    await tx.unsafe(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS workflow_state text`);
    await tx.unsafe(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS doer_user_id text REFERENCES users(id)`);
    await tx.unsafe(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigner_user_id text REFERENCES users(id)`);
    await tx.unsafe(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reviewer_user_id text REFERENCES users(id)`);
    await tx.unsafe(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS expected_result text`);
    await tx.unsafe(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS definition_of_done text`);
    await tx.unsafe(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS evidence_requirement text`);
    await tx.unsafe(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS review_required boolean NOT NULL DEFAULT false`);
    await tx.unsafe(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS autonomy_level integer`);
    await tx.unsafe(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS role_assignment_id text REFERENCES role_assignments(id)`);
    await tx.unsafe(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS responsibility_id text REFERENCES responsibilities(id)`);
    await tx.unsafe(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS outcome_id text REFERENCES outcomes(id)`);
    await tx.unsafe(`UPDATE tasks SET workflow_state = CASE WHEN status = 'done' THEN 'approved' ELSE 'assigned' END
      WHERE workflow_state IS NULL`);
    await tx.unsafe(`ALTER TABLE tasks ALTER COLUMN workflow_state SET NOT NULL`);
    await tx.unsafe(`ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_workflow_state_check`);
    await tx.unsafe(`ALTER TABLE tasks ADD CONSTRAINT tasks_workflow_state_check CHECK (workflow_state IN
      ('assigned','in_progress','submitted','revision_requested','approved','rejected','canceled'))`);

    await tx.unsafe(`CREATE TABLE task_events (
      id text PRIMARY KEY,
      task_id text NOT NULL REFERENCES tasks(id),
      event_type text NOT NULL,
      prior_value text,
      next_value text,
      reason text,
      actor_user_id text REFERENCES users(id),
      created_at double precision NOT NULL
    )`);
    await tx.unsafe(`CREATE INDEX idx_task_events ON task_events(task_id, created_at)`);
    await tx.unsafe(`CREATE TABLE work_submissions (
      id text PRIMARY KEY,
      task_id text NOT NULL REFERENCES tasks(id),
      revision integer NOT NULL,
      result_summary text NOT NULL,
      evidence_links text NOT NULL DEFAULT '[]',
      blockers text,
      submitted_by_user_id text NOT NULL REFERENCES users(id),
      submitted_at double precision NOT NULL,
      UNIQUE (task_id, revision)
    )`);
    await tx.unsafe(`CREATE TABLE work_reviews (
      id text PRIMARY KEY,
      submission_id text NOT NULL REFERENCES work_submissions(id),
      reviewer_user_id text NOT NULL REFERENCES users(id),
      decision text NOT NULL CHECK (decision IN ('excellent','meets_standard','needs_revision','unacceptable')),
      completeness text NOT NULL CHECK (completeness IN ('complete','incomplete')),
      feedback text NOT NULL,
      revision_instructions text,
      reviewed_at double precision NOT NULL
    )`);
    await tx.unsafe(`CREATE UNIQUE INDEX idx_work_reviews_one_per_submission ON work_reviews(submission_id)`);
    await tx.unsafe(`CREATE TABLE performance_events (
      id text PRIMARY KEY,
      person_id text NOT NULL REFERENCES people(id),
      role_assignment_id text REFERENCES role_assignments(id),
      source_type text NOT NULL CHECK (source_type IN ('work_approval','work_review','system_reliability','outcome','feedback','qualification')),
      source_id text NOT NULL,
      dimension text NOT NULL CHECK (dimension IN ('output','reliability','quality','impact','coachability')),
      signal text NOT NULL,
      detail text,
      actor_user_id text REFERENCES users(id),
      created_at double precision NOT NULL,
      UNIQUE (source_type, source_id, dimension)
    )`);

    const now = Date.now();
    const neededBy = new Date(now + 120 * 86400000).toISOString().slice(0, 10);
    const applicationQuestions = JSON.stringify([
      { key: "location", label: "City / location", type: "text", required: true },
      { key: "experience", label: "Relevant experience", type: "textarea", required: true },
      { key: "whyBow", label: "Why BOW?", type: "textarea", required: true },
      { key: "availability", label: "Availability", type: "textarea", required: true },
      { key: "source", label: "How did you hear about BOW?", type: "select", required: true,
        options: ["BOW website","Instructor referral","Friend or family","School or partner","LinkedIn","Instagram","Other"] },
    ]);
    const interviewCriteria = JSON.stringify([
      "communication","reliability_indicators","coachability","mission_alignment","relevant_experience",
    ]);
    const teachCriteria = JSON.stringify([
      "clarity","engagement","age_appropriateness","adaptability","concept_command","preparation",
    ]);

    await tx.unsafe(`INSERT INTO organization_units (id, parent_id, unit_type, name, status, created_at, updated_at)
      VALUES ('ou-bow', NULL, 'organization', 'BOW Sports Capital', 'active', $1, $1),
             ('ou-instructor-ops', 'ou-bow', 'function', 'Instructor Operations', 'active', $1, $1)`, [now]);
    await tx.unsafe(`INSERT INTO org_roles
      (id, organization_unit_id, title, purpose, responsibilities, success_metrics, default_autonomy, review_cadence, status, created_at, updated_at)
      VALUES ('role-sports-econ-instructor', 'ou-instructor-ops', 'Sports Economics Instructor',
      'Help young people understand economics, finance, leadership, and strategy through sports-business decisions.',
      $1, $2, 2, 'quarterly', 'active', $3, $3)`, [
        JSON.stringify(["Prepare and teach BOW curriculum", "Create an engaging and reliable learning environment", "Complete session evidence and coaching follow-up"]),
        JSON.stringify(["Reliable delivery", "Clear instruction", "Student engagement", "Timely session closeout"]),
        now,
      ]);
    await tx.unsafe(`INSERT INTO hiring_processes (id, name, status, created_at, updated_at)
      VALUES ('hp-instructor-standard', 'Instructor Standard Hiring Process', 'active', $1, $1)`, [now]);
    await tx.unsafe(`INSERT INTO hiring_process_versions
      (id, hiring_process_id, version, status, published_at, created_at)
      VALUES ('hpv-instructor-v1', 'hp-instructor-standard', 1, 'published', $1, $1)`, [now]);
    await tx.unsafe(`INSERT INTO question_set_versions (id, name, version, questions, status, published_at, created_at)
      VALUES ('qsv-instructor-application-v1', 'Instructor Application', 1, $1, 'published', $2, $2),
             ('qsv-instructor-interview-v1', 'Instructor Interview Questions', 1, $3, 'published', $2, $2)`, [
        applicationQuestions,
        now,
        JSON.stringify([
          { key: "motivation", label: "Why do you want to teach with BOW?", required: true },
          { key: "reliability", label: "Tell us about a commitment you had to recover when something changed.", required: true },
          { key: "coaching", label: "Describe a time feedback changed your approach.", required: true },
        ]),
      ]);
    await tx.unsafe(`INSERT INTO scorecard_versions (id, name, version, criteria, status, published_at, created_at)
      VALUES ('scv-instructor-interview-v1', 'Instructor Interview', 1, $1, 'published', $3, $3),
             ('scv-mini-teach-v1', 'Instructor Mini-Teach', 1, $2, 'published', $3, $3)`, [interviewCriteria, teachCriteria, now]);
    await tx.unsafe(`INSERT INTO onboarding_template_versions (id, name, version, requirements, status, published_at, created_at)
      VALUES ('otv-instructor-v1', 'Instructor Onboarding', 1, $1, 'published', $2, $2)`, [
        JSON.stringify([
          { kind: "training", title: "Complete BOW instructor onboarding" },
          { kind: "account_action", title: "Accept BOW instructor invitation" },
          { kind: "work", title: "Submit first-session preparation plan" },
        ]),
        now,
      ]);
    await tx.unsafe(`INSERT INTO hiring_stage_versions
      (id, process_version_id, stage_key, title, stage_type, ordinal, instructions, sla_hours, question_set_version_id, scorecard_version_id)
      VALUES
      ('hsv-application-v1','hpv-instructor-v1','application','Application','application',1,'Review the configured application evidence.',48,'qsv-instructor-application-v1',NULL),
      ('hsv-screen-v1','hpv-instructor-v1','screen','Screen','screen',2,'Confirm baseline role fit and required follow-up.',48,NULL,NULL),
      ('hsv-interview-v1','hpv-instructor-v1','interview','Interview','interview',3,'Run the standard instructor interview.',72,'qsv-instructor-interview-v1','scv-instructor-interview-v1'),
      ('hsv-mini-teach-v1','hpv-instructor-v1','mini_teach','Mini-Teach','teaching_demo',4,'Evaluate a short BOW teaching demonstration.',72,NULL,'scv-mini-teach-v1'),
      ('hsv-decision-v1','hpv-instructor-v1','decision','Decision','decision',5,'Make and record the evidence-based hiring decision.',72,NULL,NULL),
      ('hsv-onboarding-v1','hpv-instructor-v1','onboarding','Onboarding','onboarding',6,'Complete activation requirements and first manager action.',NULL,NULL,NULL)`);
    await tx.unsafe(`INSERT INTO hiring_requisitions
      (id, role_id, organization_unit_id, hiring_owner_user_id, title, target_headcount, needed_by, status, created_at, updated_at)
      SELECT 'hrq-instructors-v1', 'role-sports-econ-instructor', 'ou-instructor-ops',
             (SELECT id FROM users WHERE role = 'admin' AND status = 'active' ORDER BY created_at LIMIT 1),
             'Recruit Sports Economics Instructors', 10, $1, 'open', $2, $2`, [neededBy, now]);
    await tx.unsafe(`INSERT INTO openings (id, requisition_id, slug, status, current_version_id, created_at, updated_at)
      VALUES ('opening-sports-econ-instructor', 'hrq-instructors-v1', 'sports-economics-instructor', 'draft', NULL, $1, $1)`, [now]);
    await tx.unsafe(`INSERT INTO opening_versions
      (id, opening_id, version, process_version_id, onboarding_template_version_id, title, summary, description,
       responsibilities, time_commitment, engagement_types, eligibility, application_question_set_version_id,
       status, published_at, created_at)
      VALUES ('ov-sports-econ-instructor-v1', 'opening-sports-econ-instructor', 1, 'hpv-instructor-v1', 'otv-instructor-v1',
      'Sports Economics Instructor',
      'Teach young people economics, finance, leadership, and strategy through the decisions that shape sports.',
      'BOW instructors help students learn by doing: making front-office decisions, explaining tradeoffs, and seeing consequences.',
      $1, 'A flexible part-time commitment based on program demand and instructor availability.',
      $2, $3, 'qsv-instructor-application-v1', 'published', $4, $4)`, [
        JSON.stringify(["Prepare BOW lessons", "Lead engaging instruction", "Complete session evidence", "Respond to coaching"]),
        JSON.stringify(["volunteer", "contractor", "other"]),
        JSON.stringify(["Required BOW training", "Passing mini-teach", "Configured safeguarding and partner requirements before protected assignments"]),
        now,
      ]);
    await tx.unsafe(`UPDATE openings SET status = 'published', current_version_id = 'ov-sports-econ-instructor-v1', updated_at = $1
      WHERE id = 'opening-sports-econ-instructor'`, [now]);

    await tx.unsafe(`INSERT INTO requirement_definitions
      (id, code, title, requirement_type, description, status, created_at, updated_at)
      VALUES
      ('req-instructor-training','instructor_training','BOW instructor training','training','Complete required BOW instructor training.','active',$1,$1),
      ('req-mini-teach','mini_teach_pass','Passing mini-teach','certification','Record a passing mini-teach evaluation.','active',$1,$1),
      ('req-code-conduct','code_of_conduct','Code of conduct','code_of_conduct','Acknowledge the current BOW code of conduct.','active',$1,$1),
      ('req-safeguarding','safeguarding','Safeguarding eligibility','safeguarding','Record the configured safeguarding evidence before protected teaching assignments.','active',$1,$1)`, [now]);
    await tx.unsafe(`INSERT INTO requirement_rules (id, requirement_id, scope_type, scope_id, required, exception_allowed, created_at)
      VALUES
      ('rr-instructor-training','req-instructor-training','role','role-sports-econ-instructor',true,false,$1),
      ('rr-mini-teach','req-mini-teach','role','role-sports-econ-instructor',true,false,$1),
      ('rr-code-conduct','req-code-conduct','role','role-sports-econ-instructor',true,false,$1),
      ('rr-safeguarding','req-safeguarding','role','role-sports-econ-instructor',true,true,$1)`, [now]);

    const capabilityRows = [
      ["hiring.configure", "Configure roles, processes, requisitions, and openings."],
      ["hiring.opening.publish", "Publish a versioned opening."],
      ["hiring.application.advance", "Advance a candidate through configured stages."],
      ["hiring.application.decide", "Accept or reject an application."],
      ["work.assign.team", "Assign Work within the operating team."],
      ["work.assign.orgwide", "Assign Work across BOW."],
      ["work.review", "Review submitted Work."],
      ["people.assignment.manage", "Manage role assignments and reporting relationships."],
    ];
    for (const [key, description] of capabilityRows) {
      await tx.unsafe("INSERT INTO capabilities (key, description) VALUES ($1, $2)", [key, description]);
      await tx.unsafe("INSERT INTO app_role_capabilities (app_role, capability_key) VALUES ('admin', $1)", [key]);
    }
    for (const key of ["hiring.application.advance", "work.assign.team", "work.review"]) {
      await tx.unsafe("INSERT INTO app_role_capabilities (app_role, capability_key) VALUES ('growth', $1)", [key]);
    }

    await tx.unsafe(`INSERT INTO applications
      (id, person_id, opening_id, opening_version_id, process_version_id, current_stage_version_id, lifecycle_status,
       owner_user_id, next_action, next_action_owner_user_id, next_action_due_at, source, answers, revision, created_at, updated_at)
      SELECT i.id, i.person_id, 'opening-sports-econ-instructor', 'ov-sports-econ-instructor-v1', 'hpv-instructor-v1',
        CASE i.stage
          WHEN 'applied' THEN 'hsv-application-v1'
          WHEN 'reviewing' THEN 'hsv-screen-v1'
          WHEN 'interview_scheduled' THEN 'hsv-interview-v1'
          WHEN 'interviewed' THEN 'hsv-interview-v1'
          WHEN 'founder_review' THEN 'hsv-decision-v1'
          WHEN 'rejected' THEN 'hsv-decision-v1'
          ELSE 'hsv-onboarding-v1'
        END,
        CASE
          WHEN i.stage = 'rejected' THEN 'rejected'
          WHEN i.stage IN ('accepted','onboarding','training','practice_evaluation','eligible','active') THEN 'accepted'
          WHEN i.stage = 'founder_review' THEN 'decision'
          WHEN i.stage IN ('interview_scheduled','interviewed') THEN 'interviewing'
          WHEN i.stage = 'reviewing' THEN 'screening'
          ELSE 'applied'
        END,
        i.owner_user_id,
        CASE WHEN i.stage IN ('rejected','accepted','onboarding','training','practice_evaluation','eligible','active') THEN NULL
             WHEN i.stage = 'founder_review' THEN 'Record hiring decision'
             WHEN i.stage = 'interview_scheduled' THEN 'Complete interview and scorecard'
             WHEN i.stage = 'interviewed' THEN 'Review interview evidence'
             ELSE 'Review application' END,
        i.owner_user_id,
        CASE WHEN i.stage IN ('rejected','accepted','onboarding','training','practice_evaluation','eligible','active') THEN NULL
             ELSE i.updated_at + 172800000 END,
        i.source, i.answers, 1, i.created_at, i.updated_at
      FROM instructors i`);
    await tx.unsafe(`INSERT INTO application_stage_events
      (id, application_id, from_stage_version_id, to_stage_version_id, event_type, note, actor_user_id, created_at)
      SELECT 'ase-backfill-' || i.id, i.id, NULL, a.current_stage_version_id, 'migrated',
             'Backfilled from the existing canonical instructor pipeline.', NULL, $1
      FROM instructors i JOIN applications a ON a.id = i.id`, [now]);

    const newTables = [
      "organization_units", "org_roles", "org_positions", "role_assignments", "capabilities", "app_role_capabilities",
      "requirement_definitions", "requirement_rules", "person_requirement_evidence", "responsibilities", "outcomes",
      "hiring_processes", "hiring_process_versions", "question_set_versions", "scorecard_versions",
      "communication_template_versions", "onboarding_template_versions", "hiring_stage_versions", "hiring_requisitions",
      "openings", "opening_versions", "applications", "application_stage_events", "interview_events",
      "interview_event_history", "evaluations", "candidate_communications", "task_events", "work_submissions",
      "work_reviews", "performance_events",
    ];
    for (const table of newTables) await tx.unsafe(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);

    await tx.unsafe("INSERT INTO schema_migrations (id, applied_at) VALUES ($1, $2)", [MIGRATION_ID, now]);
  });
}

void main()
  .then(() => process.stdout.write(`Applied ${MIGRATION_ID}.\n`))
  .finally(() => sql.end({ timeout: 5 }))
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
