/* ============================================================
 * Central route helpers.
 *
 * Route strings for entity detail pages were previously duplicated
 * across app/app/page.tsx (leadership-home bucket hrefs) and
 * app/app/tasks/page.tsx (ENTITY_HREF map). This module is the
 * single source of truth for new/modified code — it does NOT
 * replace the ~90 existing revalidatePath literals scattered across
 * action files (too churny for this wave), but new actions should
 * use `revalidateEntity`.
 * ============================================================ */

import { revalidatePath } from "next/cache";

export type EntityType = "instructor" | "class" | "student" | "organization" | "task" | "program" | "location" | "region" | "inquiry";

/** Detail-page href for a given entity type + id. */
export function entityHref(entityType: string | null | undefined, id: string | null | undefined): string | null {
  if (!entityType || !id) return null;
  switch (entityType) {
    case "instructor":
      return `/app/instructors/${id}`;
    case "class":
      return `/app/classes/${id}`;
    case "student":
      return `/app/students/${id}`;
    case "organization":
      return `/app/partners/${id}`;
    case "task":
      return `/app/tasks`;
    case "program":
      return `/app/programs/${id}`;
    case "location":
      return `/app/locations/${id}`;
    case "region":
      return `/app/regions/${id}`;
    case "inquiry":
      return `/app/inquiries#inquiry-${id}`;
    default:
      return null;
  }
}

/** Session detail href for a class session. */
export function sessionHref(classId: string, sessionId: string): string {
  return `/app/classes/${classId}/sessions/${sessionId}`;
}

/* ---------------- section path constants ---------------- */

export const SECTION_PATHS = {
  home: "/app",
  instructors: "/app/instructors",
  people: "/app/people",
  programs: "/app/programs",
  locations: "/app/locations",
  regions: "/app/regions",
  classes: "/app/classes",
  classProposals: "/app/classes/proposals",
  students: "/app/students",
  partners: "/app/partners",
  tasks: "/app/tasks",
  inquiries: "/app/inquiries",
  teach: "/app/teach",
} as const;

/**
 * Wraps the standard revalidatePath set for a given entity type after
 * a mutation touches it. Always revalidates the entity's own detail
 * page (when it has one) plus its list/section page and the shared
 * Home + Tasks surfaces that read across entities.
 */
export function revalidateEntity(entityType: EntityType, id?: string): void {
  const href = id ? entityHref(entityType, id) : null;
  // Entity hrefs may include an in-page anchor for list-backed records such
  // as inquiries. Cache invalidation targets the route, not the fragment.
  if (href) revalidatePath(href.split("#", 1)[0]);
  switch (entityType) {
    case "instructor":
      revalidatePath(SECTION_PATHS.instructors);
      revalidatePath(SECTION_PATHS.teach);
      break;
    case "class":
      revalidatePath(SECTION_PATHS.classes);
      revalidatePath(SECTION_PATHS.classProposals);
      revalidatePath(SECTION_PATHS.teach);
      break;
    case "student":
      revalidatePath(SECTION_PATHS.students);
      break;
    case "organization":
      revalidatePath(SECTION_PATHS.partners);
      break;
    case "program":
      revalidatePath(SECTION_PATHS.programs);
      revalidatePath(SECTION_PATHS.classes);
      revalidatePath(SECTION_PATHS.locations);
      revalidatePath(SECTION_PATHS.partners);
      break;
    case "location":
      revalidatePath(SECTION_PATHS.locations);
      revalidatePath(SECTION_PATHS.programs);
      break;
    case "region":
      revalidatePath(SECTION_PATHS.regions);
      revalidatePath(SECTION_PATHS.locations);
      break;
    case "task":
      revalidatePath(SECTION_PATHS.tasks);
      break;
    case "inquiry":
      revalidatePath(SECTION_PATHS.inquiries);
      break;
    default:
      break;
  }
  revalidatePath(SECTION_PATHS.home);
  revalidatePath(SECTION_PATHS.tasks);
}
