# BOW People & Work Engine — Stage 0 Architecture Assessment

Base: `claude/zealous-davinci-0ugq0n` at `04ac4ab760a922beb93aa603aad2e016f456e9c6`.

## Preserve

- `people` remains the canonical human identity. `users` remains the authenticated account.
- `instructors` remains the instructor-specific training, availability, eligibility, staffing, reliability, and quality dossier.
- `tasks` remains the universal Work system.
- `crm_activity` remains the universal operational audit trail.
- Existing notifications, secure invitations, post-commit invitation delivery, rate limiting, and role guards remain in use.
- Existing Class, training, session, partner, growth, Playbook, and Highway World systems are not replaced.

## Gaps Found

- Instructor hiring is a hardcoded stage enum with one free-form interview note.
- Published openings, hiring demand, immutable process/opening versions, reusable questions, and reusable scorecards do not exist.
- Interview scheduling is stored directly on the instructor dossier and has no reschedule/no-show history.
- Work supports only `open`/`done`, with no append-only submission/review history or objective performance events.
- Current permissions are primarily `admin`/`growth` role checks and need a capability-compatible direction.
- The imported Postgres database has RLS enabled with no public policies. The app intentionally uses its server-side database credential.

## Extensions

- Add separate identity, application, role-assignment, and instructor-operation lifecycles.
- Add organization units, roles, optional positions, role assignments, engagement types, and requirements.
- Add requisitions, immutable opening/process versions, applications, stage events, scheduling, evaluations, and communications.
- Add Work delegation, workflow state, task events, submissions, reviews, and source-specific performance events.
- Add responsibility/outcome context without requiring it for existing Work.

## Compatibility Decisions

- Existing instructor applicant IDs are reused as application IDs during backfill; no duplicate People or applicant identity is created.
- Existing `tasks.status` stays `open | done`; richer workflow state is additive.
- Existing instructor lifecycle fields remain operationally valid while hiring-facing pages move to `applications`.
- Invitation email remains post-commit. Delivery failure creates attention rather than rolling back acceptance.
- Schema changes are explicit and versioned; no page request performs DDL.
