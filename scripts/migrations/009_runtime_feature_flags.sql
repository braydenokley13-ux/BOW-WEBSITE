-- Runtime-controlled, auditable release switches. These are deliberately
-- database-backed: changing a Vercel build-time environment value does not
-- guarantee an immediate rollback on an already-running deployment.

CREATE TABLE app_feature_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  updated_by_user_id text REFERENCES users(id),
  updated_at double precision NOT NULL
);

CREATE TABLE app_feature_flag_events (
  id text PRIMARY KEY,
  flag_key text NOT NULL REFERENCES app_feature_flags(key),
  prior_enabled boolean NOT NULL,
  next_enabled boolean NOT NULL,
  reason text NOT NULL,
  actor_user_id text NOT NULL REFERENCES users(id),
  created_at double precision NOT NULL
);
CREATE INDEX idx_app_feature_flag_events_flag
  ON app_feature_flag_events(flag_key, created_at DESC);

INSERT INTO app_feature_flags (key, enabled, updated_at)
VALUES ('learn_cutover', false, floor(extract(epoch from now()) * 1000))
ON CONFLICT (key) DO NOTHING;

ALTER TABLE app_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_feature_flag_events ENABLE ROW LEVEL SECURITY;
