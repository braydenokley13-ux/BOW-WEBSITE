/* ============================================================
 * Throwaway Supabase client for password verification only.
 *
 * Used where a caller must check a password against Supabase Auth without
 * touching the request's real session cookies (e.g. re-authenticating the
 * current user before a change-password flow). Never persists a session and
 * is never cookie-bound. Server-only.
 * ============================================================ */

import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`[bow] Missing ${name}. Set it in the environment (see .env.example).`);
  return value;
}

/** Returns true iff `email`/`password` are valid Supabase Auth credentials. */
export async function verifySupabasePassword(email: string, password: string): Promise<boolean> {
  const client = createSupabaseClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { error } = await client.auth.signInWithPassword({ email, password });
  return !error;
}
