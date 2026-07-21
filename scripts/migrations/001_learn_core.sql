-- ============================================================
-- 001_learn_core.sql — Playbook Engine: tracks/modules/lessons/versions.
--
-- Conventions (matching the rest of this repo, see lib/db.ts / AGENTS.md):
--   - Primary keys are app-generated `text` ids, not serial/uuid columns.
--   - Timestamps are `bigint` epoch-milliseconds (`Date.now()` in app code),
--     not `timestamptz` — consistent with `notifications.created_at`,
--     `users.last_active_at`, etc.
--   - JSONB documents are read/written through lib/db-sql.ts (native
--     postgres.js), never through lib/db.ts's `toPostgresSql()` shim — see
--     docs/learn/stage0-audit.md §1 for why.
--   - RLS is enabled with NO policies, matching every other table in this
--     database (scripts/migrate-sqlite-to-supabase.ts:162): access is
--     exclusively through the service-role connection string, gated in the
--     application layer by server actions + `requireRole`. This is a
--     repo-wide posture, not new risk introduced here.
-- ============================================================

CREATE TABLE IF NOT EXISTS learn_tracks (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  lifecycle text NOT NULL DEFAULT 'active',
  sort integer NOT NULL DEFAULT 0,
  theme jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS learn_modules (
  id text PRIMARY KEY,
  track_id text NOT NULL REFERENCES learn_tracks(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL,
  description text,
  sort integer NOT NULL DEFAULT 0,
  lifecycle text NOT NULL DEFAULT 'active',
  unlock jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  UNIQUE (track_id, slug)
);

CREATE INDEX IF NOT EXISTS learn_modules_track_id_idx ON learn_modules(track_id);

CREATE TABLE IF NOT EXISTS learn_lessons (
  id text PRIMARY KEY,
  module_id text NOT NULL REFERENCES learn_modules(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL,
  -- lifecycle is deliberately separate from publication state: a lesson can
  -- be "active" with unpublished draft changes, or "archived" while a
  -- published version is still live for existing attempts. UI derives
  -- "Published V3 · unpublished changes" / "Never published" from
  -- (published_version_id, draft_revision), not from `lifecycle`.
  lifecycle text NOT NULL DEFAULT 'active' CHECK (lifecycle IN ('active', 'archived')),
  draft_doc jsonb NOT NULL DEFAULT '{}'::jsonb,
  draft_revision integer NOT NULL DEFAULT 0,
  draft_updated_at bigint,
  draft_updated_by text,
  published_version_id text,
  est_minutes integer,
  sort integer NOT NULL DEFAULT 0,
  is_template boolean NOT NULL DEFAULT false,
  created_at bigint NOT NULL,
  created_by text,
  updated_at bigint NOT NULL,
  UNIQUE (module_id, slug)
);

CREATE INDEX IF NOT EXISTS learn_lessons_module_id_idx ON learn_lessons(module_id);

-- Never SELECT `doc` in list/index queries against learn_lesson_versions —
-- meta columns only (see docs/learn/stage0-audit.md and plan §7).
CREATE TABLE IF NOT EXISTS learn_lesson_versions (
  id text PRIMARY KEY,
  lesson_id text NOT NULL REFERENCES learn_lessons(id) ON DELETE CASCADE,
  version integer NOT NULL,
  doc jsonb NOT NULL,
  doc_hash text NOT NULL,
  published_at bigint NOT NULL,
  published_by text,
  changelog text,
  UNIQUE (lesson_id, version)
);

CREATE INDEX IF NOT EXISTS learn_lesson_versions_lesson_id_idx ON learn_lesson_versions(lesson_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'learn_lessons_published_version_id_fkey'
  ) THEN
    ALTER TABLE learn_lessons
      ADD CONSTRAINT learn_lessons_published_version_id_fkey
      FOREIGN KEY (published_version_id) REFERENCES learn_lesson_versions(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Existing achievement catalog gains a source + declarative rule so a future
-- rule registry (lib/learn/achievements.ts, Stage 9) can add badges without
-- another migration; the hardcoded BADGE_CATALOG (lib/badges.ts) keeps
-- working unchanged with source = 'system'.
ALTER TABLE badges ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'system';
ALTER TABLE badges ADD COLUMN IF NOT EXISTS rule jsonb;

ALTER TABLE learn_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE learn_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE learn_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE learn_lesson_versions ENABLE ROW LEVEL SECURITY;
