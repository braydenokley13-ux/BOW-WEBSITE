-- ============================================================
-- 005_seed_badge_catalog.sql — seed the hardcoded BADGE_CATALOG
-- (lib/badges.ts) into the `badges` table.
--
-- Bug found in Stage 4's real-DB proof gate: lib/badges.ts's own
-- getAllBadges() has a fallback ("if rows.length === 0, return
-- BADGE_CATALOG") that masked this in the student-facing badge cabinet, but
-- app/actions/learn-author.ts's listBadges() (Playbook Studio's Scoring tab
-- badge picker, added Stage 3) does a plain `SELECT id, name FROM badges`
-- with no such fallback — so on any environment where this table was never
-- manually seeded (a fresh Supabase project, or this local dev DB), the
-- badge picker is permanently empty and an author can never attach a badge
-- to a lesson, with no error to say why. The catalog is reference data, not
-- lesson-specific, so it belongs in a migration, not a one-off script.
--
-- ON CONFLICT DO NOTHING: idempotent re-run; never overwrites an admin's
-- customization of an existing catalog row (name/description/icon/xp).
-- ============================================================

INSERT INTO badges (id, name, description, icon, category, threshold, xp_reward, ordinal, source)
VALUES
  ('first_flame', 'First Flame', 'Started a streak — answered the Daily Question one day.', '🔥', 'streak', 1, 5, 0, 'system'),
  ('week_warrior', 'Week Warrior', 'Kept a 7-day streak alive.', '⚡', 'streak', 7, 25, 1, 'system'),
  ('monthly_grind', 'Monthly Grind', 'Reached a 30-day streak.', '💎', 'streak', 30, 100, 2, 'system'),
  ('century_club', 'Century Club', 'Reached a 100-day streak.', '🏆', 'streak', 100, 500, 3, 'system'),
  ('sharp_eye', 'Sharp Eye', 'Answered 5 questions correctly.', '🎯', 'accuracy', 5, 15, 4, 'system'),
  ('front_office_ready', 'Front Office Ready', 'Answered 25 questions correctly.', '📋', 'accuracy', 25, 50, 5, 'system'),
  ('gm_material', 'GM Material', 'Answered 75 questions correctly.', '🧠', 'accuracy', 75, 150, 6, 'system'),
  ('pro_debut', 'Pro Debut', 'Got your first Pro-level question correct.', '📈', 'difficulty', 2, 20, 7, 'system'),
  ('executive_suite', 'Executive Suite', 'Got your first Executive-level question correct.', '👔', 'difficulty', 3, 50, 8, 'system'),
  ('daily_habit', 'Daily Habit', 'Answered 10 questions total.', '📅', 'volume', 10, 20, 9, 'system'),
  ('dedicated', 'Dedicated', 'Answered 50 questions total.', '🌟', 'volume', 50, 75, 10, 'system'),
  ('pioneer', 'BOW Pioneer', 'Joined BOW before the platform launched.', '🚀', 'special', 0, 30, 11, 'system')
ON CONFLICT (id) DO NOTHING;
