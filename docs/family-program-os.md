# Family + program operating system — decision record

The nine decisions every surface in this phase is built on. Anything that
contradicts one of these is a bug, not a variation.

## 1. Canonical family model

A family is not a table. It is the set of students reachable from one guardian
`people` row through `student_guardians`. That join table is authoritative:
many guardians per child, many children per guardian, each link carrying
`status` (`active` / `invited` / `revoked`) and its own permissions
(`can_register`, `can_view_sensitive`).

`students.guardian_person_id` survives as the primary-guardian pointer so
existing staff reads keep working, but it never decides access.

Every parent-scoped read and write resolves scope through
`studentIdsForGuardian()` / `guardianCanAccessStudent()` in
`lib/parent-activation.ts`. Changing an id in a URL therefore cannot reveal
another family, and a revoked guardian loses access immediately rather than
keeping it until their session expires.

## 2. Canonical child identity

One `students` row per real child, reused across every program. Registration
no longer creates a child per program.

- A signed-in parent selecting an existing child is verified against
  `student_guardians` before the id is trusted.
- A new child gets a deterministic id derived from the submission's request
  key, so a replay resolves to the same child instead of a second one.
- `students.identity_key` (normalized name + grade) flags *possible*
  duplicates into a review queue by setting `duplicate_review_status = 'open'`.

Children are never merged on a name match. Siblings and cousins collide
legitimately; a human decides, and `merged_into_student_id` records the result.

## 3. Canonical registration lifecycle

One record — `program_registrations` — with one status column covering the
whole journey:

```
submitted · under_review · seat_reserved · requirements_pending · confirmed
waitlisted · offer_sent · offer_accepted
withdrawn · expired · declined · cancelled · completed
```

The pre-existing `'pending'` value stays legal so no historical row is
invalidated, but the engine writes `under_review` instead. No second status
system is introduced: `class_enrollments.status` continues to mean "is this
child on the class roster", which is a consequence of the registration status,
never a competing statement about it.

Families never see these tokens. `registrationLabel()` is the only way a status
reaches a parent.

## 4. Capacity and reservation model

**The seat invariant.** A registration occupies a seat exactly when
`holds_seat = true` — true for `under_review`, `seat_reserved`,
`requirements_pending`, `confirmed`, `offer_sent`, and `offer_accepted`. One
column, so a registration can never be double-counted across status buckets or
silently stop counting.

**The lock.** Every seat decision runs in a transaction that first takes
`SELECT ... FOR UPDATE` on the `classes` row. Locking a row that is guaranteed
to exist is what closes the window: under READ COMMITTED two transactions can
both read "one seat left" from an unlocked `COUNT` and both insert, because
neither has a row to conflict on. The lock is in Postgres, so it holds across
separate Vercel instances.

**Counting.** Seats taken is one `UNION` over occupied `class_enrollments` and
seat-holding registrations, counted distinct by student — a confirmed
registration has both rows and must still cost one seat.

**Reservations.** When a program enables reservations and has at least one
confirmation-blocking requirement, a submission takes the seat as
`seat_reserved` with a deadline. Completing the blocking requirements confirms
it; the deadline passing releases it atomically and refills from the waitlist.
Programs without blocking requirements confirm immediately.

**Idempotency.** `request_key` is unique per child-program selection and
carries a `payload_fingerprint`. Same key and same payload replays the original
result; same key and materially different payload fails safely rather than
returning a result that does not match what was sent.

## 5. Waitlist model

`waitlist_mode` is `disabled`, `automatic`, or `manual`.

Ordering is a monotonic sequence (`program_waitlist_seq`) — first waitlisted,
first offered. It is deliberately **not** shown to families as a position,
because eligibility skips and manual admin selection make any displayed number
wrong.

An offer *takes the seat* (`holds_seat = true`) before the next candidate is
considered, and `uq_waitlist_offers_open` allows one outstanding offer per
registration. Together these make double-offering a single seat impossible
rather than merely unlikely. Declining or expiring releases the seat and
promotes the next eligible family; an expired offer returns the family to
`waitlisted` rather than dropping them.

## 6. Requirement model

`program_requirements` defines them per program; `registration_requirements`
tracks one family's answers. A requirement carries its own `required`,
`blocks_confirmation`, `staff_approval_required`, `visibility`, and due date —
so a program asks only what it actually needs, and only a
`blocks_confirmation` requirement can hold a seat hostage.

`visibility` is the privacy boundary: `admin` (default), `admin_instructor`,
or `instructor_summary`. Instructors never receive raw medical or guardian
form responses; they get only what delivery requires.

## 7. Account activation model

Registration first, account second. A family receives a real result —
confirmed, reserved, waitlisted, interest recorded, or review required —
before being asked for a password.

`parent_activations.state` is explicit (`invitation_pending`,
`identity_created`, `family_linked`, `complete`, `expired`, `failed`,
`support_required`) because the local `users` row and the Supabase identity
fail independently. A failed provisioning is never reported to the family as
success.

A guardian email matching a staff account becomes `support_required`. Family
activation can never claim an admin, growth, or instructor account.

## 8. Class-placement model

Registration resolves to the program's default class; an admin places or moves
the child afterwards. `placeInClass()` takes the destination seat under lock
**before** releasing the origin, so a partial failure can never leave a student
enrolled in neither. Class capacity is enforced on the destination.

## 9. Completion model

`program_completion_records` is keyed to the registration, not to `users.id`,
because a registered child may never log in — the existing `certificates`
table cannot represent them. Completion is decided by configured rules
(minimum attendance, instructor confirmation, admin approval), never by the
end date passing. A certificate is only issued against a `completed` outcome,
and carries a verification serial.
