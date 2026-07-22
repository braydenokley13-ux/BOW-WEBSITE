-- Phase 1 of the Supabase Auth migration: link app `users` rows to Supabase
-- Auth identities. Nullable and additive only — the legacy password_hash and
-- sessions table stay in place until a later phase cuts over sign-in.

ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_user_id uuid;

-- Postgres does not support "ADD CONSTRAINT IF NOT EXISTS", so guard the
-- unique constraint (and its backing index, which also serves lookups by
-- auth_user_id — getSessionUser's primary resolution path) explicitly.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_auth_user_id_key'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_auth_user_id_key UNIQUE (auth_user_id);
  END IF;
END $$;
