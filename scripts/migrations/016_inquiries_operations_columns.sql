-- ============================================================
-- 016_inquiries_operations_columns.sql
--
-- `inquiries` is one of the pre-migrations tables. Its real (production)
-- shape is wider than the stub in scripts/dev-bootstrap.sql: the operations
-- model and the public forms both use
-- (id, organization_id, name, email, type, org_name, date, status, summary).
-- Against a database built only from the stub, two things break outright:
--
--   * the public contact / partnership forms fail on INSERT
--     (app/actions/public-forms.ts), and
--   * the founder home renders a permanent loading skeleton, because
--     `SELECT * FROM inquiries ORDER BY date DESC` in lib/operations.ts
--     throws inside the Suspense boundary and the page still returns 200.
--
-- Also adds `submitted_at`. `date` is free text and is written in two
-- different formats by the two insert paths ("2026-07-28" from the contact
-- form, "Jul 28, 2026" from the partnership form), so ordering by it is
-- alphabetical and wrong in both directions. `submitted_at` is the epoch-ms
-- value the rest of the schema uses; the backfill below recovers it for
-- existing rows where the text is parseable and leaves the rest NULL, which
-- the new ORDER BY sorts last.
--
-- All statements are IF NOT EXISTS / idempotent, so this is a no-op against
-- a database that already has the columns.
-- ============================================================

ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS organization_id text;
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS org_name text;
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS date text;
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS summary text;
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS submitted_at bigint;

-- Backfill submitted_at: prefer an existing created_at, else parse `date` in
-- whichever of the two written formats it matches. Anything unparseable stays
-- NULL rather than being guessed at.
UPDATE inquiries
   SET submitted_at = created_at
 WHERE submitted_at IS NULL AND created_at IS NOT NULL;

UPDATE inquiries
   SET submitted_at = floor(extract(epoch from to_date(date, 'YYYY-MM-DD')) * 1000)
 WHERE submitted_at IS NULL AND date ~ '^\d{4}-\d{2}-\d{2}$';

UPDATE inquiries
   SET submitted_at = floor(extract(epoch from to_date(date, 'Mon DD, YYYY')) * 1000)
 WHERE submitted_at IS NULL AND date ~ '^[A-Z][a-z]{2} \d{1,2}, \d{4}$';

CREATE INDEX IF NOT EXISTS idx_inquiries_submitted_at ON inquiries (submitted_at DESC);
