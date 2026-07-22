/* ============================================================
 * Authenticated application navigation.
 *
 * The catalog describes information architecture, role visibility, and route
 * matching in one browser-safe module. AuthHeader owns only interaction and
 * presentation. A route can match several parent paths, so activeNavId always
 * chooses the most-specific visible leaf and prevents multiple "current"
 * links (for example Home + Programs, or Admin + Inquiries).
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

// Stage 11: student Home points at the new learn platform once the cutover
// flag is on; legacy entries stay reachable under the flag for rollback.
// See lib/learn/cutover.ts. This is a function (not a module-level env
// read) because catalog.ts is imported by client components (AuthHeader);
// the flag must be threaded down as a prop from a server component
// (app/app/layout.tsx -> AppShell -> AuthHeader) rather than read from
// process.env inside client-bundled code, where non-NEXT_PUBLIC_ vars are
// not reliably inlined.
function studentNavFor(cutoverEnabled: boolean): NavLink[] {
  return cutoverEnabled
    ? [link("student-home", "Home", "/dashboard", ["student"], { match: "exact" })]
    : [
        link("student-home", "Home", "/app/student", ["student"], { match: "exact" }),
        link("student-track", "My Track", "/app/student/track", ["student"], {
          aliases: ["/app/student/lesson"],
        }),
      ];
}

export function buildNavCatalog(cutoverEnabled: boolean): NavEntry[] {
  return [
  // Student workspace.
  ...studentNavFor(cutoverEnabled),

  // Instructor workspace. Today and Training are exact so their deeper sibling
  // routes can own the active state.
  link("instructor-today", "Today", "/app/instructor", ["instructor"], { match: "exact" }),
  link("instructor-classes", "My Classes", "/app/teach/classes", ["instructor"], {
    aliases: ["/app/instructor/session"],
  }),
  link("instructor-training", "Training", "/app/teach", ["instructor"], { match: "exact" }),
  link("instructor-proposals", "Proposals", "/app/teach/proposals", ["instructor"]),
  link("instructor-cohorts", "Cohorts", "/app/instructor/cohort", ["instructor"]),
  link("instructor-learn", "Playbook Console", "/app/instructor/learn", ["instructor"]),

  // BOW HQ. Core workflows remain directly visible; related systems are
  // grouped so the header can scale without becoming a wall of links.
  link("staff-home", "Home", "/app", STAFF, { match: "exact" }),
  link("demand-inbox", "Demand", "/app/inquiries", STAFF, { aliases: ["/app/admin/inquiries"] }),
  link("growth", "Growth", "/app/growth", STAFF),
  link("programs", "Programs", "/app/programs", STAFF),
  {
    kind: "group",
    id: "delivery",
    label: "Delivery",
    roles: STAFF,
    items: [
      link("classes", "Classes", "/app/classes", STAFF),
      link("curriculum", "Curriculum", "/app/curriculum", STAFF),
    ],
  },
  {
    kind: "group",
    id: "people",
    label: "People",
    roles: STAFF,
    items: [
      link("hiring", "Hiring", "/app/hiring", STAFF),
      link("instructors", "Instructors", "/app/instructors", STAFF),
      link("students", "Students", "/app/students", STAFF),
      link("training", "Training", "/app/training", STAFF),
    ],
  },
  {
    kind: "group",
    id: "network",
    label: "Network",
    roles: STAFF,
    items: [
      link("partners", "Partners", "/app/partners", STAFF),
      link("regions", "Regions", "/app/regions", STAFF),
      link("locations", "Locations", "/app/locations", STAFF),
    ],
  },
  link("work", "Work", "/app/tasks", STAFF),

  // Platform administration remains available without competing with the
  // canonical BOW HQ workflows. Growth staff never see these links.
  {
    kind: "group",
    id: "platform-admin",
    label: "Admin",
    roles: ["admin"],
    items: [
      link("admin-overview", "Platform Overview", "/app/admin", ["admin"], { match: "exact" }),
      link("admin-learn", "Playbook Studio", "/app/admin/learn", ["admin"]),
      link("admin-invitations", "Invitations", "/app/admin/invitations", ["admin"]),
      link("admin-accounts", "Account Directory", "/app/admin/people", ["admin"]),
      link("admin-cohorts", "LMS Cohorts", "/app/admin/cohorts", ["admin"]),
      link("admin-organizations", "Organization Admin", "/app/admin/organizations", ["admin"]),
    ],
  },
  ];
}

// Default export for callers that don't yet thread the cutover flag —
// reflects the flag's default (ON). Prefer navForRole's cutoverEnabled
// option when a request-scoped value is available.
export const NAV_CATALOG: NavEntry[] = buildNavCatalog(true);

export function navForRole(
  role: Role,
  options: { instructorCanDeliver?: boolean; cutoverEnabled?: boolean } = {},
): NavEntry[] {
  const hiddenInstructorDeliveryIds = options.instructorCanDeliver === false
    ? new Set(["instructor-today", "instructor-classes", "instructor-proposals", "instructor-cohorts"])
    : null;
  return buildNavCatalog(options.cutoverEnabled ?? true)
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
