/* ============================================================
 * Declarative nav catalog — the single source of truth AuthHeader
 * renders from. Each item lists the roles that see it; order in this
 * array is the render order.
 *
 * Existing student/instructor/admin entries are copied byte-identical
 * from the old per-role NAV_BY_ROLE map in AuthHeader.tsx, so those
 * roles see exactly what they saw before. The BOW HQ entries (Home,
 * Instructors, Training, Classes, Students, Partners, Tasks,
 * Curriculum) are new, shared by admin + growth.
 * ============================================================ */

import type { Role } from "@/lib/account";

export interface NavItem {
  label: string;
  href: string;
  roles: Role[];
}

export const NAV_CATALOG: NavItem[] = [
  // ---- student (unchanged) ----
  { label: "Home", href: "/app/student", roles: ["student"] },
  { label: "My Track", href: "/app/student/track", roles: ["student"] },
  { label: "Account", href: "/app/settings", roles: ["student"] },

  // ---- instructor (unchanged, plus BOW HQ self-service) ----
  { label: "Today", href: "/app/instructor", roles: ["instructor"] },
  { label: "Cohorts", href: "/app/instructor/cohort", roles: ["instructor"] },
  { label: "My Onboarding/Training", href: "/app/teach", roles: ["instructor"] },
  { label: "Account", href: "/app/settings", roles: ["instructor"] },

  // ---- admin (unchanged) ----
  { label: "Overview", href: "/app/admin", roles: ["admin"] },
  { label: "Inquiries", href: "/app/admin/inquiries", roles: ["admin"] },
  { label: "Organizations", href: "/app/admin/organizations", roles: ["admin"] },
  { label: "Cohorts", href: "/app/admin/cohorts", roles: ["admin"] },
  { label: "People", href: "/app/admin/people", roles: ["admin"] },
  { label: "Invitations", href: "/app/admin/invitations", roles: ["admin"] },

  // ---- BOW HQ (new, admin + growth) ----
  { label: "Home", href: "/app", roles: ["admin", "growth"] },
  { label: "Instructors", href: "/app/instructors", roles: ["admin", "growth"] },
  { label: "Training", href: "/app/training", roles: ["admin", "growth"] },
  { label: "Classes", href: "/app/classes", roles: ["admin", "growth"] },
  { label: "Students", href: "/app/students", roles: ["admin", "growth"] },
  { label: "Partners", href: "/app/partners", roles: ["admin", "growth"] },
  { label: "Tasks", href: "/app/tasks", roles: ["admin", "growth"] },
  { label: "Curriculum", href: "/app/curriculum", roles: ["admin", "growth"] },
];

/** Nav items visible to a given role, in catalog order. */
export function navForRole(role: Role): NavItem[] {
  return NAV_CATALOG.filter((item) => item.roles.includes(role));
}
