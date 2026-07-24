-- Instructor referral attribution — the smallest clean link.
--
-- Additive only. The canonical `instructors` row travels the whole lifecycle
-- (applied → accepted → active), so one nullable pointer to the referring
-- Person turns "who referred this instructor?" into a single join, and
-- "how many of X's referrals became active?" into one GROUP BY. Instructor-
-- submitted referrals of prospects who have not applied yet continue to live
-- in the existing `growth_introductions` spine (target_kind = 'instructor');
-- this column records the confirmed link once the prospect becomes a record.

ALTER TABLE instructors ADD COLUMN IF NOT EXISTS referred_by_person_id text REFERENCES people(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_instructors_referred_by
  ON instructors (referred_by_person_id)
  WHERE referred_by_person_id IS NOT NULL;
