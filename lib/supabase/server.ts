/* ============================================================
 * Supabase server client — reads/writes the auth cookies for the
 * current request via Next's async `cookies()` API.
 *
 * Create a fresh client per request/render; never cache or share one
 * across requests. Server-only.
 * ============================================================ */

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`[bow] Missing ${name}. Set it in the environment (see .env.example).`);
  return value;
}

/**
 * Server-side Supabase client bound to the current request's cookies.
 * Use `supabase.auth.getUser()` to resolve the signed-in user — never rely
 * on `getSession()` alone, since it reads the cookie without revalidating
 * the token against Supabase Auth.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Cookie mutation is unavailable during some Server Component
            // render paths (e.g. static rendering). The proxy (middleware)
            // refreshes the session cookie for those requests instead.
          }
        },
      },
    },
  );
}
