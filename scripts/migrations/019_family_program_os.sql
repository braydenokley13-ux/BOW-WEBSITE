-- Family + program operating system: registration lifecycle, seat reservations,
-- requirements, waitlist offers, guardian identity, parent activation,
-- family notifications, and consequential-action audit.
--
-- Additive only. This closes the gaps that made the launch-pass registration
-- flow (012_public_programs.sql) unable to run a real program:
--
--   1. `program_registrations.status` had four values ('confirmed', 'pending',
--      'waitlisted', 'declined') and no reservation, so a seat could never be
--      held while a family completed required forms, and nothing could expire.
--   2. Capacity was decided by an unlocked COUNT followed by an INSERT. Two
--      concurrent requests could both read "one seat left" and both take it.
--      The fix is a lock target: `classes.seat_lock` is the row every seat
--      decision serializes on via SELECT ... FOR UPDATE.
--   3. Idempotency lived only in the derived primary key, so a replay with a
--      materially different payload silently returned the original result
--      instead of failing safely. `request_key` + `payload_fingerprint` make
--      that detectable.
--   4. `students.guardian_person_id` allowed exactly one guardian and public
--      registration created a brand new Student for every program, so a second
--      registration duplicated the child. `student_guardians` makes the
--      guardian link many-to-many and `students.identity_key` gives the
--      reconciliation queue something better than a name to compare.
--   5. There were no program requirements, no waitlist offers, no parent
--      account activation, no family-facing notification record, and no audit
--      trail for admin decisions. All are created here.
--
-- Existing rows keep working: every current registration status remains legal,
-- reservations default to disabled, and programs default to no requirements.

/* ---------------------------------------------------------------- */
/* 1. Program-level registration, waitlist, and completion config.   */
/* ---------------------------------------------------------------- */

ALTER TABLE programs ADD COLUMN IF NOT EXISTS internal_description text;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS experience_level text;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS grade_min integer;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS grade_max integer;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS registration_opens_at text;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS reservation_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS reservation_hours integer NOT NULL DEFAULT 72;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS waitlist_mode text NOT NULL DEFAULT 'disabled';
ALTER TABLE programs ADD COLUMN IF NOT EXISTS waitlist_offer_hours integer NOT NULL DEFAULT 48;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS confirmation_message text;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS next_steps_message text;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS support_contact text;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS completion_min_attendance integer;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS completion_requires_instructor boolean NOT NULL DEFAULT false;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS completion_requires_admin boolean NOT NULL DEFAULT true;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS certificate_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS feedback_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS recommended_next_program_id text;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS prerequisite_program_id text;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS registration_opened_at bigint;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS registration_opened_by text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'programs_waitlist_mode_check') THEN
    ALTER TABLE programs ADD CONSTRAINT programs_waitlist_mode_check
      CHECK (waitlist_mode IN ('disabled', 'automatic', 'manual'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'programs_reservation_hours_check') THEN
    ALTER TABLE programs ADD CONSTRAINT programs_reservation_hours_check
      CHECK (reservation_hours > 0 AND reservation_hours <= 24 * 60);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'programs_waitlist_offer_hours_check') THEN
    ALTER TABLE programs ADD CONSTRAINT programs_waitlist_offer_hours_check
      CHECK (waitlist_offer_hours > 0 AND waitlist_offer_hours <= 24 * 60);
  END IF;
END $$;

-- `full_capacity_behavior` predates waitlist_mode. Keep both meaningful by
-- deriving the new field once from the old one for existing programs.
UPDATE programs SET waitlist_mode = 'automatic'
 WHERE waitlist_mode = 'disabled' AND full_capacity_behavior = 'waitlist';

/* ---------------------------------------------------------------- */
/* 2. The seat lock.                                                 */
/* ---------------------------------------------------------------- */

-- Every seat decision for a class serializes on this row. It exists so the
-- transaction has something to SELECT ... FOR UPDATE that is guaranteed to be
-- present even when the class currently has zero enrollments (locking the
-- enrollment rows themselves cannot prevent a phantom INSERT under READ
-- COMMITTED). The counter is advisory only — `class_enrollments` remains the
-- source of truth for who holds a seat.
ALTER TABLE classes ADD COLUMN IF NOT EXISTS seat_lock bigint NOT NULL DEFAULT 0;

/* ---------------------------------------------------------------- */
/* 3. Canonical family identity.                                     */
/* ---------------------------------------------------------------- */

-- Many-to-many guardian <-> student. `students.guardian_person_id` stays as
-- the primary-guardian pointer so existing reads keep working; this table is
-- the authoritative relationship set (second parent, invited guardian, and
-- the permissions each one holds).
CREATE TABLE IF NOT EXISTS student_guardians (
  id text PRIMARY KEY,
  student_id text NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  person_id text NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  relationship text,
  is_primary boolean NOT NULL DEFAULT false,
  can_register boolean NOT NULL DEFAULT true,
  can_view_sensitive boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'revoked')),
  invited_by_person_id text REFERENCES people(id) ON DELETE SET NULL,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  UNIQUE (student_id, person_id)
);

CREATE INDEX IF NOT EXISTS idx_student_guardians_person ON student_guardians (person_id);
CREATE INDEX IF NOT EXISTS idx_student_guardians_student ON student_guardians (student_id);

-- Backfill the relationship set from the existing single-guardian pointer so
-- the new table is authoritative from the first read.
INSERT INTO student_guardians (id, student_id, person_id, relationship, is_primary, status, created_at, updated_at)
SELECT 'sg-' || replace(gen_random_uuid()::text, '-', ''), s.id, s.guardian_person_id, 'guardian', true, 'active', s.created_at, s.updated_at
  FROM students s
 WHERE s.guardian_person_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM student_guardians g WHERE g.student_id = s.id AND g.person_id = s.guardian_person_id
   );

-- Reconciliation aid for the duplicate-child review queue. Deliberately NOT
-- unique and never used to merge automatically: a name match alone must never
-- collapse two children (siblings share surnames; families reuse first names).
ALTER TABLE students ADD COLUMN IF NOT EXISTS identity_key text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS duplicate_review_status text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS merged_into_student_id text REFERENCES students(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_duplicate_review_status_check') THEN
    ALTER TABLE students ADD CONSTRAINT students_duplicate_review_status_check
      CHECK (duplicate_review_status IS NULL OR duplicate_review_status IN ('open', 'distinct', 'merged'));
  END IF;
END $$;

UPDATE students
   SET identity_key = lower(regexp_replace(trim(name), '\s+', ' ', 'g')) || '|' || coalesce(lower(trim(grade)), '')
 WHERE identity_key IS NULL;

CREATE INDEX IF NOT EXISTS idx_students_identity_key ON students (identity_key);

/* ---------------------------------------------------------------- */
/* 4. The registration lifecycle.                                    */
/* ---------------------------------------------------------------- */

ALTER TABLE program_registrations ADD COLUMN IF NOT EXISTS request_key text;
ALTER TABLE program_registrations ADD COLUMN IF NOT EXISTS payload_fingerprint text;
ALTER TABLE program_registrations ADD COLUMN IF NOT EXISTS reservation_expires_at bigint;
ALTER TABLE program_registrations ADD COLUMN IF NOT EXISTS reservation_extended_count integer NOT NULL DEFAULT 0;
ALTER TABLE program_registrations ADD COLUMN IF NOT EXISTS waitlist_seq bigint;
ALTER TABLE program_registrations ADD COLUMN IF NOT EXISTS holds_seat boolean NOT NULL DEFAULT false;
ALTER TABLE program_registrations ADD COLUMN IF NOT EXISTS confirmed_at bigint;
ALTER TABLE program_registrations ADD COLUMN IF NOT EXISTS withdrawn_at bigint;
ALTER TABLE program_registrations ADD COLUMN IF NOT EXISTS completed_at bigint;
ALTER TABLE program_registrations ADD COLUMN IF NOT EXISTS completion_status text;
ALTER TABLE program_registrations ADD COLUMN IF NOT EXISTS decided_by_user_id text;
ALTER TABLE program_registrations ADD COLUMN IF NOT EXISTS decided_at bigint;
ALTER TABLE program_registrations ADD COLUMN IF NOT EXISTS decision_reason text;
ALTER TABLE program_registrations ADD COLUMN IF NOT EXISTS admin_notes text;
ALTER TABLE program_registrations ADD COLUMN IF NOT EXISTS submitted_by_person_id text REFERENCES people(id) ON DELETE SET NULL;

-- `holds_seat` is the single answer to "does this registration occupy one of
-- the class's finite seats?" — true for a live reservation, a confirmed seat,
-- and an outstanding waitlist offer alike. Capacity math reads this one
-- column so a registration can never be counted twice or missed.
UPDATE program_registrations SET holds_seat = true WHERE status = 'confirmed' AND holds_seat = false;
UPDATE program_registrations SET confirmed_at = created_at WHERE status = 'confirmed' AND confirmed_at IS NULL;

-- Widen the lifecycle. The old four values are all still legal, so no existing
-- row is invalidated; 'pending' is retained as a synonym the engine no longer
-- writes (it now writes 'under_review').
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'program_registrations_status_check') THEN
    ALTER TABLE program_registrations DROP CONSTRAINT program_registrations_status_check;
  END IF;
  ALTER TABLE program_registrations ADD CONSTRAINT program_registrations_status_check
    CHECK (status IN (
      'submitted', 'under_review', 'pending', 'seat_reserved', 'requirements_pending',
      'confirmed', 'waitlisted', 'offer_sent', 'offer_accepted',
      'withdrawn', 'expired', 'declined', 'cancelled', 'completed'
    ));
END $$;

-- One live registration per child per program. Terminal states are excluded so
-- a family that withdrew can register again later, and the partial index still
-- makes the duplicate-registration check a single indexed lookup.
CREATE UNIQUE INDEX IF NOT EXISTS uq_program_registrations_live
  ON program_registrations (program_id, student_id)
  WHERE status NOT IN ('withdrawn', 'expired', 'declined', 'cancelled');

CREATE UNIQUE INDEX IF NOT EXISTS uq_program_registrations_request_key
  ON program_registrations (request_key) WHERE request_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_program_registrations_status ON program_registrations (program_id, status);
CREATE INDEX IF NOT EXISTS idx_program_registrations_reservation
  ON program_registrations (reservation_expires_at) WHERE reservation_expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_program_registrations_guardian ON program_registrations (guardian_person_id);

-- Waitlist ordering. A monotonic sequence is the understandable ordering model
-- (first waitlisted, first offered); it is deliberately not exposed to families
-- as a position because eligibility checks and manual admin selection can skip
-- entries, which would make a displayed number wrong.
CREATE SEQUENCE IF NOT EXISTS program_waitlist_seq;

/* ---------------------------------------------------------------- */
/* 5. Program requirements.                                          */
/* ---------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS program_requirements (
  id text PRIMARY KEY,
  program_id text NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  kind text NOT NULL,
  prompt text NOT NULL,
  help_text text,
  scope text NOT NULL DEFAULT 'student' CHECK (scope IN ('student', 'family')),
  required boolean NOT NULL DEFAULT true,
  blocks_confirmation boolean NOT NULL DEFAULT false,
  staff_approval_required boolean NOT NULL DEFAULT false,
  visibility text NOT NULL DEFAULT 'admin' CHECK (visibility IN ('admin', 'admin_instructor', 'instructor_summary')),
  choices text,
  due_days_before_start integer,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'program_requirements_kind_check') THEN
    ALTER TABLE program_requirements ADD CONSTRAINT program_requirements_kind_check
      CHECK (kind IN (
        'emergency_contact', 'medical', 'accessibility', 'photo_consent', 'agreement',
        'waiver', 'student_interests', 'prior_experience', 'school', 'grade_verification',
        'logistics_ack', 'short_response', 'choice', 'file_upload'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_program_requirements_program ON program_requirements (program_id, sort_order);

CREATE TABLE IF NOT EXISTS registration_requirements (
  id text PRIMARY KEY,
  registration_id text NOT NULL REFERENCES program_registrations(id) ON DELETE CASCADE,
  requirement_id text NOT NULL REFERENCES program_requirements(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'submitted', 'approved', 'needs_correction', 'waived')),
  response text,
  due_at bigint,
  submitted_at bigint,
  reviewed_at bigint,
  reviewed_by_user_id text,
  review_note text,
  waived_by_user_id text,
  waiver_reason text,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  UNIQUE (registration_id, requirement_id)
);

CREATE INDEX IF NOT EXISTS idx_registration_requirements_registration
  ON registration_requirements (registration_id);
CREATE INDEX IF NOT EXISTS idx_registration_requirements_status
  ON registration_requirements (status);

/* ---------------------------------------------------------------- */
/* 6. Waitlist offers.                                               */
/* ---------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS waitlist_offers (
  id text PRIMARY KEY,
  registration_id text NOT NULL REFERENCES program_registrations(id) ON DELETE CASCADE,
  program_id text NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  class_id text REFERENCES classes(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'accepted', 'declined', 'expired', 'revoked')),
  mode text NOT NULL DEFAULT 'automatic' CHECK (mode IN ('automatic', 'manual')),
  token_hash text NOT NULL,
  expires_at bigint NOT NULL,
  responded_at bigint,
  created_by_user_id text,
  reason text,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

-- One outstanding offer per registration. Overbooking is prevented at the seat
-- layer (an offer sets holds_seat = true), so two families can never be sent an
-- offer for the same single seat.
CREATE UNIQUE INDEX IF NOT EXISTS uq_waitlist_offers_open
  ON waitlist_offers (registration_id) WHERE status = 'sent';
CREATE INDEX IF NOT EXISTS idx_waitlist_offers_program ON waitlist_offers (program_id, status);
CREATE INDEX IF NOT EXISTS idx_waitlist_offers_expiry ON waitlist_offers (expires_at) WHERE status = 'sent';

/* ---------------------------------------------------------------- */
/* 7. Parent account activation.                                     */
/* ---------------------------------------------------------------- */

-- Registration happens before account activation, so this is the bridge from
-- "a guardian Person we captured" to "a real signed-in account". `state` is
-- explicit rather than inferred because Supabase identity provisioning can
-- fail independently of the local record.
CREATE TABLE IF NOT EXISTS parent_activations (
  id text PRIMARY KEY,
  person_id text NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  email text NOT NULL,
  token_hash text NOT NULL,
  state text NOT NULL DEFAULT 'invitation_pending'
    CHECK (state IN (
      'invitation_pending', 'identity_created', 'family_linked',
      'complete', 'expired', 'failed', 'support_required'
    )),
  user_id text,
  expires_at bigint NOT NULL,
  consumed_at bigint,
  failure_reason text,
  resend_count integer NOT NULL DEFAULT 0,
  last_sent_at bigint,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_parent_activations_token ON parent_activations (token_hash);
CREATE INDEX IF NOT EXISTS idx_parent_activations_person ON parent_activations (person_id, state);
CREATE INDEX IF NOT EXISTS idx_parent_activations_email ON parent_activations (lower(email));

/* ---------------------------------------------------------------- */
/* 8. Family notifications and family-initiated requests.            */
/* ---------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS family_notifications (
  id text PRIMARY KEY,
  person_id text REFERENCES people(id) ON DELETE CASCADE,
  student_id text REFERENCES students(id) ON DELETE CASCADE,
  program_id text REFERENCES programs(id) ON DELETE CASCADE,
  registration_id text REFERENCES program_registrations(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  action_label text,
  action_href text,
  urgency text NOT NULL DEFAULT 'normal' CHECK (urgency IN ('normal', 'important', 'urgent')),
  requires_acknowledgment boolean NOT NULL DEFAULT false,
  acknowledged_at bigint,
  email_status text NOT NULL DEFAULT 'not_sent'
    CHECK (email_status IN ('not_sent', 'queued', 'sent', 'failed', 'skipped')),
  email_error text,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_family_notifications_person ON family_notifications (person_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_family_notifications_registration ON family_notifications (registration_id);
CREATE INDEX IF NOT EXISTS idx_family_notifications_failed ON family_notifications (email_status) WHERE email_status = 'failed';

CREATE TABLE IF NOT EXISTS family_requests (
  id text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('schedule_change', 'transfer', 'withdrawal', 'absence_notice', 'info_update')),
  registration_id text REFERENCES program_registrations(id) ON DELETE CASCADE,
  student_id text NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  requested_by_person_id text REFERENCES people(id) ON DELETE SET NULL,
  session_id text,
  detail text,
  reason text,
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'under_review', 'approved', 'declined', 'completed', 'cancelled')),
  resolution_note text,
  resolved_by_user_id text,
  resolved_at bigint,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_family_requests_status ON family_requests (status, created_at);
CREATE INDEX IF NOT EXISTS idx_family_requests_student ON family_requests (student_id);

/* ---------------------------------------------------------------- */
/* 9. Completion records and certificates.                           */
/* ---------------------------------------------------------------- */

-- The existing `certificates` table keys off `users.id`, which a registered
-- child does not have until (and unless) a student account is activated. This
-- record is keyed to the registration instead, so a participation record can
-- exist for a child who never logs in.
CREATE TABLE IF NOT EXISTS program_completion_records (
  id text PRIMARY KEY,
  registration_id text NOT NULL REFERENCES program_registrations(id) ON DELETE CASCADE,
  program_id text NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  student_id text NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  outcome text NOT NULL CHECK (outcome IN ('completed', 'participated', 'not_completed')),
  sessions_attended integer NOT NULL DEFAULT 0,
  sessions_total integer NOT NULL DEFAULT 0,
  attendance_rate integer,
  summary text,
  certificate_serial text,
  certificate_issued_at bigint,
  issued_by_user_id text,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  UNIQUE (registration_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_program_completion_serial
  ON program_completion_records (certificate_serial) WHERE certificate_serial IS NOT NULL;

CREATE TABLE IF NOT EXISTS program_feedback (
  id text PRIMARY KEY,
  registration_id text NOT NULL REFERENCES program_registrations(id) ON DELETE CASCADE,
  author text NOT NULL CHECK (author IN ('parent', 'student')),
  overall integer,
  communication integer,
  engagement integer,
  recommend integer,
  enjoyed text,
  difficult text,
  wants_another boolean,
  comment text,
  created_at bigint NOT NULL,
  UNIQUE (registration_id, author)
);

/* ---------------------------------------------------------------- */
/* 10. Audit trail for consequential actions.                        */
/* ---------------------------------------------------------------- */

-- Deliberately stores state labels and a short reason, never the sensitive
-- response values themselves — an audit row must be safe to show to any staff
-- member who can see the registration.
CREATE TABLE IF NOT EXISTS registration_audit_events (
  id text PRIMARY KEY,
  registration_id text REFERENCES program_registrations(id) ON DELETE CASCADE,
  student_id text REFERENCES students(id) ON DELETE CASCADE,
  program_id text REFERENCES programs(id) ON DELETE CASCADE,
  actor_user_id text,
  actor_label text NOT NULL,
  action text NOT NULL,
  previous_state text,
  new_state text,
  reason text,
  created_at bigint NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_registration_audit_registration
  ON registration_audit_events (registration_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_registration_audit_program
  ON registration_audit_events (program_id, created_at DESC);

ALTER TABLE student_guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_completion_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_audit_events ENABLE ROW LEVEL SECURITY;
