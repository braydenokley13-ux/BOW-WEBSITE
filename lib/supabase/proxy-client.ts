/* ============================================================
 * Supabase client factory for proxy.ts (Next 16's renamed middleware).
 *
 * Kept dependency-light and separate from lib/supabase/server.ts:
 * proxy.ts runs on every matched request before rendering and must not pull
 * in anything heavier than @supabase/ssr + the request/response cookie jars
 * it is handed. It refreshes the auth token and writes any rotated cookies
 * onto the outgoing response — it does not itself decide access; that stays
 * with the DAL (`requireUser`) in Server Components and Server Actions.
 * ============================================================ */

import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`[bow] Missing ${name}. Set it in the environment (see .env.example).`);
  return value;
}

/**
 * Builds a Supabase client bound to the proxy's request/response cookie
 * jars. Call `supabase.auth.getUser()` on the returned client to trigger a
 * token refresh when needed; any rotated cookies are written onto `response`
 * as a side effect via `setAll`.
 */
export function createProxyClient(request: NextRequest, response: NextResponse) {
  return createServerClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );
}
