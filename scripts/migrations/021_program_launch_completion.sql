/* ============================================================
 * 021 — Program launch completion.
 *
 * Extends the family/program operating system laid down in 019 with the
 * records launch operations need. It adds no second lifecycle: registration
 * status stays the one canonical statement about a registration, and
 * `holds_seat` stays the one statement about capacity. Everything here is
 * either an orthogonal fact about a registration (is this waitlist entry
 * currently eligible?), an operational control on a program (are automatic
 * offers paused?), or a record of admin work (support notes, duplicate
 * reviews).
 *
 * Five additions:
 *   1. Waitlist eligibility — why a waitlisted family was skipped.
 *   2. Program emergency controls — pause reservations / automatic offers.
 *   3. Registration provenance — how a registration was created.
 *   4. Duplicate-child review pairs.
 *   5. Family support notes + a delivery attempt counter.
 * ============================================================ */

/* ---------------------------------------------------------------- */
/* 1. Waitlist eligibility.                                          */
/* ---------------------------------------------------------------- */

-- A waitlisted registration has two independent facts: its position in the
-- queue (status = 'waitlisted' + waitlist_seq) and whether it can be offered a
-- seat right now. Before this migration only the first existed, so a family
-- skipped for a fixable reason — grade outside the band, prerequisite not yet
-- finished, a schedule clash — was indistinguishable from a family that was
-- offered a seat and said no. That is the single most misleading thing the
-- waitlist board could say, because the operational response is opposite:
-- 'declined' is finished, 'ineligible' is a support task.
--
-- This is deliberately NOT another status column. Status still answers "where
-- is this registration in the lifecycle"; eligibility answers "may the refill
-- sweep consider it", which is a property that changes on its own (a grade is
-- corrected, a prerequisite completes) without the registration moving.
ALTER TABLE program_registrations
  ADD COLUMN IF NOT EXISTS waitlist_eligibility text NOT NULL DEFAULT 'eligible';
ALTER TABLE program_registrations
  ADD COLUMN IF NOT EXISTS waitlist_eligibility_reason text;
ALTER TABLE program_registrations
  ADD COLUMN IF NOT EXISTS waitlist_eligibility_checked_at bigint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'program_registrations_waitlist_eligibility_check'
  ) THEN
    ALTER TABLE program_registrations
      ADD CONSTRAINT program_registrations_waitlist_eligibility_check
      CHECK (waitlist_eligibility IN (
        -- May be offered a seat by the automatic sweep.
        'eligible',
        -- Temporarily blocked by a fact that can change. Still in the queue,
        -- keeps its sequence, must carry a reason.
        'ineligible',
        -- A human must decide before this family is offered anything.
        'needs_review',
        -- A staff member removed it from consideration. Distinct from the
        -- family declining an offer, which is recorded on the offer itself.
        'staff_rejected'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_program_registrations_waitlist_queue
  ON program_registrations (program_id, waitlist_eligibility, waitlist_seq)
  WHERE status = 'waitlisted';

-- Eligibility history. Recomputation is allowed to run automatically (a sweep
-- re-checks grade and prerequisites), so without a record nobody could answer
-- "why was this family passed over on Tuesday". Stores the transition and its
-- cause, never any requirement response content.
CREATE TABLE IF NOT EXISTS waitlist_eligibility_events (
  id text PRIMARY KEY,
  registration_id text NOT NULL REFERENCES program_registrations(id) ON DELETE CASCADE,
  program_id text NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  previous_eligibility text,
  new_eligibility text NOT NULL,
  reason text,
  -- 'system' for a sweep recomputation, 'staff' for a human decision.
  source text NOT NULL DEFAULT 'system' CHECK (source IN ('system', 'staff')),
  actor_user_id text,
  actor_label text,
  created_at bigint NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_waitlist_eligibility_events_registration
  ON waitlist_eligibility_events (registration_id, created_at DESC);

/* ---------------------------------------------------------------- */
/* 2. Program emergency controls.                                    */
/* ---------------------------------------------------------------- */

-- Two independent brakes, separate from `registration_open` because they stop
-- different things and an operator needs to stop them independently. Closing
-- registration turns families away at the door; pausing reservations lets a
-- program keep taking interest while a capacity problem is investigated; and
-- pausing automatic offers stops the refill sweep from handing out seats
-- during a schedule change without touching anyone already holding one.
--
-- Neither control ever mutates an existing registration. A paused program's
-- reserved seats keep their deadlines and its confirmed families stay
-- confirmed — a brake on new work, not a retroactive edit.
ALTER TABLE programs ADD COLUMN IF NOT EXISTS reservations_paused boolean NOT NULL DEFAULT false;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS auto_offers_paused boolean NOT NULL DEFAULT false;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS operations_hold_reason text;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS operations_hold_set_at bigint;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS operations_hold_set_by text;

-- First-session preparation, in the family's words. `class_session_prep` is
-- the instructor's checklist and blockers and is deliberately not reused here:
-- it answers "is the instructor ready to teach", not "what should this child
-- bring", and showing one to answer the other would leak internal delivery
-- state to families. `StudentProgramHome.whatToBring` already existed in the
-- type with no column behind it, so the student page had a preparation section
-- that could never render anything.
ALTER TABLE programs ADD COLUMN IF NOT EXISTS what_to_bring text;

-- Program-level audit. `registration_audit_events` is keyed to a registration
-- and cannot hold "registration was closed for this program" or "the program
-- was cancelled" — actions whose target is the program itself. Same discipline
-- as the registration audit: state labels and a short reason, never response
-- content.
CREATE TABLE IF NOT EXISTS program_audit_events (
  id text PRIMARY KEY,
  program_id text NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  actor_user_id text,
  actor_label text NOT NULL,
  action text NOT NULL,
  previous_state text,
  new_state text,
  reason text,
  -- How many families the action touched, so the record still means something
  -- after the affected rows have moved on.
  affected_count integer,
  created_at bigint NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_program_audit_events_program
  ON program_audit_events (program_id, created_at DESC);

/* ---------------------------------------------------------------- */
/* 3. Registration provenance.                                       */
/* ---------------------------------------------------------------- */

-- How this registration came to exist. An admin registering a child on behalf
-- of a family runs the *same* engine — same capacity lock, same duplicate
-- check, same requirement instantiation — so this column records provenance
-- only. It must never be read as permission to skip a check; there is no
-- bypass path for it to mark.
ALTER TABLE program_registrations
  ADD COLUMN IF NOT EXISTS created_via text NOT NULL DEFAULT 'family';
ALTER TABLE program_registrations
  ADD COLUMN IF NOT EXISTS created_by_user_id text;
-- Set when an admin restores a terminal registration, so a restored row is
-- never mistaken for one that was live all along.
ALTER TABLE program_registrations ADD COLUMN IF NOT EXISTS restored_at bigint;
ALTER TABLE program_registrations ADD COLUMN IF NOT EXISTS restored_from_status text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'program_registrations_created_via_check'
  ) THEN
    ALTER TABLE program_registrations ADD CONSTRAINT program_registrations_created_via_check
      CHECK (created_via IN ('family', 'admin', 'import'));
  END IF;
END $$;

/* ---------------------------------------------------------------- */
/* 4. Duplicate-child review.                                        */
/* ---------------------------------------------------------------- */

-- 019 flags a possible duplicate by setting students.duplicate_review_status,
-- but a flag on one row cannot say *which* other child it might be, and a
-- decision has to be recorded against the pair or it will be re-raised every
-- sweep. Children are never merged on a name match: this table exists so a
-- human comparison is the only thing that can resolve one.
CREATE TABLE IF NOT EXISTS student_duplicate_reviews (
  id text PRIMARY KEY,
  -- Ordered pair, lower id first, so the same two children cannot produce two
  -- competing review rows.
  student_id text NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  other_student_id text NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN (
      'open',
      -- A human confirmed these are two different children. Permanent: the
      -- detector must not raise this pair again.
      'distinct',
      'merged',
      -- Explicitly postponed, still visible in the queue.
      'deferred'
    )),
  -- Which row survived a merge. Null unless status = 'merged'.
  canonical_student_id text REFERENCES students(id) ON DELETE SET NULL,
  detected_reason text,
  resolution_note text,
  resolved_by_user_id text,
  resolved_at bigint,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  CHECK (student_id < other_student_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_duplicate_reviews_pair
  ON student_duplicate_reviews (student_id, other_student_id);
CREATE INDEX IF NOT EXISTS idx_student_duplicate_reviews_open
  ON student_duplicate_reviews (status) WHERE status = 'open';

/* ---------------------------------------------------------------- */
/* 5. Family support notes and delivery attempts.                    */
/* ---------------------------------------------------------------- */

-- What an admin did for a family and why. Keyed to the person, optionally to a
-- child/program, so a support history survives a registration ending.
CREATE TABLE IF NOT EXISTS family_support_notes (
  id text PRIMARY KEY,
  person_id text REFERENCES people(id) ON DELETE CASCADE,
  student_id text REFERENCES students(id) ON DELETE CASCADE,
  program_id text REFERENCES programs(id) ON DELETE SET NULL,
  registration_id text REFERENCES program_registrations(id) ON DELETE SET NULL,
  note text NOT NULL,
  -- 'contact' for reaching out, 'action' for a change made, 'issue' for a
  -- problem still open.
  kind text NOT NULL DEFAULT 'note' CHECK (kind IN ('note', 'contact', 'action', 'issue')),
  resolved_at bigint,
  author_user_id text,
  author_label text NOT NULL,
  created_at bigint NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_family_support_notes_person
  ON family_support_notes (person_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_family_support_notes_student
  ON family_support_notes (student_id, created_at DESC);

-- Retry visibility. Without an attempt count and a last-attempt time, the
-- admin communications view cannot distinguish "failed once a minute ago" from
-- "failed six times over two days", which are different support situations.
ALTER TABLE family_notifications ADD COLUMN IF NOT EXISTS delivery_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE family_notifications ADD COLUMN IF NOT EXISTS last_attempt_at bigint;
-- A retry of a message that may already have been delivered has to say so
-- rather than quietly sending a second copy.
ALTER TABLE family_notifications ADD COLUMN IF NOT EXISTS last_retry_by_user_id text;

-- Existing sent rows have been delivered exactly once; recording that keeps the
-- new counter honest instead of showing every historical message as 0 attempts.
UPDATE family_notifications SET delivery_attempts = 1
  WHERE delivery_attempts = 0 AND email_status IN ('sent', 'failed');

ALTER TABLE waitlist_eligibility_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_duplicate_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_support_notes ENABLE ROW LEVEL SECURITY;
