/* ============================================================
 * Shared Supabase Auth provisioning helpers used by the sign-in,
 * self-serve join, and invitation-accept flows.
 *
 * Server-only.
 * ============================================================ */

import "server-only";
import { getDb } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { findSupabaseUserIdByEmail, getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Create (or, if one already exists for this email, link) a confirmed
 * Supabase Auth user and set the given password on it. Used for brand-new
 * accounts (join / accept-invitation) and for lazily migrating a legacy
 * scrypt account the first time it signs in successfully.
 *
 * Returns the Supabase Auth user id, or null if provisioning failed.
 */
export async function ensureSupabaseAuthUser(email: string, password: string): Promise<string | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (!error && data.user) return data.user.id;

  // Most likely cause: a Supabase Auth user already exists for this email
  // (a previous partial migration run, or a concurrent sign-up). Link to it
  // and make sure the password matches what the caller just verified/chose.
  const existingId = await findSupabaseUserIdByEmail(email);
  if (!existingId) return null;
  const { error: updateError } = await admin.auth.admin.updateUserById(existingId, {
    password,
    email_confirm: true,
  });
  if (updateError) return null;
  return existingId;
}

/**
 * Link an app `users` row to a Supabase Auth user id and clear its legacy
 * scrypt hash (once linked, Supabase Auth is the password's source of truth).
 */
export async function linkAppUserToSupabaseAuth(userId: string, authUserId: string): Promise<void> {
  const db = getDb();
  await db
    .prepare("UPDATE users SET auth_user_id = ?, password_hash = NULL WHERE id = ?")
    .run(authUserId, userId);
}

/**
 * Zero-friction migration path: if a Supabase Auth sign-in just failed but
 * the app `users` row still carries a legacy scrypt hash that verifies
 * against the submitted password, provision a Supabase Auth identity with
 * that same password, link it, and drop the legacy hash. Returns true when
 * the caller should retry `signInWithPassword`.
 */
export async function migrateLegacyPasswordOnSignIn(
  user: { id: string; email: string; password_hash: string | null },
  password: string,
): Promise<boolean> {
  if (!user.password_hash || !verifyPassword(password, user.password_hash)) return false;
  const authUserId = await ensureSupabaseAuthUser(user.email, password);
  if (!authUserId) return false;
  await linkAppUserToSupabaseAuth(user.id, authUserId);
  return true;
}

/**
 * Set (or provision) a Supabase Auth user's password by app user id. Used by
 * `resetPassword` and `changePassword`, both of which may run before an
 * account has ever completed the lazy sign-in migration (no `auth_user_id`
 * yet). Returns the Supabase Auth user id the password now lives on, or
 * null if provisioning/updating failed.
 */
export async function setSupabaseAuthPassword(
  authUserId: string | null,
  email: string,
  password: string,
): Promise<string | null> {
  const admin = getSupabaseAdmin();
  if (authUserId) {
    const { error } = await admin.auth.admin.updateUserById(authUserId, { password, email_confirm: true });
    if (!error) return authUserId;
  }
  return ensureSupabaseAuthUser(email, password);
}
