-- ============================================================
-- 007_badge_editor_fields.sql — Stage 9 achievement editor: extra badge
-- fields the admin editor needs that weren't part of the original
-- lib/badges.ts catalog shape (source/rule already added ahead of Stage 9,
-- see 005_seed_badge_catalog.sql's header).
--
-- - locked_hint: teaser copy shown on a locked badge card (BadgeSeed's
--   lockedHint in lib/badges.ts was catalog-only/in-code; custom badges
--   need it stored, since they have no catalog entry).
-- - rarity: optional display-only tag (e.g. 'common' | 'rare' | 'legendary').
-- - active: disable a custom badge without deleting it (deleting would
--   orphan any student_badges rows via the FK's ON DELETE CASCADE, silently
--   erasing history — disabling just stops it being awarded/shown going
--   forward while an already-earned badge stays visible on a student's
--   cabinet).
--
-- ADD COLUMN IF NOT EXISTS: idempotent re-run, safe alongside
-- 005_seed_badge_catalog.sql's INSERTs (system rows just get the defaults).
-- ============================================================

ALTER TABLE badges ADD COLUMN IF NOT EXISTS locked_hint text;
ALTER TABLE badges ADD COLUMN IF NOT EXISTS rarity text;
ALTER TABLE badges ADD COLUMN IF NOT EXISTS active integer NOT NULL DEFAULT 1;
