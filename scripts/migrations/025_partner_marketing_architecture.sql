-- ============================================================
-- 025_partner_marketing_architecture.sql
--
-- Adds the small amount of durable data needed by the partner-focused public
-- site. Existing page versions and curriculum records stay intact.
-- ============================================================

-- The upgrade script uses this marker to publish the new information
-- architecture once. Later deploys therefore never overwrite owner edits.
ALTER TABLE site_pages
  ADD COLUMN IF NOT EXISTS architecture_version integer NOT NULL DEFAULT 1;

-- Primary marketing pages remain easy to find in BOW HQ. Older resources can
-- stay reachable without cluttering the owner's Website page list or sitemap.
ALTER TABLE site_pages
  ADD COLUMN IF NOT EXISTS cms_visible boolean NOT NULL DEFAULT true;

-- A publication is shared credibility content. It is deliberately separate
-- from news_items, which contains sports-business reading rather than press
-- coverage about BOW.
CREATE TABLE IF NOT EXISTS site_publications (
  id text PRIMARY KEY,
  name text NOT NULL,
  logo_url text,
  article_title text NOT NULL,
  article_url text NOT NULL,
  publication_date date,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  ordinal integer NOT NULL DEFAULT 0,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  updated_by_user_id text
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_site_publications_article_url
  ON site_publications (article_url);
CREATE INDEX IF NOT EXISTS idx_site_publications_public
  ON site_publications (status, ordinal, publication_date);

-- Widen the constrained section vocabulary with the designed press section.
-- PostgreSQL generates the original constraint name from the table/column.
ALTER TABLE site_page_sections
  DROP CONSTRAINT IF EXISTS site_page_sections_kind_check;
ALTER TABLE site_page_sections
  ADD CONSTRAINT site_page_sections_kind_check CHECK (kind IN (
    'hero',
    'text',
    'feature_cards',
    'stats',
    'program_collection',
    'track_collection',
    'testimonials',
    'press',
    'faq',
    'cta',
    'announcement',
    'steps',
    'image_text',
    'contact',
    'list',
    'decision_demo',
    'media_list',
    'nav_menu',
    'footer_columns',
    'global_settings'
  ));

-- Public database clients may read only explicitly published coverage. The
-- application server remains the sole write path and enforces the admin role.
ALTER TABLE site_publications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE tablename = 'site_publications'
       AND policyname = 'site_publications_public_read'
  ) THEN
    CREATE POLICY site_publications_public_read ON site_publications FOR SELECT
      TO anon, authenticated
      USING (status = 'published');
  END IF;
END $$;

GRANT SELECT ON site_publications TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON site_publications FROM anon, authenticated;
