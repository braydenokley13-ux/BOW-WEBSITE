-- ============================================================
-- 024_content_tables_reconcile.sql — make `testimonials` and `news_items`
-- match what the application actually queries.
--
-- WHY: production created these two tables by hand, long before this repo had
-- committed DDL, and `scripts/dev-bootstrap.sql` recorded an older shape:
--
--   dev-bootstrap    testimonials(name, role, quote, ...)
--                    news_items(title, body, ...)
--   the application  testimonials(quote, student_name, school_name, track_completed, ...)
--                    news_items(headline, summary, source_name, source_url,
--                               concept_tag, published_date, ...)
--
-- lib/content.ts and lib/cms/read.ts have always used the second shape, so a
-- database built entirely from committed migrations raised
-- `column "student_name" does not exist` on the homepage and on /news — the
-- exact class of failure this pass exists to eliminate. Production already has
-- the right columns, so every statement here is a no-op there.
--
-- Additive and idempotent: columns are added IF NOT EXISTS, and the backfills
-- only touch rows where the new column is still NULL, so re-running cannot
-- overwrite edited content.
-- ============================================================

-- testimonials ------------------------------------------------------------

ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS quote text;
ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS student_name text;
ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS school_name text;
ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS track_completed text;
ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS active integer NOT NULL DEFAULT 1;
ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS ordinal integer NOT NULL DEFAULT 0;
ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS created_at bigint;

-- Carry the legacy columns forward where they exist and the new ones are
-- empty. Guarded on column presence so this file is valid against both shapes.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'testimonials' AND column_name = 'name'
  ) THEN
    EXECUTE 'UPDATE testimonials SET student_name = name WHERE student_name IS NULL AND name IS NOT NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'testimonials' AND column_name = 'role'
  ) THEN
    EXECUTE 'UPDATE testimonials SET school_name = role WHERE school_name IS NULL AND role IS NOT NULL';
  END IF;
END $$;

UPDATE testimonials SET created_at = floor(extract(epoch from now()) * 1000) WHERE created_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_testimonials_active ON testimonials (active, ordinal);


-- news_items --------------------------------------------------------------

ALTER TABLE news_items ADD COLUMN IF NOT EXISTS headline text;
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS summary text;
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS source_name text;
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS concept_tag text;
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS published_date text;
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS active integer NOT NULL DEFAULT 1;
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS created_at bigint;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'news_items' AND column_name = 'title'
  ) THEN
    EXECUTE 'UPDATE news_items SET headline = title WHERE headline IS NULL AND title IS NOT NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'news_items' AND column_name = 'body'
  ) THEN
    EXECUTE 'UPDATE news_items SET summary = body WHERE summary IS NULL AND body IS NOT NULL';
  END IF;
END $$;

UPDATE news_items SET created_at = floor(extract(epoch from now()) * 1000) WHERE created_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_news_items_active ON news_items (active, created_at DESC);


-- news_submissions --------------------------------------------------------
-- Student-submitted stories, read by lib/content.ts:getPendingNewsSubmissions
-- and written by the /news submit form. Present in production, absent from
-- dev-bootstrap.sql, so a fresh database had no table behind either.

CREATE TABLE IF NOT EXISTS news_submissions (
  id text PRIMARY KEY,
  student_id text,
  headline text NOT NULL,
  summary text,
  source_url text,
  status text NOT NULL DEFAULT 'pending',
  created_at bigint NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_news_submissions_status ON news_submissions (status, created_at DESC);

ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_submissions ENABLE ROW LEVEL SECURITY;

-- Published testimonials and news are public content, on the same terms as
-- everything else in migration 023: read-only, published rows only.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'testimonials' AND policyname = 'testimonials_public_read') THEN
    CREATE POLICY testimonials_public_read ON testimonials FOR SELECT TO anon, authenticated USING (active = 1);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'news_items' AND policyname = 'news_items_public_read') THEN
    CREATE POLICY news_items_public_read ON news_items FOR SELECT TO anon, authenticated USING (active = 1);
  END IF;
END $$;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON testimonials FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON news_items FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON news_submissions FROM anon, authenticated;
