import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createProxyClient } from "@/lib/supabase/proxy-client";

/**
 * Optimistic auth boundary (Next 16 renamed `middleware` -> `proxy`).
 *
 * Refreshes the Supabase Auth token (writing any rotated cookies onto the
 * response) and checks only for the *presence* of a Supabase user — fast,
 * no application-database access. The real, authoritative check (active
 * user, active organization) happens in the app layout and in every server
 * action via the DAL (`requireUser`).
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Guard the authenticated app and the self-paced student/instructor surfaces.
  // Public credential slugs remain unguarded, but the data layer only resolves
  // an active, guardian-approved, revocable consent record. The private exact
  // /profile route still requires a session.
  const guarded =
    pathname === "/app" ||
    pathname.startsWith("/app/") ||
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/instructor" ||
    pathname.startsWith("/instructor/") ||
    pathname === "/profile" ||
    pathname === "/leaderboard" ||
    pathname === "/simulation-room" ||
    pathname.startsWith("/simulation-room/") ||
    pathname === "/front-office" ||
    pathname.startsWith("/front-office/") ||
    pathname === "/onboarding" ||
    pathname.startsWith("/onboarding/") ||
    pathname === "/discussion" ||
    pathname.startsWith("/discussion/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/analytics/admin" ||
    pathname.startsWith("/analytics/admin/");
  const passwordChange = pathname === "/change-password";

  let response = NextResponse.next();
  if (!guarded && !passwordChange) return response;

  // A fresh response object must receive any cookies the refresh writes, so
  // build the Supabase client against it before the redirect branch below.
  response = NextResponse.next({ request });
  const supabase = createProxyClient(request, response);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/app/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/instructor",
    "/instructor/:path*",
    "/profile",
    "/leaderboard",
    "/simulation-room",
    "/simulation-room/:path*",
    "/front-office",
    "/front-office/:path*",
    "/onboarding",
    "/onboarding/:path*",
    "/discussion",
    "/discussion/:path*",
    "/admin",
    "/admin/:path*",
    "/analytics/admin",
    "/analytics/admin/:path*",
    "/change-password",
    "/sign-in",
  ],
};
