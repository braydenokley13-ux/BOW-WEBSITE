-- Launch pass: public program discovery + parent-led registration.
--
-- Additive only. Extends the existing `programs` operating record with the
-- facts a public program card/registration flow needs; the internal B2B
-- delivery pipeline (stage, partner, staffing, readiness) is untouched.
-- `program_registrations` layers registration-submission metadata on top of
-- the canonical `students` / `people` / `class_enrollments` identity model
-- instead of duplicating it — a registration always resolves to a real
-- Student + guardian Person, and (once confirmed) a real class_enrollments
-- row, so it shows up in the Program's existing Roster automatically.

ALTER TABLE programs ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS public_status text;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS short_description text;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS long_description text;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS grade_range text;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS registration_mode text NOT NULL DEFAULT 'immediate';
ALTER TABLE programs ADD COLUMN IF NOT EXISTS full_capacity_behavior text NOT NULL DEFAULT 'waitlist';
ALTER TABLE programs ADD COLUMN IF NOT EXISTS registration_deadline text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'programs_public_status_check'
  ) THEN
    ALTER TABLE programs ADD CONSTRAINT programs_public_status_check
      CHECK (public_status IS NULL OR public_status IN ('coming_soon', 'open', 'full', 'closed'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'programs_registration_mode_check'
  ) THEN
    ALTER TABLE programs ADD CONSTRAINT programs_registration_mode_check
      CHECK (registration_mode IN ('immediate', 'approval'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'programs_full_capacity_behavior_check'
  ) THEN
    ALTER TABLE programs ADD CONSTRAINT programs_full_capacity_behavior_check
      CHECK (full_capacity_behavior IN ('close', 'waitlist', 'continue'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_programs_public ON programs (is_public) WHERE is_public = true;

-- Guardian city/state are generically useful Person attributes surfaced by
-- registration and general-interest forms alike.
ALTER TABLE people ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE people ADD COLUMN IF NOT EXISTS state text;

-- Students already carry `grade`; `school` is a reusable attribute the
-- public registration form collects and staff can see on the roster.
ALTER TABLE students ADD COLUMN IF NOT EXISTS school text;

CREATE TABLE IF NOT EXISTS program_registrations (
  id text PRIMARY KEY,
  program_id text NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  class_id text REFERENCES classes(id) ON DELETE SET NULL,
  student_id text NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  guardian_person_id text REFERENCES people(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'pending', 'waitlisted', 'declined')),
  referral_source text,
  created_at double precision NOT NULL,
  updated_at double precision NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_program_registrations_program ON program_registrations (program_id);
CREATE INDEX IF NOT EXISTS idx_program_registrations_student ON program_registrations (student_id);

ALTER TABLE program_registrations ENABLE ROW LEVEL SECURITY;
