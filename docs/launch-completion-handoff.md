# Verifier handoff — program launch completion

Independent verification has **not** been performed. This document is the
implementation chat's handoff, not a verification result.

## Branch and commit

- Starting branch: `claude/bow-program-operating-system-xmyz95` (d2953b1)
- Final branch: `claude/bow-program-launch-completion-j6my49`
- Commit: `cd5d170`

## Commands to run

```bash
service postgresql start
su postgres -c "psql -c \"ALTER USER postgres PASSWORD 'postgres';\" -c 'CREATE DATABASE bow;'"

export POSTGRES_URL_NON_POOLING='postgres://postgres:postgres@127.0.0.1:5432/bow'
export POSTGRES_URL="$POSTGRES_URL_NON_POOLING"

npm ci
npm run db:setup     # 21 migrations from empty
npm test             # expect 251/251
npm run build
npx tsc --noEmit
```

**The environment variables must be exported into the shell.** `.env.local`
alone is not enough: the DB-backed tests read `process.env` directly and skip
silently without it. A run reporting "228 passed, 37 skipped" means the export
was missed — the skips are not a failure but they are also not a pass.

## Migrations added

`scripts/migrations/021_program_launch_completion.sql` — verified idempotent
(re-running the chain applies nothing) and verified to build a working schema
from an empty database.

- `program_registrations`: `waitlist_eligibility`, `waitlist_eligibility_reason`,
  `waitlist_eligibility_checked_at`, `created_via`, `created_by_user_id`,
  `restored_at`, `restored_from_status`
- `programs`: `reservations_paused`, `auto_offers_paused`,
  `operations_hold_reason/_set_at/_set_by`, `what_to_bring`
- `family_notifications`: `delivery_attempts`, `last_attempt_at`,
  `last_retry_by_user_id`
- New tables: `waitlist_eligibility_events`, `program_audit_events`,
  `student_duplicate_reviews`, `family_support_notes`

## Environment requirements

`lib/env-validation.ts` reports, without throwing: database, Supabase auth,
email sender, public app URL, cron auth, trusted client IP. No SMS provider is
configured and nothing claims SMS delivery.

## Acceptance criteria

Each of these is checkable against a real database.

1. **A waitlisted child who becomes ineligible is not marked `declined`.**
   Registration keeps `status='waitlisted'`, gets
   `waitlist_eligibility='ineligible'` with a non-null reason, keeps its
   `waitlist_seq`, and `holds_seat` stays false. This is the highest-value
   regression in the sprint.
2. **Correcting the underlying fact restores them to their original place** —
   `reevaluateWaitlistEligibility` sets `eligible` without issuing a new
   sequence number.
3. **A sweep never overturns `staff_rejected`.**
4. **`auto_offers_paused` stops the refill sweep** and leaves the waiting
   family `eligible` — a pause is not a judgement about the family.
5. **`reservations_paused` records new registrations as `under_review`** rather
   than turning families away or handing out a seat.
6. **A hold with a blank reason is refused** and a successful hold writes one
   `program_audit_events` row.
7. **Restoration re-checks capacity under the class lock** and lands on the
   waitlist when the seat was taken in the meantime; total `holds_seat` count
   must still respect capacity.
8. **Restoration is refused when the child already has a live registration.**
9. **A conflicting duplicate pair cannot be merged automatically**; `distinct`
   is permanent and re-flagging returns null.
10. **A clean merge moves registrations to the canonical child** and sets
    `merged_into_student_id` on the tombstone.
11. **Every registration outcome produces exactly one notification**, and the
    reserved-seat message never uses confirmation language.
12. **Retry re-sends without re-running the business mutation** — status and
    `holds_seat` unchanged, `delivery_attempts` incremented — and suppresses
    expired action links.

## Tests added (23 new; 228 → 251)

- `tests/program-operations.test.ts` (13) — waitlist eligibility incl. the
  declined regression and sweep-spin guard, re-evaluation, staff-rejection
  protection, all three emergency brakes, restoration incl. the full-program
  and duplicate-live cases, duplicate merge safety/distinct/clean-merge.
- `tests/family-communications.test.ts` (10, by the communications agent) —
  kind completeness, non-confirmatory reserved-seat label, always-email
  coverage, retry idempotency, attempt counters, expired-link suppression,
  per-program sweep isolation, environment validation.

Both are `POSTGRES_URL`-gated in the existing style and skip cleanly without a
local database.

## Known gaps — not done, and not to be reported as done

1. **Admin program command centre (Part 2) was not extended.** The existing
   708-line page is unchanged. Enrollment/requirements/waitlist/completion data
   is reachable but is not led by blocker-first prioritisation.
2. **Admin mobile pass (Part 8) was not performed.** Dense admin tables were
   not converted to responsive rows/cards.
3. **Family mobile verification is review-only.** Markup and CSS were audited
   at 375px and two real fixes landed (button-row wrapping, a student-page
   primary action); nothing was rendered or screenshotted. Needs a visual pass.
4. **First-session preparation view (Part 10) was not built.** `what_to_bring`
   now has a column and renders on the student page, but there is no admin
   field to populate it — it will be null in practice until one is added.
5. **"Completion review due"** was deliberately omitted from the needs-action
   queue rather than stubbed: no honest query backs it.
6. **Resend student invitation** is not implemented — no student-invitation
   infrastructure exists; only guardian activation does.
7. **Cross-program transfer is not automated.** `family_requests` of kind
   `transfer` are visible and can be approved or declined, but the
   register-new/withdraw-old sequence is still manual. Part 6's transactional
   transfer requirement is therefore **not met** for program transfers; class
   transfers via `placeInClass` remain transactional as before.
8. **New notification kinds are defined but not all wired.**
   `student_invitation`, `transfer_requested/approved/declined`, and
   `absence_acknowledged` exist in `NOTIFICATION_KINDS` with no caller yet.
9. **No browser smoke checks were run.** No authenticated session was
   available in this environment.

Items 1, 2, 4, and 7 are the substantive remaining launch work.

## Test accounts / fixtures

No seeded accounts are required. Every test builds its own program, class,
guardian, and children through the real engine (`decideSeat` under the class
lock), so fixtures exercise the same path production uses. `npm run db:seed`
exists for manual exploration.
