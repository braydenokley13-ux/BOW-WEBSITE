-- ============================================================
-- 023_site_content_os.sql — the site content system.
--
-- Everything a public visitor reads becomes a database record the founder can
-- edit from BOW HQ → Website. Three ideas carry the whole design:
--
--   1. A *document* (`site_pages`) is anything with a public URL or a
--      site-wide role: a marketing page, a track page, a program page, or one
--      of the three singletons (navigation, footer, global settings).
--   2. A document has *versions* (`site_page_versions`). Exactly one may be
--      published; edits accumulate on a separate draft. Publishing swaps the
--      pointer, so the previous published version survives and rollback is a
--      pointer move, not a restore.
--   3. A version owns ordered, typed *sections* (`site_page_sections`). The
--      `kind` is constrained to the layouts the site already renders, so the
--      founder picks from real designs instead of authoring markup.
--
-- FAQs and announcements are separate tables because they are genuinely
-- relational: one FAQ appears on several pages/programs/tracks, and an
-- announcement has a date window that expires on its own.
--
-- Structured offering facts (grade range, dates, price, registration status)
-- stay on the existing `programs` and `curricula` records rather than being
-- copied into a parallel CMS table. Tracks are the public face of `curricula`;
-- programs are the public face of `programs`.
--
-- Additive and forward-only: every statement is IF NOT EXISTS / ADD COLUMN IF
-- NOT EXISTS / guarded DO-block, so applying it twice, or to a database that
-- already has part of it, is a no-op.
--
-- Conventions match 018-022: text primary keys, bigint epoch-millisecond
-- timestamps, real `boolean` for flags, text columns with CHECK constraints
-- instead of Postgres enums (so a later migration can widen them without an
-- ALTER TYPE lock).
-- ============================================================


-- ------------------------------------------------------------
-- Documents
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS site_pages (
  id text PRIMARY KEY,
  -- 'page'    a standalone marketing route (/, /about, /programs/find …)
  -- 'track'   the public face of a curricula row (/programs/track-101)
  -- 'program' the public face of a programs row (/programs/p/<slug>)
  -- 'system'  a singleton: navigation, footer, settings
  kind text NOT NULL DEFAULT 'page' CHECK (kind IN ('page', 'track', 'program', 'system')),
  slug text NOT NULL UNIQUE,
  -- Public route. NULL for 'system' documents, which have no URL of their own.
  path text,
  -- The curricula.id / programs.id this document presents, for kind in
  -- ('track','program'). Deliberately not a foreign key: a document may be
  -- authored before its offering record exists, and deleting an offering
  -- should surface as a broken link in the editor rather than silently
  -- cascading published content away.
  entity_id text,
  name text NOT NULL,
  -- Internal note for the founder's own list view; never rendered publicly.
  description text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  -- The version the public site renders. NULL until first publish.
  published_version_id text,
  -- The version the editor writes into. Created on demand.
  draft_version_id text,
  -- System pages back a hand-built route and cannot be deleted or re-slugged.
  is_system boolean NOT NULL DEFAULT false,
  ordinal integer NOT NULL DEFAULT 0,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  updated_by_user_id text
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_site_pages_path ON site_pages (path) WHERE path IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_site_pages_kind ON site_pages (kind, status);
CREATE INDEX IF NOT EXISTS idx_site_pages_entity ON site_pages (kind, entity_id) WHERE entity_id IS NOT NULL;


CREATE TABLE IF NOT EXISTS site_page_versions (
  id text PRIMARY KEY,
  page_id text NOT NULL REFERENCES site_pages(id) ON DELETE CASCADE,
  version_no integer NOT NULL,
  -- 'draft'      the working copy; never public
  -- 'published'  currently pointed at by site_pages.published_version_id
  -- 'superseded' a previously published version, kept for rollback
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'published', 'superseded')),
  title text,
  seo_title text,
  seo_description text,
  social_image_url text,
  noindex boolean NOT NULL DEFAULT false,
  note text,
  created_at bigint NOT NULL,
  created_by_user_id text,
  published_at bigint,
  published_by_user_id text
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_site_page_versions_no ON site_page_versions (page_id, version_no);
CREATE INDEX IF NOT EXISTS idx_site_page_versions_page ON site_page_versions (page_id, state);


CREATE TABLE IF NOT EXISTS site_page_sections (
  id text PRIMARY KEY,
  version_id text NOT NULL REFERENCES site_page_versions(id) ON DELETE CASCADE,
  -- Constrained on purpose. Each kind maps to a real, designed layout in
  -- components/site/sections; there is no free-form HTML section, so a
  -- founder cannot author something the design system cannot render.
  kind text NOT NULL CHECK (kind IN (
    'hero',
    'text',
    'feature_cards',
    'stats',
    'program_collection',
    'track_collection',
    'testimonials',
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
  )),
  ordinal integer NOT NULL DEFAULT 0,
  hidden boolean NOT NULL DEFAULT false,
  -- Shape is validated by the zod schema for `kind` (lib/cms/sections.ts)
  -- before any write, and again on read.
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_site_page_sections_version ON site_page_sections (version_id, ordinal);


-- The pointer columns are declared after both tables exist so the file stays
-- a single forward-only unit rather than two interleaved CREATEs.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_pages_published_version_fk') THEN
    ALTER TABLE site_pages ADD CONSTRAINT site_pages_published_version_fk
      FOREIGN KEY (published_version_id) REFERENCES site_page_versions(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_pages_draft_version_fk') THEN
    ALTER TABLE site_pages ADD CONSTRAINT site_pages_draft_version_fk
      FOREIGN KEY (draft_version_id) REFERENCES site_page_versions(id) ON DELETE SET NULL;
  END IF;
END $$;


-- ------------------------------------------------------------
-- FAQs — reusable, placeable on many surfaces
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS site_faqs (
  id text PRIMARY KEY,
  question text NOT NULL,
  answer text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  ordinal integer NOT NULL DEFAULT 0,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  updated_by_user_id text
);

CREATE INDEX IF NOT EXISTS idx_site_faqs_status ON site_faqs (status, ordinal);

CREATE TABLE IF NOT EXISTS site_faq_placements (
  id text PRIMARY KEY,
  faq_id text NOT NULL REFERENCES site_faqs(id) ON DELETE CASCADE,
  -- 'page'    scope_key = site_pages.slug
  -- 'track'   scope_key = curricula.public_slug
  -- 'program' scope_key = programs.public_slug
  scope_kind text NOT NULL CHECK (scope_kind IN ('page', 'track', 'program')),
  scope_key text NOT NULL,
  ordinal integer NOT NULL DEFAULT 0,
  created_at bigint NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_site_faq_placements_unique
  ON site_faq_placements (faq_id, scope_kind, scope_key);
CREATE INDEX IF NOT EXISTS idx_site_faq_placements_scope
  ON site_faq_placements (scope_kind, scope_key, ordinal);


-- ------------------------------------------------------------
-- Announcements — message + optional link + date window
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS site_announcements (
  id text PRIMARY KEY,
  message text NOT NULL,
  link_href text,
  link_label text,
  -- Epoch ms. NULL start = "already running"; NULL end = "until turned off".
  starts_at bigint,
  ends_at bigint,
  -- 'site' shows on every public page; 'page' only on `page_slug`.
  placement text NOT NULL DEFAULT 'site' CHECK (placement IN ('site', 'page')),
  page_slug text,
  audience text NOT NULL DEFAULT 'everyone'
    CHECK (audience IN ('everyone', 'families', 'schools', 'instructors')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  ordinal integer NOT NULL DEFAULT 0,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  updated_by_user_id text
);

CREATE INDEX IF NOT EXISTS idx_site_announcements_live
  ON site_announcements (status, placement, ordinal);


-- ------------------------------------------------------------
-- Tracks — the public face of `curricula`
--
-- No parallel "tracks" table: a track *is* a curriculum, and programs already
-- reference `curricula.id`. These columns give that record a public identity
-- and publication state independent of the internal `published` flag that
-- /app/curriculum uses for curriculum authoring.
-- ------------------------------------------------------------

ALTER TABLE curricula ADD COLUMN IF NOT EXISTS public_slug text;
ALTER TABLE curricula ADD COLUMN IF NOT EXISTS public_title text;
ALTER TABLE curricula ADD COLUMN IF NOT EXISTS public_kicker text;
ALTER TABLE curricula ADD COLUMN IF NOT EXISTS headline text;
ALTER TABLE curricula ADD COLUMN IF NOT EXISTS short_description text;
ALTER TABLE curricula ADD COLUMN IF NOT EXISTS long_description text;
ALTER TABLE curricula ADD COLUMN IF NOT EXISTS grade_range text;
ALTER TABLE curricula ADD COLUMN IF NOT EXISTS audience text;
ALTER TABLE curricula ADD COLUMN IF NOT EXISTS curriculum_summary text;
ALTER TABLE curricula ADD COLUMN IF NOT EXISTS student_experience text;
ALTER TABLE curricula ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE curricula ADD COLUMN IF NOT EXISTS badge_label text;
ALTER TABLE curricula ADD COLUMN IF NOT EXISTS cta_label text;
ALTER TABLE curricula ADD COLUMN IF NOT EXISTS cta_href text;
ALTER TABLE curricula ADD COLUMN IF NOT EXISTS seo_title text;
ALTER TABLE curricula ADD COLUMN IF NOT EXISTS seo_description text;
ALTER TABLE curricula ADD COLUMN IF NOT EXISTS social_image_url text;
ALTER TABLE curricula ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;
ALTER TABLE curricula ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;
ALTER TABLE curricula ADD COLUMN IF NOT EXISTS publication_status text NOT NULL DEFAULT 'draft';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'curricula_publication_status_check') THEN
    ALTER TABLE curricula ADD CONSTRAINT curricula_publication_status_check
      CHECK (publication_status IN ('draft', 'published', 'archived'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_curricula_public_slug
  ON curricula (public_slug) WHERE public_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_curricula_publication
  ON curricula (publication_status, display_order);


-- ------------------------------------------------------------
-- Programs — public content + explicit lifecycle states
--
-- `is_public` / `public_status` (migration 012) are four values doing two
-- jobs: whether the offering exists publicly at all, and whether you can sign
-- up for it. Splitting them into `publication_status` and
-- `registration_status` is what makes CTA behaviour derivable instead of
-- guessed. The legacy pair stays in place and is kept consistent by a trigger
-- below, so every existing reader keeps working unchanged.
-- ------------------------------------------------------------

ALTER TABLE programs ADD COLUMN IF NOT EXISTS public_slug text;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS public_title text;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS curriculum_summary text;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS learning_goals text;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS student_experience text;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS session_count integer;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS session_length_minutes integer;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS is_online boolean;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS location_label text;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS price_cents integer;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS is_free boolean NOT NULL DEFAULT false;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS price_note text;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS signup_explanation text;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS interest_list_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS interest_list_explanation text;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS cta_label_override text;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS seo_title text;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS seo_description text;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS social_image_url text;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS publication_status text;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS registration_status text;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS track_curriculum_id text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'programs_publication_status_check') THEN
    ALTER TABLE programs ADD CONSTRAINT programs_publication_status_check
      CHECK (publication_status IS NULL OR publication_status IN ('draft', 'published', 'archived'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'programs_registration_status_check') THEN
    ALTER TABLE programs ADD CONSTRAINT programs_registration_status_check
      CHECK (registration_status IS NULL OR registration_status IN (
        'coming_soon', 'registration_open', 'interest_list', 'full', 'registration_closed', 'completed'
      ));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_programs_public_slug
  ON programs (public_slug) WHERE public_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_programs_publication
  ON programs (publication_status, display_order);


-- Backfill the explicit states from the legacy pair, once.
UPDATE programs
   SET publication_status = CASE WHEN is_public THEN 'published' ELSE 'draft' END
 WHERE publication_status IS NULL;

UPDATE programs
   SET registration_status = CASE COALESCE(public_status, 'coming_soon')
         WHEN 'open'        THEN 'registration_open'
         WHEN 'full'        THEN 'full'
         WHEN 'closed'      THEN 'registration_closed'
         ELSE 'coming_soon'
       END
 WHERE registration_status IS NULL;

-- Public slugs for existing programs, derived from the operating name. Only
-- fills blanks, and only where the derived slug is still free.
UPDATE programs p
   SET public_slug = candidate.slug
  FROM (
    SELECT id,
           regexp_replace(regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'), '(^-+|-+$)', '', 'g') AS slug
      FROM programs
     WHERE public_slug IS NULL
  ) AS candidate
 WHERE p.id = candidate.id
   AND p.public_slug IS NULL
   AND candidate.slug <> ''
   AND NOT EXISTS (SELECT 1 FROM programs o WHERE o.public_slug = candidate.slug);


-- Keep the legacy pair and the explicit states in step, whichever side a
-- writer touches. Existing admin actions write `is_public`/`public_status`;
-- the Website editor writes the explicit states. Without this, the two views
-- of the same fact drift apart the first time either one is used alone.
CREATE OR REPLACE FUNCTION site_sync_program_status() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.publication_status IS NULL THEN
      NEW.publication_status := CASE WHEN NEW.is_public THEN 'published' ELSE 'draft' END;
    END IF;
    IF NEW.registration_status IS NULL THEN
      NEW.registration_status := CASE COALESCE(NEW.public_status, 'coming_soon')
        WHEN 'open' THEN 'registration_open'
        WHEN 'full' THEN 'full'
        WHEN 'closed' THEN 'registration_closed'
        ELSE 'coming_soon' END;
    END IF;
  ELSIF NEW.publication_status IS DISTINCT FROM OLD.publication_status
     OR NEW.registration_status IS DISTINCT FROM OLD.registration_status THEN
    -- Explicit states were edited: they win.
    NULL;
  ELSIF NEW.is_public IS DISTINCT FROM OLD.is_public
     OR NEW.public_status IS DISTINCT FROM OLD.public_status THEN
    -- A legacy writer moved the old columns: mirror forward and stop.
    NEW.publication_status := CASE WHEN NEW.is_public THEN 'published' ELSE 'draft' END;
    NEW.registration_status := CASE COALESCE(NEW.public_status, 'coming_soon')
      WHEN 'open' THEN 'registration_open'
      WHEN 'full' THEN 'full'
      WHEN 'closed' THEN 'registration_closed'
      ELSE 'coming_soon' END;
    RETURN NEW;
  END IF;

  -- Mirror the explicit states back onto the legacy pair.
  NEW.is_public := (NEW.publication_status = 'published');
  NEW.public_status := CASE NEW.registration_status
    WHEN 'registration_open' THEN 'open'
    WHEN 'interest_list'     THEN 'coming_soon'
    WHEN 'full'              THEN 'full'
    WHEN 'registration_closed' THEN 'closed'
    WHEN 'completed'         THEN 'closed'
    ELSE 'coming_soon' END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_site_sync_program_status ON programs;
CREATE TRIGGER trg_site_sync_program_status
  BEFORE INSERT OR UPDATE ON programs
  FOR EACH ROW EXECUTE FUNCTION site_sync_program_status();


-- ------------------------------------------------------------
-- Row Level Security
--
-- The application connects as the database owner over POSTGRES_URL and is
-- therefore not subject to RLS; authorization for every write lives in
-- lib/cms/admin.ts behind `requireWebsiteEditor()`. These policies govern the
-- other door — Supabase's PostgREST endpoint, reachable with the publishable
-- anon key from any browser.
--
-- Content tables: anon and authenticated may read *published* rows only, and
-- may never write. Draft and archived rows are invisible there, exactly as
-- they are on the public site. Every other table in this migration follows
-- the repo's existing default of "RLS on, no policy" — deny everything.
-- ------------------------------------------------------------

-- Supabase ships the `anon` and `authenticated` roles; a plain local Postgres
-- does not, and the policies below name them explicitly. Creating them when
-- absent keeps one migration file valid on both, and keeps local RLS
-- behaviour identical to production instead of silently untested.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
END $$;

ALTER TABLE site_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_page_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_page_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_faq_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_announcements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'site_pages' AND policyname = 'site_pages_public_read') THEN
    CREATE POLICY site_pages_public_read ON site_pages FOR SELECT
      TO anon, authenticated
      USING (status = 'published' AND published_version_id IS NOT NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'site_page_versions' AND policyname = 'site_page_versions_public_read') THEN
    CREATE POLICY site_page_versions_public_read ON site_page_versions FOR SELECT
      TO anon, authenticated
      USING (
        state = 'published'
        AND EXISTS (
          SELECT 1 FROM site_pages p
           WHERE p.published_version_id = site_page_versions.id AND p.status = 'published'
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'site_page_sections' AND policyname = 'site_page_sections_public_read') THEN
    CREATE POLICY site_page_sections_public_read ON site_page_sections FOR SELECT
      TO anon, authenticated
      USING (
        hidden = false
        AND EXISTS (
          SELECT 1 FROM site_pages p
           WHERE p.published_version_id = site_page_sections.version_id AND p.status = 'published'
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'site_faqs' AND policyname = 'site_faqs_public_read') THEN
    CREATE POLICY site_faqs_public_read ON site_faqs FOR SELECT
      TO anon, authenticated USING (status = 'published');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'site_faq_placements' AND policyname = 'site_faq_placements_public_read') THEN
    CREATE POLICY site_faq_placements_public_read ON site_faq_placements FOR SELECT
      TO anon, authenticated
      USING (EXISTS (SELECT 1 FROM site_faqs f WHERE f.id = site_faq_placements.faq_id AND f.status = 'published'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'site_announcements' AND policyname = 'site_announcements_public_read') THEN
    CREATE POLICY site_announcements_public_read ON site_announcements FOR SELECT
      TO anon, authenticated
      USING (
        status = 'published'
        AND (starts_at IS NULL OR starts_at <= (extract(epoch from now()) * 1000)::bigint)
        AND (ends_at IS NULL OR ends_at >= (extract(epoch from now()) * 1000)::bigint)
      );
  END IF;
END $$;

-- Reading published content through the anon key is intended; writing through
-- it never is. No INSERT/UPDATE/DELETE policy exists above, and the grants are
-- withdrawn as well so a future policy mistake cannot open a write path.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON site_pages FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON site_page_versions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON site_page_sections FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON site_faqs FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON site_faq_placements FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON site_announcements FROM anon, authenticated;
