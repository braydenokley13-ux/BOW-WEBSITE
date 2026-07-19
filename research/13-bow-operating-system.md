# BOW Operating System — Architecture Record

## Why this architecture exists

The repository already had working systems for hiring, onboarding, training,
classes, students, attendance, reports, partners, tasks, and the LMS. The BOW
Operating System connects those systems around one operating model rather than
replacing them with another set of disconnected dashboards.

The central decision is:

> A Program is the operating plan and lifecycle record. A Class is a concrete
> delivery unit inside that Program.

This removes the pressure to overload a Class with partner demand, launch
planning, renewal, expansion, and multi-class coordination. It also preserves
every working class roster, session, attendance, and reporting flow.

## Core model

- **People** remain the canonical human identity layer.
- **Organizations** remain the operational partner records used by classes.
- **Programs** own the commercial and operational lifecycle from opportunity
  through renewal or closure.
- **Classes** own delivery: instructors, students, sessions, attendance, and
  session reports.
- **Locations** are normalized records used by Programs and Classes. Legacy
  location text is retained for compatibility and historical display.
- **Regions** own geographic operating boundaries, timezone context, and
  accountable regional leadership. Locations belong to Regions; Programs use
  Locations instead of copying regional text.
- **Tasks** evolve into the Work system by adding a work kind, operational
  context, priority, and recommended action. No parallel queue is introduced.
- **CRM activity** remains the shared audit trail for every operating record.
- **Operational decisions** are append-only evidence for consequential staffing
  and lifecycle choices. Mutable state says what is true now; decision evidence
  says who authorized the change, when, and why.
- **Growth evidence** connects a persistent Person and Student identity to a
  channel, campaign, contributor, referral, verified participation, explicit
  Program outcome, and promoted playbook. It does not create a second student,
  market, delivery, or task system.

## Evidence generations

The operating model is delivered through additive, health-checked migration
generations rather than one destructive Phase E rewrite:

- **V4 — temporal staffing:** Class instructor assignments are dated intervals
  with immutable decision evidence. A removed instructor is history, not a
  deleted row.
- **V5 — identity and training integrity:** ambiguous current instructor
  dossiers fail migration; training registration and attendance identities are
  reconciled and protected by uniqueness rules.
- **V6 — session evidence:** each new Class session stores its timezone, locks a
  roster snapshot, uses four-state attendance, and freezes the finalized lesson
  snapshot and report.
- **V7 — growth evidence:** channels, campaigns, contributor hierarchy, goals,
  touchpoints, attribution, referrals, outcomes, confirmations, and playbooks
  form one evidence chain.
- **V8 — lifecycle hardening:** databases that may carry a pre-release V7 marker
  receive the final trigger/index definitions once. Campaign terminal results
  require a derived result, decision, and reusable learning.
- **V9 — local calendar evidence:** timezone-proven sessions receive an
  immutable `session_on` local date. Legacy sessions without a provable zone
  stay on an explicit deterministic UTC fallback instead of receiving an
  invented city.
- **V10 — contributor lifecycle:** current roles can close with actor, effective
  date, and reason; child roles close before managers; historical reporting
  lines remain valid after a manager later closes.

Every generation has both row-level health assertions and schema-protection
checks. An unsafe source row stops migration with its identity rather than being
silently normalized into a plausible-looking fact.

## Management by exception

The founder cockpit is not a generic analytics dashboard. It ranks the small
number of decisions, risks, and overdue commitments that require leadership.
Every exception should identify an accountable owner, explain the underlying
facts, recommend a next action, and link directly to the living record.

Work is the universal follow-through layer. Hiring decisions, coverage gaps,
launch blockers, development concerns, deleted-account reassignments, and
renewal choices all become owned Work rather than private memory or duplicate
feature-specific task lists. This is the main mechanism for reducing founder
coordination work as regions and teams grow.

## Readiness is derived

Program readiness is not stored as a percentage or a set of duplicate checkbox
booleans. It is computed from:

- partner confirmation on the Program;
- the Program's primary contact, Location, schedule, and Curriculum;
- linked Classes;
- eligible and qualified instructor assignments;
- actual enrollments and student form status;
- materials readiness;
- scheduled first sessions.

Only facts that the system cannot infer, such as partner confirmation and
physical-material readiness, are recorded directly.

## Staffing is deterministic

Staffing recommendations are rules-based and explainable. They consider:

- eligibility;
- Curriculum, age-group, format, role, and Location qualifications;
- weekly availability against the Program schedule;
- active workload against the instructor's chosen maximum;
- prior teaching history;
- recent reliability evidence and open development items.

The interface exposes matches, gaps, and conflicts. It never presents an AI
judgment or hides the final leadership decision behind a score.

## Quality is multidimensional

Instructor feedback keeps curriculum delivery, student/family relationships,
organization/reliability, and leadership/contribution separate. Development
items record coaching, goals, improvement plans, and recognition without
collapsing instructor quality into a single rating.

An instructor record is therefore a workforce dossier, not only an applicant
tracker. It combines hiring evidence, training completion, approved teaching
scope, availability, workload, assignments, delivery feedback, reliability
signals, recognition, development commitments, and progression. Qualifications
are explicit approvals because staffing recommendations must never infer that a
new instructor is prepared for a Curriculum, audience, format, role, or Location.

## One connected operating history

Partner intake, the resulting Program, delivery Classes and sessions, outcome,
and any renewal or expansion Program form one connected history. A continuation
is a child Program rather than a mutation that rewrites the completed operating
record. This makes past delivery auditable while giving the next cycle a clean
plan, owner, readiness state, and staffing decision.

The same rule governs growth operations. A campaign result and operating-goal
result are derived and frozen when the record closes. Later attribution
corrections remain visible as current supporting evidence; they do not rewrite
the result leaders actually used for the original decision. Assignment closure
likewise freezes role, scope, manager, dates, actor, and reason.

Completed and closed Programs are historical records. A pause is an operating
state for work that may resume; renewal and expansion create a continuation.
This distinction prevents teams from reopening completed delivery and erasing
what actually happened.

## Identity and security boundaries

- Account sessions and invitation/reset credentials store only one-way token
  digests. Raw bearer credentials exist only long enough to reach the owner.
- Public student profiles require an active, guardian-approved, expiring,
  revocable sharing grant; private student records are never the public model.
- Account-deletion fulfillment anonymizes direct identity and revokes access
  while preserving stable, non-PII delivery and decision evidence. Any affected
  active ownership, contact, or staffing responsibility becomes explicit Work.
- Server actions repeat authorization and lifecycle validation at the write
  boundary. Hiding a control in the interface is never treated as permission.
- Production SQLite is restricted to one durable host. The application refuses
  an ephemeral horizontally scaled deployment instead of pretending the local
  file is a distributed database.

## Compatibility and backfill

The repository uses an idempotent SQLite schema initializer instead of a
standalone migration framework. Phase E follows that convention with additive
tables and columns.

On initialization:

1. Existing cohort-to-class migrations regain their original organization link.
2. Legacy instructor users receive canonical workforce profiles and migrated
   Classes point to those profiles instead of incompatible user IDs.
3. Legacy LMS enrollments are projected into the canonical class roster.
4. Existing organizations receive a normalized Location.
5. Existing Classes receive that Location where possible.
6. Every existing Class receives one Program parent with a deterministic ID.
7. No existing row is deleted, renamed, or rewritten into a new parallel table.
8. Legacy learner inquiries become acquisition evidence only when normalized
   email proves exactly one Person; ambiguity becomes a migration conflict.
9. Timezone-backed Class sessions receive a canonical local date; timezone-less
   history remains explicitly unresolved.
10. Legacy terminal contributor assignments without closure evidence are
    retained and flagged; the migration never guesses who closed them or why.

The one-Class-per-backfilled-Program shape is conservative. Leadership can add
more Classes to those Programs later, while historical delivery remains intact.

## Known infrastructure boundary

The logical model is designed for many regions, Programs, instructors, and
students. The current single-file SQLite deployment is not the final storage
topology for a multi-region organization. The new operating model keeps IDs,
relations, derived rules, and server-side data access explicit so a later move
to Postgres can be a storage migration rather than a product rewrite.

The same boundary applies to outbound email: Next.js post-response delivery is
appropriate for the first durable single-host release, with visible Work on
invitation failure. A later multi-instance deployment should move outbound
messages to a durable queue without changing the invitation or recovery models.

## Significant product deviations

These decisions intentionally improve on the original checklist:

- Program and Class were separated instead of overloading one record with both
  planning and delivery.
- Cohort compatibility was bridged into Program/Class instead of leaving two
  competing operating models.
- Instructor session work was consolidated around one canonical Class session
  and evidence path instead of preserving duplicate attendance workflows.
- Founder Home receives only ranked exceptions; large form option lists and the
  full growth read model remain in the Growth workspace.
- People, Students, and Programs use bounded staff-only search after two typed
  characters. The page never ships an arbitrary first 1,000 records and hides
  everyone else when BOW reaches tens of thousands of learners.
- One contributor owns one current role. Advancement closes the prior interval
  and starts the next, preserving an understandable reporting tree at every
  point in time.

## Explicit next infrastructure investments

The current product deliberately does not grant hundreds of ambassadors the
privileged `growth` staff role. Contributor self-service, public referral links,
and identity-safe claim flows should be built as a separate least-privilege
portal boundary. Campaign spend currently has optimistic concurrency, a locked
terminal total, and required delta evidence in activity history; a later finance
integration should replace manual totals with an immutable invoice/expense
ledger. Neither limitation requires replacing the growth, attribution, market,
or contributor models delivered here.
