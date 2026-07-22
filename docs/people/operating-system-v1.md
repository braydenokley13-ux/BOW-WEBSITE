# BOW People Operating System V1

## What this release adds

This release extends the existing People & Work Engine. It does not create a second People directory, a second task queue, or a second performance system.

The operating loop is now:

1. A Person receives a role assignment.
2. The assignment starts in `activating`.
3. Onboarding, eligibility, training, first approved Work, and manager review can gate activation.
4. The person and manager set one primary weekly commitment.
5. Existing Work is linked to that commitment.
6. The person executes, submits, revises, and completes Work through the canonical Work queue.
7. The week closes with a summary derived from the linked Work.
8. A miss creates recovery history instead of automatic punishment.
9. Repeated or serious problems can open a human-controlled role review.
10. Strong evidence can support more autonomy.
11. Only real exceptions rise to the founder cockpit.

## New surfaces

- `/app/tasks` now begins with **My Week** for the signed-in HQ user.
- `/app/people` is the manager view: **Who needs me?**
- `/app/people/[personId]` is the operating profile for one person.
- `/app` receives People exceptions only when a person is actually at risk.

## Data model

Migration `008_people_weekly_operations.sql` adds:

- `people_weekly_cycles`
- `people_weekly_cycle_tasks`
- `people_accountability_events`
- `role_activation_requirements`
- `role_assignment_decisions`
- capacity and availability fields on `role_assignments`

The weekly-task table is only a link to `tasks`. Weekly work is not duplicated.

## Performance philosophy

There is no universal person score.

Evidence remains separated by source and dimension:

- **Output**: approved Work exists.
- **Reliability**: deadlines, commitments, attendance, and follow-through.
- **Quality**: a reviewer judges the exact submission.
- **Impact**: a linked outcome records what changed.
- **Coachability**: revision and feedback evidence where explicitly recorded.

These events remain attributable to the role assignment and time period in which they happened.

## Role activation and authority

Autonomy levels remain:

1. Directed
2. Guided
3. Owner
4. Lead

The system does not automatically promote people from a numeric threshold. A manager makes the decision and records the reason.

Ending or revoking a role fails safely while that assignment still owns:

- open Work
- active responsibilities
- active outcomes
- direct reports

Those items must be handed off first. History is preserved.

## People × Playbook

A role activation requirement can point at a published Playbook lesson.

The People system reads `learn_lesson_mastery` to verify completion. It does not copy or recreate Playbook progress. This is the clean seam for future instructor training and certification.

## Bounded automations

This release intentionally does not build a general automation editor.

It includes only proven trigger/action behavior:

- blocked/at-risk weekly commitment → idempotent manager notification + attention event
- weekly miss → recovery/accountability event
- accepted candidate → activating role + onboarding Work + activation requirements
- first approved Work → first-work activation requirement satisfied
- linked Playbook lesson completed → training requirement can be synchronized as satisfied
- role at risk → founder exception only when leadership attention is warranted

## Safe setup order

For a new person:

1. Open **People → My People**.
2. Open the person's operating profile.
3. Create the role assignment.
4. Choose the manager assignment.
5. Complete or link activation requirements.
6. Set availability and weekly capacity only when there is honest information.
7. Set the weekly commitment.
8. Link the real Work that proves it.
9. Review submissions in the Work queue.
10. Close the week and record any recovery plan.

## Production rule

This implementation does not run production migrations or deploy itself.

After the combined PR is reviewed and merged:

1. Back up and verify the production database.
2. Run the already-required People & Work migration first if it has not run.
3. Run `npm run migrate` to apply Playbook migrations including `008` and
   the runtime release control in `009`.
4. Confirm **Student Cutover** is off in Playbook Studio before any pilot.
   `BOW_LEARN_CUTOVER=off` is only the fail-safe fallback before migration 009.
5. Verify `/app/tasks`, `/app/people`, `/app/hiring`, `/app/teach`, and Playbook Studio with staff test accounts.
6. Pilot the operating loop with a small real team before adding more automation.

## Pilot checklist

Use 3–5 real people for two weekly cycles.

Confirm that:

- everyone understands the one primary weekly commitment
- Work links are useful rather than administrative busywork
- managers can see who needs them in under 30 seconds
- reviews happen quickly
- misses generate recovery rather than confusion
- role activation requirements reflect real BOW expectations
- founder exceptions are rare and genuinely important

The next release should be chosen from observed pilot friction, not from a generic HR feature list.
