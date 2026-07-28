# Verifier handoff — program launch completion (sprint 2)

Independent verification has **not** been performed. This document is the
implementation chat's handoff, not a verification result.

This sprint continues the previous launch-completion sprint. That sprint's own
handoff listed nine known gaps; items 1, 2, 4 and 7 were named as "the
substantive remaining launch work". This sprint closed those four, plus the
unwired notification kinds (item 8). Items 5, 6 and 9 remain open and are
listed at the bottom.

## Branch and commit

- Starting branch: `claude/bow-program-launch-completion-blpxcb` at `bc4de78`
  (this already contained the previous sprint's work, merged via PRs #37/#38)
- Final branch: `claude/bow-program-launch-completion-blpxcb`
- Final commit: see `git log -1` — the sprint is commits `bcc92a0..HEAD`

## Commands to run

```bash
service postgresql start
su postgres -c "psql -c \"ALTER USER postgres PASSWORD 'postgres';\" -c 'CREATE DATABASE bow;'"

export POSTGRES_URL_NON_POOLING='postgres://postgres:postgres@127.0.0.1:5432/bow'
export POSTGRES_URL="$POSTGRES_URL_NON_POOLING"

npm ci
npm run db:setup     # 22 migrations from empty
npm test
npm run build
npx tsc --noEmit
```

**The environment variables must be exported into the shell.** `.env.local`
alone is not enough: the DB-backed tests read `process.env` directly and skip
silently without it. A run reporting a large number of skips means the export
was missed — skips are not a pass.

## Migrations added

`scripts/migrations/022_program_transfer.sql` — verified idempotent (re-running
the chain applies nothing) and verified to build a working schema from an empty
database alongside the existing 21.

- `program_registrations`: `transferred_to_registration_id`,
  `transferred_from_registration_id`, plus two partial indexes on those columns.

No lifecycle was added. The source registration is withdrawn through the
ordinary release path; these columns only record which other registration is
the other half of a move, so a withdrawn record can explain itself as
"transferred out" instead of reading as an ordinary withdrawal.

## Environment requirements

Unchanged from the previous sprint. `lib/env-validation.ts` reports, without
throwing: database, Supabase auth, email sender, public app URL, cron auth,
trusted client IP. No SMS provider is configured and nothing claims SMS
delivery. Runs on the Vercel free plan — no new services, background workers,
queues, or scheduled jobs were introduced.

## What changed

### 1. Transactional cross-program transfer (was gap 7 — the launch blocker)

`transferProgram()` in `lib/program-operations.ts`. Previously a program
transfer was manual: withdraw here, register there. That sequence has a window
where the seat is given up and the replacement is not yet secured, and if the
second half failed the family was left in neither program.

The order is inverted. The destination placement is taken FIRST, inside one
transaction; the original is released only once the replacement exists. Any
outcome that is not a real placement — ineligible, full with no waitlist,
already registered there — rolls back and leaves the original untouched.

The destination seat is decided by `decideSeat`, the same function a family
registration uses: same class lock, same eligibility check, same capacity
arithmetic, same duplicate check, same requirement instantiation. A transfer is
therefore not a route into a full program. Both classes are locked in sorted id
order so opposing transfers between the same pair cannot deadlock.

`decideSeat` gained an `announce?: boolean` option so a transfer sends one
message naming both programs and the real resulting status, instead of two
messages about one event. It suppresses the announcement only — the
registration, audit event, and capacity write are unchanged.

Admin surface: `listTransferTargets` / `transferToProgram` in
`app/actions/family-support.ts`, and `TransferProgramDialog`, offered on the
family support record for any registration that still has a placement to move.

### 2. Program command center (was gap 1)

`app/app/programs/[id]/page.tsx` extended, not replaced. A `CommandCenter`
block now renders above the tab navigation and leads with, in order:
immediate blocker → next session → enrollment state → required action. Each
card links to the surface that resolves it; none is a read-only dead end.

Supporting sections added to the Overview tab: registration readiness,
enrollment, requirements, waitlist, family issues, communications, attendance,
completion. All reuse existing loaders (`registrationReadiness`,
`enrollmentCounts`, `needsAttention`, `listSessionsForClass`) plus one new
program-scoped query, `listFailedCommunications`.

### 3. First-session preparation (was gap 4)

New route `app/app/programs/[id]/first-session/` plus
`components/admin/first-session/`. Direct actions are wired to existing server
actions (`resendActivation`, `adminPlaceInClass`, `adminExtendReservation`,
`retryDelivery`, `addSupportNote`, `resolveSupportNote`) — none is a stub.

`programs.what_to_bring` existed as a column since migration 021 but had no
admin field, so it was null in practice. It now round-trips: the setup form
(`saveProgramCommunication`) → database → student program home and parent
dashboard.

### 4. Admin mobile pass (was gap 2)

A real, previously unnoticed bug: every action button across the enrollment,
requirements, waitlist, and family-support pages used BEM-style
`bow-button--secondary` / `bow-button--sm`. Those classes have **zero** matching
CSS — the real ones in `app/globals.css` are single-dash. The result was a
button with no background, no border colour and no `min-height`: an invisible,
near-zero-height tap target, effectively unclickable on a phone. All 11
occurrences repo-wide are fixed; `grep -rn "bow-button--" app/ components/`
now returns nothing.

Dense tables converted to responsive card rows: the enrollment attention and
registrations tables (previously forcing 760–880px of horizontal scroll to read
basic record data) and the waitlist waiting list.

### 5. Notification kinds wired (was gap 8)

`transfer_requested` and `absence_acknowledged` were defined in
`NOTIFICATION_KINDS` with no caller. Both now send an acknowledgement on family
request submission — a receipt that promises follow-up and nothing more, since
staff have not decided anything yet. `transfer_declined` sends on a declined
transfer request.

`transfer_approved` deliberately does **not** send when an admin approves the
*request*: approval is not the move. It sends from `transferProgram`, when the
child is actually in the new program. Announcing "transfer approved" before the
seat exists is the same broken promise as calling a held seat a confirmation.

## Acceptance criteria

Each is checkable against a real database.

1. **A transfer never leaves a child in neither program.** Transferring into a
   full program with no waitlist returns an error, leaves the source
   `confirmed`/`holds_seat = true` with its original `class_id`, and creates no
   row in the destination.
2. **A transfer is not a way into a full program.** Transferring into a full
   program that has a waitlist yields `status = 'waitlisted'`,
   `holds_seat = false`, a `waitlist_seq`, and the destination's `taken` count
   stays at capacity.
3. **The transfer re-checks capacity under the class lock.** A destination that
   fills between the admin's page render and the confirm produces a waitlist
   place, not an overbooked class. The dialog states the seat count as "at last
   check" precisely because of this.
4. **The freed seat is genuinely free.** After a successful transfer the source
   class's `seatCounts.taken` drops and `remaining` rises — the class
   enrollment and future roster rows are released, not just `holds_seat`.
5. **Both halves of a move are in the audit history** as
   `program_transfer_out` and `program_transfer_in`, carrying the operator's
   typed reason.
6. **A transfer produces exactly one notification**, of kind
   `transfer_approved`, whose body states the real resulting status. A transfer
   landing on the waitlist says "waitlist" and never reads as a confirmation.
7. **A transfer is refused** without a reason, to the same program (that is
   class placement), and for a terminal registration.
8. **`what_to_bring` round-trips** from the admin setup form to the student
   program home and the parent dashboard.
9. **No button in the app uses a `bow-button--` class.**

## Tests

`npm test` — 257 passing (baseline for this sprint was 251).
The suite is `POSTGRES_URL`-gated in the existing style and skips cleanly
without a local database.

New (6, all in `tests/program-operations.test.ts`):

- a transfer moves the child atomically and frees the original seat
- a transfer into a full program leaves the original placement untouched
- a transfer into a full program with a waitlist lands on the waitlist, not a seat
- a transfer is refused without a reason, to the same program, and for a terminal registration
- a transfer records both halves of the move in the audit history
- a destination that fills after the admin looked yields a waitlist place, never an overbooked class

Note on concurrency: `getDb()` is a shared pooled client that serializes
queries, so an in-process race of two `transferProgram` calls is not
meaningful. The cross-instance guarantee is the `SELECT ... FOR UPDATE` class
lock, which is already covered at SQL level by
`tests/family-registration.test.ts` ("the final seat is taken exactly once when
two families race for it"). `transferProgram` takes the same lock. The
stale-count test above is the transfer-specific expression of that guarantee.

## Known gaps — not done, and not to be reported as done

Carried over from the previous sprint's handoff:

1. **"Completion review due"** is still absent from the *global* needs-action
   queue — no honest query backs it. The program command center now has a
   completion section backed by the existing `outcomeSummary`/`stage` fields,
   which is not the same thing. Ranked "useful after launch" this sprint.
2. **Resend student invitation** is still not implemented. No student-invitation
   infrastructure exists in the repo; only guardian activation does. It was
   deliberately omitted from the first-session view rather than stubbed.
3. **No browser smoke checks were run.** No authenticated session was available
   in this environment. Every claim about rendering is from reading markup and
   CSS, not from a rendered page. **The mobile work in particular has not been
   visually confirmed** — the broken-button-class fix is verified by grep and by
   reading `globals.css`, and the card conversions are verified by tsc, lint and
   code reading, but nothing was rendered or screenshotted at 375px.
4. **No attendance-rate or completion "on track" score** is shown. No query
   computes a rate — only a per-session boolean and per-program
   `outcomeSummary` text exist. Honest counts are surfaced instead of a
   fabricated percentage.

New to this sprint:

5. **"Attendance confirmations" are not shown on the first-session view.** The
   brief asks for them, but no RSVP or attendance-confirmation concept exists
   anywhere in the schema — only post-hoc `attendance_records`. Asking a family
   to confirm attendance before a session is a feature that would need a
   column and a family-facing action; it was omitted rather than fabricated.
6. **Cross-program transfer is admin-initiated only.** A family submits a
   transfer *request* (`family_requests`, kind `transfer`); an admin then
   performs the move. There is no parent-facing self-serve transfer, which is
   the correct default for a program with capacity, but it means the
   `transfer_requested` → `transfer_approved` path has a human step in it.
7. **`listTransferTargets` runs one `seatCounts` query per candidate program.**
   Fine at current program counts; it would want batching before the catalogue
   grows large.

## Process note for the verifier

Mid-sprint, one implementing agent ran `git stash`/`git stash pop` and a
`git reset --hard` landed on the shared working tree, destroying all
uncommitted work across four concurrent agents. Everything was reconstructed
and the reflog shows no lost commits, but a verifier should be aware that the
working tree was rebuilt rather than accumulated, and should trust
`git log -p` over any assumption of continuous history. All destructive git
commands were prohibited for the remainder of the sprint.

## Test accounts / fixtures

No seeded accounts are required. Every test builds its own program, class,
guardian, and children through the real engine (`decideSeat` under the class
lock), so fixtures exercise the same path production uses. `npm run db:seed`
exists for manual exploration.
