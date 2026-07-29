/* ============================================================
 * 022 — Cross-program transfer linkage.
 *
 * A program transfer is two registrations, not one edited registration: the
 * child leaves one program and joins another, and both facts have to stay
 * true afterwards. 021 left this to `registration_audit_events`, which records
 * that a transfer happened but cannot be joined against cheaply when the
 * family-support record wants to answer "where did this registration go?".
 *
 * Two columns, one on each side of the move, so the link reads in both
 * directions without a scan:
 *
 *   source.transferred_to_registration_id   -> the registration that replaced it
 *   target.transferred_from_registration_id -> the registration it replaced
 *
 * This adds no lifecycle. The source registration is withdrawn by the ordinary
 * release path and its status stays the one canonical statement about it;
 * these columns only say which other registration is the other half of the
 * move, so a withdrawn record can explain itself as "transferred out" rather
 * than looking like an ordinary withdrawal.
 * ============================================================ */

ALTER TABLE program_registrations
  ADD COLUMN IF NOT EXISTS transferred_to_registration_id text;
ALTER TABLE program_registrations
  ADD COLUMN IF NOT EXISTS transferred_from_registration_id text;

-- Partial indexes: the overwhelming majority of registrations are not part of
-- a transfer, so only the linked rows are worth indexing.
CREATE INDEX IF NOT EXISTS program_registrations_transferred_to_idx
  ON program_registrations (transferred_to_registration_id)
  WHERE transferred_to_registration_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS program_registrations_transferred_from_idx
  ON program_registrations (transferred_from_registration_id)
  WHERE transferred_from_registration_id IS NOT NULL;
