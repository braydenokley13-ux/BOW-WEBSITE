-- 027_curriculum_track_links.sql
--
-- Link the staff courses that unambiguously ARE an authored track.
--
-- Migration 026 added curricula.learn_track_id and left it null for everything,
-- which is why the composer shows "No lessons yet" against courses that plainly
-- have lessons. This closes the gap only where the correspondence is a fact
-- rather than a guess.
--
-- The one deterministic pair in the system:
--
--   curricula.public_slug = 'track-<n>'   (scripts/seed-site-content.ts, a fixed slug)
--   learn_tracks.id       = 'track-legacy-<n>'  (scripts/import-legacy-lessons.ts,
--                                                built from the same <n> in lib/lessons.ts)
--
-- Both sides are generated from the same track number by code in this repo, so
-- matching them is not name-matching — it is reading one identifier two ways.
-- Nothing is matched by title, and nothing is guessed: a course whose slug has
-- no corresponding authored track (Track 301 has no legacy lessons) keeps a
-- null link and says so on its record. Everything else is linked by a person,
-- explicitly, from the course record.
--
-- Safe to re-run and safe on a database where the legacy import never ran:
-- it only fills nulls, and only when the track it points at actually exists.

UPDATE curricula c
   SET learn_track_id = t.id,
       updated_at = EXTRACT(EPOCH FROM now()) * 1000
  FROM learn_tracks t
 WHERE c.learn_track_id IS NULL
   AND c.public_slug ~ '^track-[0-9]+$'
   AND t.id = 'track-legacy-' || substring(c.public_slug from 7);
