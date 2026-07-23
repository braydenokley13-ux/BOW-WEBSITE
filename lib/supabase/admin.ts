/* ============================================================
 * Supabase service-role (admin) client.
 *
 * Bypasses Row Level Security — never import this into client
 * components, never use it to resolve the current user's identity, and
 * never persist a session with it. Server-only, privileged.
 * ============================================================ */

import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`[bow] Missing ${name}. Set it in the environment (see .env.example).`);
  return value;
}

const globalForSupabase = globalThis as unknown as {
  __bowSupabaseAdmin?: ReturnType<typeof createSupabaseClient>;
};

/** Privileged client for admin-only auth operations (invite provisioning, user deletion, etc). */
export function getSupabaseAdmin() {
  if (!globalForSupabase.__bowSupabaseAdmin) {
    globalForSupabase.__bowSupabaseAdmin = createSupabaseClient(
      requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }
  return globalForSupabase.__bowSupabaseAdmin;
}

/**
 * Look up a Supabase Auth user's id by email via GoTrue's admin REST API
 * directly. The `supabase-js` admin client does not expose an email filter
 * on `listUsers()`, but the underlying GoTrue endpoint accepts one — this is
 * only needed for the rare "already registered in Supabase but not yet
 * linked" edge case (e.g. a concurrent migration, or a user created by a
 * previous partial run of the migration script). Best-effort: returns null
 * on any failure instead of throwing, callers fall back to other handling.
 */
export async function findSupabaseUserIdByEmail(email: string): Promise<string | null> {
  try {
    const url = new URL("/auth/v1/admin/users", requiredEnv("NEXT_PUBLIC_SUPABASE_URL"));
    url.searchParams.set("email", email);
    const response = await fetch(url, {
      headers: {
        apikey: requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
        Authorization: `Bearer ${requiredEnv("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { users?: { id: string; email?: string }[] };
    const match = body.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    return match?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Best-effort global sign-out for a Supabase Auth user by id (revokes their
 * refresh tokens so other devices/sessions are signed out). The `supabase-js`
 * admin client only exposes `signOut(jwt, scope)`, which needs a live access
 * token rather than a user id, so this calls GoTrue's id-scoped admin logout
 * endpoint directly. Never throws — callers use this after a credential
 * change has already been committed and must not turn cleanup failures into
 * a user-facing error.
 */
export async function revokeAllSupabaseSessions(authUserId: string): Promise<void> {
  try {
    const url = new URL(
      `/auth/v1/admin/users/${encodeURIComponent(authUserId)}/logout`,
      requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    );
    url.searchParams.set("scope", "global");
    await fetch(url, {
      method: "POST",
      headers: {
        apikey: requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
        Authorization: `Bearer ${requiredEnv("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      cache: "no-store",
    });
  } catch {
    // Best-effort. The credential change itself is already committed.
  }
}
