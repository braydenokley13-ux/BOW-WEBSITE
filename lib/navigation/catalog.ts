/* ============================================================
 * Authenticated application navigation.
 *
 * The catalog describes information architecture, role visibility, and route
 * matching in one browser-safe module. The shell (PortalSidebar/AppShell)
 * owns only interaction and presentation. A route can match several parent
 * paths, so activeNavId always chooses the most-specific visible leaf and
 * prevents multiple "current" links (for example Home + Programs, or Admin +
 * a nested admin page).
 *
 * Stage 1 IA (see docs/redesign/route-disposition.md + ux-baseline.md):
 * Staff:      Home / Growth / Programs / People / Work (+ Admin, admin-only)
 * Instructor: Home (/app/teach) / Classes / Playbook
 * Student:    Home (/dashboard) — cutover is permanent, no branching
 * ============================================================ */

import type { Role } from "@/lib/account";

export type NavMatch = "exact" | "segment";

export interface NavLink {
  kind: "link";
  id: string;
  label: string;
  href: string;
  roles: Role[];
  match?: NavMatch;
  aliases?: string[];
}

export interface NavGroup {
  kind: "group";
  id: string;
  label: string;
  roles: Role[];
  items: NavLink[];
  /** Groups flagged secondary render visually de-emphasized in the shell. */
  secondary?: boolean;
}

export type NavEntry = NavLink | NavGroup;

const STAFF: Role[] = ["admin", "growth"];

const link = (
  id: string,
  label: string,
  href: string,
  roles: Role[],
  options: Pick<NavLink, "match" | "aliases"> = {},
): NavLink => ({ kind: "link", id, label, href, roles, ...options });

export function buildNavCatalog(): NavEntry[] {
  return [
    // Student workspace. Learn cutover is permanent — always /dashboard.
    link("student-home", "Home", "/dashboard", ["student"]),

    // Instructor workspace. /app/instructor stays an alias of Home for
    // active-state purposes only; it becomes a redirect in Stage 2 (page
    // itself is unchanged this stage).
    link("instructor-home", "Home", "/app/teach", ["instructor"], {
      match: "exact",
      aliases: ["/app/instructor", "/app/teach/proposals"],
    }),
    link("instructor-classes", "Classes", "/app/teach/classes", ["instructor"], {
      aliases: ["/app/instructor/session", "/app/instructor/cohort"],
    }),
    link("instructor-playbook", "Playbook", "/app/instructor/learn", ["instructor"]),

    // BOW HQ (staff). Five primary destinations; every currently-routable
    // portal page resolves to exactly one of these via aliases/segment match.
    link("staff-home", "Home", "/app", STAFF, { match: "exact" }),
    link("growth", "Growth", "/app/growth", STAFF, {
      aliases: ["/app/inquiries", "/app/admin/inquiries", "/app/partners"],
    }),
    link("programs", "Programs", "/app/programs", STAFF, {
      aliases: ["/app/classes", "/app/curriculum", "/app/regions", "/app/locations"],
    }),
    link("people", "People", "/app/people", STAFF, {
      aliases: ["/app/instructors", "/app/students", "/app/hiring", "/app/training", "/app/instructor-ops"],
    }),
    link("work", "Work", "/app/tasks", STAFF),

    // The public website. Admin-only: publishing changes what every visitor
    // reads, so it sits with the founder's own controls rather than with the
    // shared staff workflows above.
    link("website", "Website", "/app/website", ["admin"]),

    // Platform administration remains available without competing visually
    // with the canonical BOW HQ workflows. Growth staff never see this group.
    {
      kind: "group",
      id: "platform-admin",
      label: "Admin",
      roles: ["admin"],
      secondary: true,
      items: [
        link("admin-overview", "Platform Overview", "/app/admin", ["admin"], { match: "exact" }),
        link("admin-invitations", "Invitations", "/app/admin/invitations", ["admin"]),
        link("admin-organizations", "Organizations", "/app/admin/organizations", ["admin"]),
        link("admin-accounts", "Account Directory", "/app/admin/people", ["admin"]),
        link("admin-cohorts", "LMS Cohorts", "/app/admin/cohorts", ["admin"]),
        link("admin-learn", "Playbook Studio", "/app/admin/learn", ["admin"]),
      ],
    },
  ];
}

export const NAV_CATALOG: NavEntry[] = buildNavCatalog();

export function navForRole(
  role: Role,
  options: { instructorCanDeliver?: boolean; cutoverEnabled?: boolean } = {},
): NavEntry[] {
  // cutoverEnabled is accepted for backward call-site compatibility but no
  // longer branches navigation — the learn cutover is permanent (Stage 1).
  const hiddenInstructorDeliveryIds = options.instructorCanDeliver === false
    ? new Set(["instructor-classes"])
    : null;
  return buildNavCatalog()
    .filter((entry) => entry.roles.includes(role) && !(entry.kind === "link" && hiddenInstructorDeliveryIds?.has(entry.id)))
    .map((entry) =>
    entry.kind === "group"
      ? { ...entry, items: entry.items.filter((item) => item.roles.includes(role)) }
      : entry,
  );
}

function normalizePath(pathname: string): string {
  if (!pathname) return "/";
  const withoutQuery = pathname.split(/[?#]/, 1)[0] || "/";
  return withoutQuery.length > 1 ? withoutQuery.replace(/\/+$/, "") : withoutQuery;
}

function pathMatches(pathname: string, route: string, match: NavMatch): boolean {
  const current = normalizePath(pathname);
  const target = normalizePath(route);
  return match === "exact" ? current === target : current === target || current.startsWith(`${target}/`);
}

function leaves(entries: NavEntry[]): NavLink[] {
  return entries.flatMap((entry) => (entry.kind === "group" ? entry.items : [entry]));
}

/** Return the one most-specific visible leaf that owns the current route. */
export function activeNavId(pathname: string, entries: NavEntry[]): string | null {
  let winner: { id: string; score: number } | null = null;

  for (const item of leaves(entries)) {
    for (const route of [item.href, ...(item.aliases ?? [])]) {
      const match = item.match ?? "segment";
      if (!pathMatches(pathname, route, match)) continue;
      const score = normalizePath(route).length + (match === "exact" ? 1000 : 0);
      if (!winner || score > winner.score) winner = { id: item.id, score };
    }
  }

  return winner?.id ?? null;
}

export function groupContainsActive(group: NavGroup, activeId: string | null): boolean {
  return Boolean(activeId && group.items.some((item) => item.id === activeId));
}

export function routeIsActive(pathname: string, href: string): boolean {
  return pathMatches(pathname, href, "segment");
}
