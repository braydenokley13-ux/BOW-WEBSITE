import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-cookie";

/**
 * Optimistic auth boundary (Next 16 renamed `middleware` -> `proxy`).
 *
 * This only checks for the *presence* of the session cookie — fast,
 * no database access. The real, authoritative check happens in the
 * app layout and in every server action via the DAL (`requireUser`).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);

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
  if (guarded || passwordChange) {
    if (!hasSession) {
      const url = new URL("/sign-in", request.url);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
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
