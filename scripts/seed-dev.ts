/* ============================================================
 * scripts/seed-dev.ts — representative development / QA seed data.
 *
 * Idempotent: every statement is an upsert keyed on a stable `dev-*` id, so
 * re-running refreshes the fixture without duplicating it. Dates are
 * computed relative to "now" on each run so the "today"/"overdue"/"upcoming"
 * cases stay meaningful however long after seeding you look at them.
 *
 * What it covers, deliberately, is the state each portal has to render:
 *   - founder/admin: an overdue task, a founder handoff, a pending
 *     applicant decision, an unstaffed class, a program awaiting renewal
 *   - instructor: one active+eligible instructor with a session today, a
 *     past session missing its report, and one mid-onboarding instructor
 *     with an incomplete required training module
 *   - student: an enrolled student with an upcoming session
 *
 * Usage: `npm run db:seed` (or `npm run db:setup -- --seed`).
 *
 * Auth: if NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY +
 * SEED_PASSWORD are set, each seeded user also gets a Supabase Auth
 * identity with that password so the portal can actually be signed into
 * locally. Without them the domain data still seeds and the step is
 * skipped — no production auth behaviour is changed either way.
 *
 * Local/CI only: refuses to run against a non-loopback database host
 * unless ALLOW_REMOTE_DB_SETUP=1.
 * ============================================================ */

import postgres from "postgres";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const NOW = Date.now();
const DAY = 86_400_000;
const day = (offset: number) => NOW + offset * DAY;
/**
 * Offset days from now, pinned to a wall-clock hour (UTC). Class sessions
 * need a plausible time of day — seeding them at "now o'clock" makes the
 * student and instructor screens read "Today · 2:46 AM".
 */
const dayAt = (offset: number, hour: number) => {
  const d = new Date(day(offset));
  d.setUTCHours(hour, 0, 0, 0);
  return d.getTime();
};
const onDate = (offset: number) => new Date(day(offset)).toISOString().slice(0, 10);

function connectionUrl(): string {
  const value = (
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    ""
  ).trim();
  if (!value) throw new Error("[seed] Missing POSTGRES_URL_NON_POOLING / POSTGRES_URL.");
  return value;
}

function assertLocal(url: string): void {
  if (process.env.ALLOW_REMOTE_DB_SETUP === "1") return;
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    /* non-URL DSNs fall through */
  }
  if (!(host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "")) {
    throw new Error(
      `[seed] Refusing to seed non-local host "${host}". Set ALLOW_REMOTE_DB_SETUP=1 if certain.`,
    );
  }
}

/** Seed accounts. Password comes from SEED_PASSWORD; never hardcoded. */
const SEED_USERS = [
  { id: "u-admin", name: "Dana Whitfield", first: "Dana", email: "dana@bowsportscapital.org", role: "admin", orgId: "org-bow" },
  { id: "u-growth", name: "Jordan Fields", first: "Jordan", email: "jordan@bowsportscapital.org", role: "growth", orgId: "org-bow" },
  { id: "u-coach", name: "Marcus Reyes", first: "Marcus", email: "marcus.reyes@lincolnhs.edu", role: "instructor", orgId: "org-school" },
  { id: "u-coach2", name: "Priya Anand", first: "Priya", email: "priya.anand@example.com", role: "instructor", orgId: "org-school" },
  { id: "u-s1", name: "Jalen Brooks", first: "Jalen", email: "jalen.b@lincolnhs.edu", role: "student", orgId: "org-school", grade: "Grades 6–9" },
  { id: "u-s2", name: "Maya Chen", first: "Maya", email: "maya.c@lincolnhs.edu", role: "student", orgId: "org-school", grade: "Grades 6–9" },
  { id: "u-s3", name: "Diego Santos", first: "Diego", email: "diego.s@lincolnhs.edu", role: "student", orgId: "org-school", grade: "Grades 6–9" },
] as const;

async function seedDomain(sql: postgres.Sql): Promise<void> {
  // --- organizations & users -------------------------------------------
  await sql`
    INSERT INTO organizations (id, name, type, location, status) VALUES
      ('org-bow', 'BOW Sports Capital', 'BOW', 'Remote', 'active'),
      ('org-school', 'Lincoln High School', 'school', 'Lincoln, NE', 'active'),
      ('org-youth', 'Eastside Youth Alliance', 'nonprofit', 'Omaha, NE', 'active'),
      -- A real relationship where nothing is decided yet: format, sections,
      -- dates and staffing are all open. Partners has to render this as a
      -- normal state ("Still deciding"), not as an incomplete record.
      ('org-ramaz', 'Ramaz School', 'school', 'New York, NY', 'prospect')
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status
  `;

  for (const u of SEED_USERS) {
    await sql`
      INSERT INTO users (id, name, first, email, role, org_id, grade, status, created_at)
      VALUES (${u.id}, ${u.name}, ${u.first}, ${u.email}, ${u.role}, ${u.orgId},
              ${"grade" in u ? u.grade : null}, 'active', ${NOW})
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name, email = EXCLUDED.email, role = EXCLUDED.role,
        org_id = EXCLUDED.org_id, status = 'active'
    `;
  }

  // --- people ------------------------------------------------------------
  const people: [string, string, string, string | null][] = [
    ["person-dana", "Dana Whitfield", "dana@bowsportscapital.org", "u-admin"],
    ["person-marcus", "Marcus Reyes", "marcus.reyes@lincolnhs.edu", "u-coach"],
    ["person-priya", "Priya Anand", "priya.anand@example.com", "u-coach2"],
    ["person-jalen", "Jalen Brooks", "jalen.b@lincolnhs.edu", "u-s1"],
    ["person-maya", "Maya Chen", "maya.c@lincolnhs.edu", "u-s2"],
    ["person-diego", "Diego Santos", "diego.s@lincolnhs.edu", "u-s3"],
    ["person-coach-applicant", "Tasha Blake", "tasha.blake@example.com", null],
    ["person-partner-contact", "Ray Ellis", "ray.ellis@lincolnhs.edu", null],
  ];
  for (const [id, name, email, userId] of people) {
    await sql`
      INSERT INTO people (id, name, email, user_id, created_at, updated_at)
      VALUES (${id}, ${name}, ${email}, ${userId}, ${day(-90)}, ${NOW})
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name, email = EXCLUDED.email, user_id = EXCLUDED.user_id, updated_at = ${NOW}
    `;
  }

  // --- geography & partners ---------------------------------------------
  await sql`
    INSERT INTO operating_regions (id, name, code, leader_user_id, timezone, stage, created_at, updated_at)
    VALUES ('dev-region-midwest', 'Midwest', 'MW', 'u-growth', 'America/Chicago', 'active', ${day(-120)}, ${NOW})
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = ${NOW}
  `;
  await sql`
    INSERT INTO locations (id, name, type, region_id, city, state, timezone, primary_leader_user_id, stage, capacity, created_at, updated_at)
    VALUES
      ('dev-loc-lincoln', 'Lincoln High School', 'school', 'dev-region-midwest', 'Lincoln', 'NE', 'America/Chicago', 'u-growth', 'active', 40, ${day(-120)}, ${NOW}),
      -- deliberately leaderless: exercises the growth "leadership gap" exception
      ('dev-loc-omaha', 'Omaha Community Center', 'community', 'dev-region-midwest', 'Omaha', 'NE', 'America/Chicago', NULL, 'launching', 25, ${day(-40)}, ${NOW})
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = ${NOW}
  `;
  await sql`
    INSERT INTO partner_orgs (id, name, slug, org_type, contact_name, contact_email, created_at)
    VALUES
      ('dev-partner-lincoln', 'Lincoln High School', 'lincoln-high', 'school', 'Ray Ellis', 'ray.ellis@lincolnhs.edu', ${day(-120)}),
      ('dev-partner-eastside', 'Eastside Youth Alliance', 'eastside-youth', 'nonprofit', 'Nina Ortiz', 'nina@eastsideyouth.org', ${day(-60)})
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
  `;

  // --- curriculum & programs ---------------------------------------------
  await sql`
    INSERT INTO curricula (id, title, description, age_range, published, created_at, updated_at)
    VALUES ('dev-curr-101', 'Front Office 101', 'Introduction to basketball operations, scouting and the cap.', 'Grades 6–9', 1, ${day(-120)}, ${NOW})
    ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, updated_at = ${NOW}
  `;
  // programs.partner_org_id and classes.partner_org_id hold an ORGANIZATIONS id:
  // that is what /app/programs/new writes and what lib/operations.ts resolves the
  // partner name from. This seed used to write partner_orgs ids (the branded
  // marketing pages), so every partner record showed no programs and no classes.
  // partner_orgs stays a separate thing, reached by slug from the public site.
  await sql`
    INSERT INTO programs (id, name, partner_org_id, location_id, curriculum_id, audience, delivery_format,
                          stage, start_date, end_date, capacity, minimum_enrollment, owner_user_id,
                          partner_confirmed, materials_status, renewal_status, is_public, public_status,
                          short_description, grade_range, created_at, updated_at)
    VALUES
      ('dev-prog-lincoln-fall', 'Lincoln Fall — Front Office 101', 'org-school', 'dev-loc-lincoln',
       'dev-curr-101', 'Grades 6–9', 'in_person', 'active', ${onDate(-30)}, ${onDate(45)}, 30, 8, 'u-growth',
       1, 'ready', 'not_due', true, 'open', 'Learn how a front office really works.', 'Grades 6–9', ${day(-60)}, ${NOW}),
      -- awaiting a launch decision: no confirmed partner, materials not ready
      ('dev-prog-omaha-spring', 'Omaha Spring — Front Office 101', 'org-youth', 'dev-loc-omaha',
       'dev-curr-101', 'Grades 8–10', 'in_person', 'launching', ${onDate(21)}, ${onDate(90)}, 25, 8, 'u-growth',
       0, 'not_ready', 'not_due', false, NULL, 'Spring cohort pending launch decision.', 'Grades 8–10', ${day(-20)}, ${NOW}),
      -- finished and due for renewal: a founder follow-up
      ('dev-prog-lincoln-spring', 'Lincoln Spring — Front Office 101', 'org-school', 'dev-loc-lincoln',
       'dev-curr-101', 'Grades 6–9', 'in_person', 'completed', ${onDate(-180)}, ${onDate(-95)}, 30, 8, 'u-growth',
       1, 'ready', 'due', false, NULL, 'Completed cohort awaiting renewal conversation.', 'Grades 6–9', ${day(-200)}, ${NOW})
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, stage = EXCLUDED.stage,
      renewal_status = EXCLUDED.renewal_status, partner_org_id = EXCLUDED.partner_org_id, updated_at = ${NOW}
  `;

  // --- instructors --------------------------------------------------------
  await sql`
    INSERT INTO instructors (id, person_id, stage, source, owner_user_id, onboarding_status, training_status,
                             eligibility_status, progression_level, max_weekly_classes, created_at, updated_at)
    VALUES
      ('dev-instr-marcus', 'person-marcus', 'active', 'referral', 'u-admin', 'complete', 'complete', 'eligible', 'lead_instructor', 3, ${day(-150)}, ${NOW}),
      ('dev-instr-priya', 'person-priya', 'training', 'application', 'u-admin', 'complete', 'in_progress', 'not_eligible', 'instructor', 2, ${day(-25)}, ${NOW}),
      -- awaiting a founder decision after interview: the headline founder queue item
      ('dev-instr-tasha', 'person-coach-applicant', 'interviewed', 'application', 'u-admin', 'not_started', 'not_started', 'not_eligible', 'instructor', 3, ${day(-9)}, ${NOW})
    ON CONFLICT (id) DO UPDATE SET stage = EXCLUDED.stage, onboarding_status = EXCLUDED.onboarding_status,
      training_status = EXCLUDED.training_status, eligibility_status = EXCLUDED.eligibility_status, updated_at = ${NOW}
  `;
  await sql`
    UPDATE instructors SET interview_at = ${day(-3)}, interview_timezone = 'America/Chicago',
      interview_notes = 'Strong on player development; wants a Lincoln slot.'
    WHERE id = 'dev-instr-tasha'
  `;
  await sql`
    INSERT INTO instructor_availability (id, instructor_id, day_of_week, start_time, end_time, created_at)
    VALUES
      ('dev-avail-marcus-tue', 'dev-instr-marcus', 2, '16:00', '18:00', ${day(-100)}),
      ('dev-avail-marcus-thu', 'dev-instr-marcus', 4, '16:00', '18:00', ${day(-100)})
    ON CONFLICT (id) DO NOTHING
  `;
  await sql`
    INSERT INTO instructor_qualifications (id, instructor_id, kind, value, status, approved_by, approved_at, created_at, updated_at)
    VALUES ('dev-qual-marcus-bg', 'dev-instr-marcus', 'background_check', 'cleared', 'approved', 'u-admin', ${day(-140)}, ${day(-145)}, ${NOW})
    ON CONFLICT (id) DO NOTHING
  `;

  // --- training -----------------------------------------------------------
  await sql`
    INSERT INTO training_modules (id, title, category, required, content_type, content, ordinal, active, created_at, updated_at)
    VALUES
      ('dev-tm-safety', 'Student Safety & Conduct', 'onboarding', 1, 'text', 'Ground rules for working with students.', 1, 1, ${day(-160)}, ${NOW}),
      ('dev-tm-delivery', 'Delivering a BOW Session', 'teaching', 1, 'text', 'How a session is structured end to end.', 2, 1, ${day(-160)}, ${NOW}),
      ('dev-tm-feedback', 'Coaching Feedback', 'teaching', 0, 'text', 'Giving students useful feedback.', 3, 1, ${day(-160)}, ${NOW})
    ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, updated_at = ${NOW}
  `;
  await sql`
    INSERT INTO training_module_completions (id, instructor_id, module_id, completed_at)
    VALUES
      ('dev-tmc-marcus-safety', 'dev-instr-marcus', 'dev-tm-safety', ${day(-140)}),
      ('dev-tmc-marcus-delivery', 'dev-instr-marcus', 'dev-tm-delivery', ${day(-138)}),
      -- Priya has safety done, delivery outstanding: her instructor home shows the gap
      ('dev-tmc-priya-safety', 'dev-instr-priya', 'dev-tm-safety', ${day(-10)})
    ON CONFLICT (id) DO NOTHING
  `;

  // --- students -----------------------------------------------------------
  await sql`
    INSERT INTO students (id, name, age, grade, email, school, enrollment_status, form_status, user_id, person_id, created_at, updated_at)
    VALUES
      ('dev-stu-jalen', 'Jalen Brooks', 14, '9', 'jalen.b@lincolnhs.edu', 'Lincoln High School', 'active', 'complete', 'u-s1', 'person-jalen', ${day(-50)}, ${NOW}),
      ('dev-stu-maya', 'Maya Chen', 13, '8', 'maya.c@lincolnhs.edu', 'Lincoln High School', 'active', 'complete', 'u-s2', 'person-maya', ${day(-50)}, ${NOW}),
      ('dev-stu-diego', 'Diego Santos', 13, '8', 'diego.s@lincolnhs.edu', 'Lincoln High School', 'active', 'missing', 'u-s3', 'person-diego', ${day(-20)}, ${NOW})
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, form_status = EXCLUDED.form_status, updated_at = ${NOW}
  `;

  // --- classes, sessions, roster -----------------------------------------
  await sql`
    INSERT INTO classes (id, title, curriculum_id, partner_org_id, program_id, location_id, start_date, end_date,
                         recurrence, schedule_day, schedule_start_time, schedule_end_time, schedule_timezone,
                         age_range, capacity, minimum_enrollment, lead_instructor_id, status, created_at, updated_at)
    VALUES
      ('dev-class-lincoln-a', 'Lincoln Fall — Tuesday Squad', 'dev-curr-101', 'org-school', 'dev-prog-lincoln-fall',
       'dev-loc-lincoln', ${onDate(-30)}, ${onDate(45)}, 'weekly', 2, '16:00', '17:30', 'America/Chicago',
       'Grades 6–9', 15, 8, 'dev-instr-marcus', 'active', ${day(-60)}, ${NOW}),
      -- no lead instructor: the founder's unstaffed-class exception
      ('dev-class-omaha-a', 'Omaha Spring — Thursday Squad', 'dev-curr-101', 'org-youth', 'dev-prog-omaha-spring',
       'dev-loc-omaha', ${onDate(21)}, ${onDate(90)}, 'weekly', 4, '17:00', '18:30', 'America/Chicago',
       'Grades 8–10', 15, 8, NULL, 'planning', ${day(-20)}, ${NOW})
    ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, status = EXCLUDED.status,
      lead_instructor_id = EXCLUDED.lead_instructor_id, partner_org_id = EXCLUDED.partner_org_id, updated_at = ${NOW}
  `;
  await sql`
    INSERT INTO class_instructors (id, class_id, instructor_id, role, assigned_by, added_at)
    VALUES ('dev-ci-marcus-lincoln', 'dev-class-lincoln-a', 'dev-instr-marcus', 'lead', 'u-admin', ${day(-58)})
    ON CONFLICT (id) DO NOTHING
  `;
  await sql`
    INSERT INTO class_sessions (id, class_id, session_date, session_on, timezone, location, created_at)
    VALUES
      -- past, and deliberately missing its report: the instructor follow-up case
      ('dev-sess-past', 'dev-class-lincoln-a', ${dayAt(-7, 16)}, ${onDate(-7)}, 'America/Chicago', 'Lincoln HS — Gym B', ${day(-60)}),
      ('dev-sess-reported', 'dev-class-lincoln-a', ${dayAt(-14, 16)}, ${onDate(-14)}, 'America/Chicago', 'Lincoln HS — Gym B', ${day(-60)}),
      ('dev-sess-today', 'dev-class-lincoln-a', ${dayAt(0, 16)}, ${onDate(0)}, 'America/Chicago', 'Lincoln HS — Gym B', ${day(-60)}),
      ('dev-sess-next', 'dev-class-lincoln-a', ${dayAt(7, 16)}, ${onDate(7)}, 'America/Chicago', 'Lincoln HS — Gym B', ${day(-60)}),
      ('dev-sess-later', 'dev-class-lincoln-a', ${dayAt(14, 16)}, ${onDate(14)}, 'America/Chicago', 'Lincoln HS — Gym B', ${day(-60)})
    ON CONFLICT (id) DO UPDATE SET session_date = EXCLUDED.session_date, session_on = EXCLUDED.session_on
  `;
  await sql`
    INSERT INTO class_session_reports (id, session_id, notes, flagged, completed, reported_by, reported_at)
    VALUES ('dev-report-reported', 'dev-sess-reported', 'Cap-space exercise landed well. Diego needs a catch-up on scouting.', 0, 1, 'u-coach', ${day(-14)})
    ON CONFLICT (id) DO NOTHING
  `;
  await sql`
    INSERT INTO class_enrollments (id, class_id, student_id, status, enrolled_at, confirmed_at)
    VALUES
      ('dev-enr-jalen', 'dev-class-lincoln-a', 'dev-stu-jalen', 'enrolled', ${day(-45)}, ${day(-45)}),
      ('dev-enr-maya', 'dev-class-lincoln-a', 'dev-stu-maya', 'enrolled', ${day(-45)}, ${day(-45)}),
      ('dev-enr-diego', 'dev-class-lincoln-a', 'dev-stu-diego', 'enrolled', ${day(-18)}, NULL)
    ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status
  `;
  // Every session carries a locked roster snapshot, exactly as createClassSession
  // and the registration engine write one. Without it a seeded session cannot
  // take attendance at all (recordAttendance refuses an empty roster), so the
  // "instructor with a session today" case was unreachable in a browser.
  await sql`
    INSERT INTO class_session_roster (id, session_id, student_id, enrollment_id, rostered_at)
    SELECT 'dev-csr-' || cs.id || '-' || ce.student_id, cs.id, ce.student_id, ce.id, ${day(-45)}
      FROM class_sessions cs
      JOIN class_enrollments ce ON ce.class_id = cs.class_id AND ce.status = 'enrolled'
     WHERE cs.class_id = 'dev-class-lincoln-a'
    ON CONFLICT (id) DO NOTHING
  `;
  await sql`
    INSERT INTO attendance_records (id, session_id, student_id, present, status, recorded_by, recorded_at)
    VALUES
      ('dev-att-jalen-reported', 'dev-sess-reported', 'dev-stu-jalen', 1, 'present', 'u-coach', ${day(-14)}),
      ('dev-att-maya-reported', 'dev-sess-reported', 'dev-stu-maya', 1, 'present', 'u-coach', ${day(-14)}),
      ('dev-att-diego-reported', 'dev-sess-reported', 'dev-stu-diego', 0, 'absent', 'u-coach', ${day(-14)})
    ON CONFLICT (id) DO NOTHING
  `;

  // --- work queue ----------------------------------------------------------
  await sql`
    INSERT INTO tasks (id, title, owner_user_id, doer_user_id, due_at, due_on, status, workflow_state, kind, priority,
                       context, recommended_action, entity_type, entity_id, handoff_to_founder, created_at, updated_at)
    VALUES
      ('dev-task-decide-tasha', 'Decide on Tasha Blake after interview', 'u-admin', 'u-admin', ${day(-2)}, ${onDate(-2)},
       'open', 'assigned', 'decision', 'high', 'Interviewed 3 days ago; Lincoln needs a second instructor before the spring cohort.',
       'Record an offer or decline decision.', 'instructor', 'dev-instr-tasha', 1, ${day(-3)}, ${NOW}),
      ('dev-task-staff-omaha', 'Staff a lead instructor for Omaha Spring', 'u-growth', 'u-growth', ${day(5)}, ${onDate(5)},
       'open', 'assigned', 'operations', 'high', 'Omaha Spring starts in three weeks with no lead instructor assigned.',
       'Assign a lead instructor to the Thursday squad.', 'class', 'dev-class-omaha-a', 0, ${day(-6)}, ${NOW}),
      ('dev-task-renewal-lincoln', 'Open the Lincoln Spring renewal conversation', 'u-growth', 'u-growth', ${day(9)}, ${onDate(9)},
       'open', 'assigned', 'follow_up', 'medium', 'Lincoln Spring finished 3 months ago and renewal is now due.',
       'Contact Ray Ellis about a spring renewal.', 'program', 'dev-prog-lincoln-spring', 0, ${day(-4)}, ${NOW}),
      ('dev-task-session-report', 'File the missing session report', 'u-coach', 'u-coach', ${day(-1)}, ${onDate(-1)},
       'open', 'assigned', 'follow_up', 'medium', 'The Tuesday squad session a week ago has no report on file.',
       'Record what happened and flag anything that needs follow-up.', 'class_session', 'dev-sess-past', 0, ${day(-6)}, ${NOW}),
      ('dev-task-diego-forms', 'Chase Diego Santos'' enrollment forms', 'u-growth', 'u-growth', ${day(3)}, ${onDate(3)},
       'open', 'assigned', 'follow_up', 'medium', 'Diego is attending but his enrollment paperwork is still missing.',
       'Follow up with the family for the enrollment form.', 'student', 'dev-stu-diego', 0, ${day(-5)}, ${NOW})
    ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, due_at = EXCLUDED.due_at,
      due_on = EXCLUDED.due_on, updated_at = ${NOW}
  `;

  // --- growth --------------------------------------------------------------
  await sql`
    INSERT INTO growth_channels (id, code, name, category, status, created_at, updated_at)
    VALUES
      ('dev-chan-referral', 'referral', 'Family referral', 'organic', 'active', ${day(-200)}, ${NOW}),
      ('dev-chan-partner', 'partner', 'School partnership', 'partnership', 'active', ${day(-200)}, ${NOW})
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = ${NOW}
  `;
  await sql`
    INSERT INTO growth_campaigns (id, name, channel_id, owner_user_id, region_id, location_id, hypothesis, status,
                                  starts_on, ends_on, target_metric, target_value, budget_cents, spend_cents,
                                  created_by_user_id, created_at, updated_at)
    VALUES ('dev-camp-lincoln', 'Lincoln parent-night push', 'dev-chan-partner', 'u-growth', 'dev-region-midwest',
            'dev-loc-lincoln', 'A parent night at Lincoln converts more families than email alone.', 'active',
            ${onDate(-30)}, ${onDate(20)}, 'enrollments', 25, 50000, 61000, 'u-growth', ${day(-32)}, ${NOW})
    ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, spend_cents = EXCLUDED.spend_cents, updated_at = ${NOW}
  `;
  await sql`
    INSERT INTO operating_goals (id, scope_type, scope_id, metric, target_value, starts_on, ends_on,
                                 owner_user_id, status, created_by_user_id, created_at, updated_at)
    VALUES ('dev-goal-midwest', 'region', 'dev-region-midwest', 'enrollments', 120, ${onDate(-60)}, ${onDate(30)},
            'u-growth', 'active', 'u-admin', ${day(-60)}, ${NOW})
    ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, updated_at = ${NOW}
  `;
  await sql`
    INSERT INTO inquiries (id, name, email, type, org_name, date, summary, status, submitted_at, created_at)
    VALUES
      ('dev-inq-westview', 'Alicia Moore', 'amoore@westview.k12.us', 'Partnership', 'Westview School District',
       ${onDate(-2)}, 'Westview would like to run BOW for two middle schools next semester.', 'new', ${day(-2)}, ${day(-2)}),
      ('dev-inq-parent', 'Rob Tanaka', 'rob.tanaka@example.com', 'Family', NULL,
       ${onDate(-1)}, 'Asking whether there is a spring cohort his daughter could join.', 'new', ${day(-1)}, ${day(-1)})
    ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status
  `;

  // --- an instructor-led course ---------------------------------------------
  // Front Office 101 is taught live: a numbered lesson list with links to the
  // Slides, the worksheet and a BOW simulation. No Learn track, and that is a
  // complete course rather than an unfinished one.
  await sql`
    INSERT INTO curriculum_lessons (id, curriculum_id, position, title, teaching_note, created_at, updated_at)
    VALUES
      ('dev-cl-1', 'dev-curr-101', 1, 'What a front office actually does',
       'Open on the roster, not the org chart. Ask who decides, then show how many of those decisions are money.',
       ${day(-30)}, ${NOW}),
      ('dev-cl-2', 'dev-curr-101', 2, 'Scarcity and the cap',
       'The simulation does the work here — budget fifteen minutes for it and leave time to argue about the result.',
       ${day(-30)}, ${NOW}),
      ('dev-cl-3', 'dev-curr-101', 3, 'Building a roster on a budget', NULL, ${day(-30)}, ${NOW})
    ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, teaching_note = EXCLUDED.teaching_note, updated_at = ${NOW}
  `;
  await sql`
    INSERT INTO curriculum_resources (id, curriculum_id, lesson_id, label, url, kind, sort, created_at, updated_at)
    VALUES
      ('dev-cr-1', 'dev-curr-101', 'dev-cl-1', 'Front office slides',
       'https://docs.google.com/presentation/d/example-front-office/edit', 'slides', 1, ${day(-30)}, ${NOW}),
      ('dev-cr-2', 'dev-curr-101', 'dev-cl-2', 'Salary cap slides',
       'https://docs.google.com/presentation/d/example-salary-cap/edit', 'slides', 2, ${day(-30)}, ${NOW}),
      -- The same experience Track 101 runs, pointed at rather than copied.
      ('dev-cr-3', 'dev-curr-101', 'dev-cl-2', 'Salary cap simulation', '/simulation', 'simulation', 3, ${day(-30)}, ${NOW}),
      ('dev-cr-4', 'dev-curr-101', 'dev-cl-2', 'Student worksheet',
       'https://docs.google.com/document/d/example-cap-worksheet/edit', 'document', 4, ${day(-30)}, ${NOW}),
      ('dev-cr-5', 'dev-curr-101', NULL, 'Instructor guide',
       'https://drive.google.com/drive/folders/example-guide', 'document', 5, ${day(-30)}, ${NOW})
    ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, url = EXCLUDED.url, kind = EXCLUDED.kind, updated_at = ${NOW}
  `;
  // The Lincoln class runs that course, so its sessions teach those lessons.
  await sql`
    UPDATE class_sessions SET lesson_id = 'dev-cl-1', updated_at = ${NOW} WHERE id = 'dev-sess-reported' AND lesson_id IS NULL
  `;
  await sql`
    UPDATE class_sessions SET lesson_id = 'dev-cl-2', updated_at = ${NOW} WHERE id IN ('dev-sess-past', 'dev-sess-today') AND lesson_id IS NULL
  `;
  await sql`
    UPDATE class_sessions SET lesson_id = 'dev-cl-3', updated_at = ${NOW} WHERE id = 'dev-sess-next' AND lesson_id IS NULL
  `;

  // --- one human wearing two hats ------------------------------------------
  // Ray Ellis runs athletics at Lincoln and has a child in the Tuesday squad.
  // He is one `people` row with a Contact facet and a Parent facet — which is
  // the claim the People directory has to be able to make.
  await sql`
    INSERT INTO organization_people (id, organization_id, person_id, relationship_type, is_primary, active, created_at, updated_at)
    VALUES ('dev-orp-lincoln', 'org-school', 'person-partner-contact', 'contact', 1, 1, ${day(-120)}, ${NOW})
    ON CONFLICT (id) DO UPDATE SET active = 1, updated_at = ${NOW}
  `;
  await sql`
    INSERT INTO student_guardians (id, student_id, person_id, relationship, is_primary, can_register, can_view_sensitive, status, created_at, updated_at)
    VALUES ('dev-sg-jalen', 'dev-stu-jalen', 'person-partner-contact', 'parent', true, true, true, 'active', ${day(-45)}, ${NOW})
    ON CONFLICT (id) DO UPDATE SET status = 'active', updated_at = ${NOW}
  `;
  await sql`
    UPDATE students SET guardian_person_id = 'person-partner-contact', updated_at = ${NOW}
     WHERE id = 'dev-stu-jalen' AND guardian_person_id IS NULL
  `;

  // --- a partner still being scoped ----------------------------------------
  // Ramaz: a genuine conversation with a named contact, real history, and an
  // overdue promise — and nothing scheduled, because nothing has been decided.
  await sql`
    INSERT INTO people (id, name, email, phone, created_at, updated_at)
    VALUES ('dev-person-ramaz', 'Sara Feldman', 'sfeldman@ramaz.example.org', '', ${day(-40)}, ${NOW})
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
  `;
  await sql`
    INSERT INTO organization_people (id, organization_id, person_id, relationship_type, is_primary, active, created_at, updated_at)
    VALUES ('dev-orp-ramaz', 'org-ramaz', 'dev-person-ramaz', 'contact', 1, 1, ${day(-40)}, ${NOW})
    ON CONFLICT (id) DO UPDATE SET active = 1, updated_at = ${NOW}
  `;
  await sql`
    INSERT INTO tasks (id, title, owner_user_id, doer_user_id, due_on, status, workflow_state, kind, priority,
                       context, entity_type, entity_id, handoff_to_founder, created_at, updated_at)
    VALUES ('dev-task-ramaz', 'Send Ramaz two formats to choose between', 'u-admin', 'u-admin', ${onDate(-4)},
            'open', 'assigned', 'follow_up', 'normal',
            'They asked for options before committing to a term. Nothing is booked.',
            'organization', 'org-ramaz', 0, ${day(-14)}, ${NOW})
    ON CONFLICT (id) DO UPDATE SET due_on = EXCLUDED.due_on, status = EXCLUDED.status, updated_at = ${NOW}
  `;
  await sql`
    INSERT INTO crm_activity (id, entity_type, entity_id, kind, body, actor_user_id, created_at)
    VALUES
      ('dev-act-ramaz-1', 'organization', 'org-ramaz', 'note',
       'Intro call with Sara Feldman. Interested for next year. Format, number of sections and who teaches it are all open.',
       'u-admin', ${day(-40)}),
      ('dev-act-ramaz-2', 'organization', 'org-ramaz', 'note',
       'Sara asked for two options — an after-school block and a semester elective — before taking it to the head of school.',
       'u-admin', ${day(-14)})
    ON CONFLICT (id) DO NOTHING
  `;

  // --- activity feed --------------------------------------------------------
  await sql`
    INSERT INTO crm_activity (id, entity_type, entity_id, kind, body, actor_user_id, created_at)
    VALUES
      ('dev-act-1', 'instructor', 'dev-instr-tasha', 'interview', 'Interview completed. Recommended for a Lincoln slot.', 'u-admin', ${day(-3)}),
      ('dev-act-2', 'program', 'dev-prog-omaha-spring', 'note', 'Eastside confirmed the room but not the schedule.', 'u-growth', ${day(-5)}),
      ('dev-act-3', 'class', 'dev-class-lincoln-a', 'session', 'Session delivered; attendance 2 of 3.', 'u-coach', ${day(-14)})
    ON CONFLICT (id) DO NOTHING
  `;
}

/**
 * Give each seeded user a Supabase Auth identity with SEED_PASSWORD, and
 * link it via `users.auth_user_id`. Skipped unless all three env vars are
 * present, so this never runs by accident against a real project.
 */
async function seedAuth(sql: postgres.Sql): Promise<void> {
  const password = process.env.SEED_PASSWORD;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!password || !url || !serviceKey) {
    console.log("[seed] auth identities skipped (SEED_PASSWORD / Supabase env not set).");
    return;
  }

  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  for (const u of SEED_USERS) {
    const email = u.email.toLowerCase();
    let authUserId: string | null = null;

    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.data?.user) {
      authUserId = created.data.user.id;
    } else {
      // Already exists from a previous run — find it and reset the password
      // so SEED_PASSWORD is always the working credential.
      let page = 1;
      while (!authUserId && page <= 10) {
        const list = await admin.auth.admin.listUsers({ page, perPage: 200 });
        const hit = list.data?.users.find((x) => (x.email ?? "").toLowerCase() === email);
        if (hit) authUserId = hit.id;
        if (!list.data?.users.length) break;
        page += 1;
      }
      if (authUserId) await admin.auth.admin.updateUserById(authUserId, { password, email_confirm: true });
    }

    if (!authUserId) {
      console.warn(`[seed] could not provision auth identity for ${email}: ${created.error?.message ?? "unknown"}`);
      continue;
    }
    await sql`UPDATE users SET auth_user_id = ${authUserId} WHERE id = ${u.id}`;
    console.log(`[seed] auth ready: ${email} (${u.role})`);
  }
}

async function main(): Promise<void> {
  const url = connectionUrl();
  assertLocal(url);
  const sql = postgres(url, { prepare: false, max: 1 });
  try {
    await seedDomain(sql);
    console.log("[seed] domain data loaded.");
    await seedAuth(sql);
  } finally {
    await sql.end({ timeout: 5 });
  }
  console.log("[seed] done.");
}

main().catch((error) => {
  console.error("[seed] failed:", error);
  process.exitCode = 1;
});
