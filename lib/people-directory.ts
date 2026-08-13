/**
 * Read-only assembly layer for the unified People hub (Stage 3).
 *
 * Pure presentation/read assembly over the existing `people` spine plus its
 * role tables (`instructors`, `students`, `applications`, `role_assignments`).
 * No business logic and no writes live here — mutations continue to flow
 * through lib/hiring.ts, lib/people-operations.ts, lib/people-work.ts, etc.
 * This module exists only to let one index page and one search box answer
 * "who is this human and what roles do they hold" without the caller having
 * to know which table a person lives in.
 */
import { getDb } from "@/lib/db";

/**
 * The hats one human can wear.
 *
 * These are facets, not types: they accumulate on a single `people` row and
 * filter one directory. A parent who also runs the athletic department is one
 * Person with two facets, never two records — which is the whole reason this
 * module reads across the role tables instead of letting each own an index.
 */
export type PersonRoleKind = "instructor" | "student" | "parent" | "contact" | "applicant" | "staff";

export interface PersonRoleBadge {
  kind: PersonRoleKind;
  label: string;
  status: string;
  /** Underlying role-table id (instructors.id / students.id / applications.id / role_assignments.id). */
  recordId: string;
}

export interface PersonDirectoryRow {
  personId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  identityStatus: string | null;
  roles: PersonRoleBadge[];
  attentionReasons: string[];
  /** True when this row is a fallback (e.g. a student with no linked person_id yet). */
  unlinked?: boolean;
  /** Fallback href for unlinked rows that have no canonical person record to open. */
  fallbackHref?: string;
}

function label(value: string | null | undefined): string {
  if (!value) return "—";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface PeopleDirectoryFilter {
  type?: "all" | PersonRoleKind;
  query?: string;
}

/**
 * One row per human across every role table, assembled via LEFT JOINs off
 * the canonical `people` spine. Read-only; no pagination cursor yet (dataset
 * is small enough for LIMIT-based bounding — raise if the org outgrows it).
 */
export async function listPeopleDirectory(filter: PeopleDirectoryFilter = {}): Promise<PersonDirectoryRow[]> {
  const db = getDb();
  const q = (filter.query ?? "").trim().toLowerCase();

  const peopleRows = (await db.prepare(
    `SELECT p.id, p.name, p.email, p.phone, p.identity_status,
            i.id AS instructor_id, i.stage AS instructor_stage,
            s.id AS student_id, s.enrollment_status AS student_enrollment_status, s.form_status AS student_form_status,
            a.id AS application_id, a.lifecycle_status AS application_status,
            ra.id AS role_assignment_id, ra.status AS role_assignment_status, r.title AS role_title,
            g.id AS guardian_link_id, g.children AS guardian_children,
            op.id AS contact_link_id, op.org_name AS contact_org_name,
            s.duplicate_review_status AS student_duplicate_status
       FROM people p
       LEFT JOIN instructors i ON i.person_id = p.id
       LEFT JOIN students s ON s.person_id = p.id
       LEFT JOIN LATERAL (
         SELECT candidate.* FROM applications candidate
          WHERE candidate.person_id = p.id
          ORDER BY candidate.created_at DESC LIMIT 1
       ) a ON true
       LEFT JOIN LATERAL (
         SELECT candidate.* FROM role_assignments candidate
          WHERE candidate.person_id = p.id AND candidate.status IN ('activating','active','paused')
          ORDER BY candidate.is_primary DESC, candidate.created_at DESC LIMIT 1
       ) ra ON true
       LEFT JOIN org_roles r ON r.id = ra.role_id
       -- Parent: student_guardians is the canonical guardian relationship.
       LEFT JOIN LATERAL (
         SELECT min(sg.id) AS id, count(*) AS children
           FROM student_guardians sg
          WHERE sg.person_id = p.id AND sg.status = 'active'
       ) g ON g.id IS NOT NULL
       -- Contact: organization_people is the canonical partner relationship.
       LEFT JOIN LATERAL (
         SELECT min(op2.id) AS id, min(o.name) AS org_name
           FROM organization_people op2
           JOIN organizations o ON o.id = op2.organization_id
          WHERE op2.person_id = p.id AND op2.active = 1
       ) op ON op.id IS NOT NULL
      WHERE p.identity_status <> 'removed'
        AND (? = '' OR lower(p.name) LIKE '%' || ? || '%' OR lower(coalesce(p.email,'')) LIKE '%' || ? || '%')
      ORDER BY p.name`,
  ).all(q, q, q)) as Array<Record<string, unknown>>;

  const rows: PersonDirectoryRow[] = peopleRows.map((row) => {
    const roles: PersonRoleBadge[] = [];
    const attentionReasons: string[] = [];

    if (row.instructor_id) {
      roles.push({ kind: "instructor", label: "Instructor", status: label(String(row.instructor_stage)), recordId: String(row.instructor_id) });
      if (["applied", "reviewing", "interview_scheduled", "interviewed", "founder_review"].includes(String(row.instructor_stage))) {
        attentionReasons.push(`Instructor pipeline: ${label(String(row.instructor_stage))}`);
      }
    }
    if (row.student_id) {
      roles.push({ kind: "student", label: "Student", status: label(String(row.student_enrollment_status)), recordId: String(row.student_id) });
      if (row.student_form_status && row.student_form_status !== "complete") {
        attentionReasons.push(`Student forms: ${label(String(row.student_form_status))}`);
      }
    }
    if (row.application_id) {
      roles.push({ kind: "applicant", label: "Applicant", status: label(String(row.application_status)), recordId: String(row.application_id) });
      if (!["accepted", "rejected", "withdrawn"].includes(String(row.application_status))) {
        attentionReasons.push(`Application: ${label(String(row.application_status))}`);
      }
    }
    if (row.guardian_link_id) {
      const children = Number(row.guardian_children ?? 0);
      roles.push({
        kind: "parent",
        label: "Parent",
        status: children === 1 ? "1 child" : `${children} children`,
        recordId: String(row.guardian_link_id),
      });
    }
    if (row.contact_link_id) {
      roles.push({
        kind: "contact",
        label: "Contact",
        status: String(row.contact_org_name ?? "Partner"),
        recordId: String(row.contact_link_id),
      });
    }
    if (row.role_assignment_id) {
      roles.push({ kind: "staff", label: String(row.role_title ?? "Staff role"), status: label(String(row.role_assignment_status)), recordId: String(row.role_assignment_id) });
      if (row.role_assignment_status === "activating") attentionReasons.push("Role activation pending");
    }
    // A possible duplicate is surfaced, never resolved. Merging two children
    // because their names normalize the same is a decision for a person.
    if (row.student_duplicate_status === "open") {
      attentionReasons.push("Possible duplicate — needs review, never merged automatically");
    }

    return {
      personId: String(row.id),
      name: String(row.name ?? "—"),
      email: row.email ? String(row.email) : null,
      phone: row.phone ? String(row.phone) : null,
      identityStatus: row.identity_status ? String(row.identity_status) : null,
      roles,
      attentionReasons,
    };
  });

  // Students without a linked person_id are a known data gap (nullable FK,
  // not always populated) — surface them so nothing silently disappears
  // from the hub, but mark them unlinked and route to the legacy detail page
  // instead of a person record that doesn't exist for them yet.
  const unlinkedStudents = (await db.prepare(
    `SELECT id, name, enrollment_status, form_status, duplicate_review_status FROM students
      WHERE person_id IS NULL
        AND (? = '' OR lower(name) LIKE '%' || ? || '%')
      ORDER BY name`,
  ).all(q, q)) as Array<{
    id: string;
    name: string;
    enrollment_status: string;
    form_status: string;
    duplicate_review_status: string | null;
  }>;

  for (const s of unlinkedStudents) {
    const attentionReasons: string[] = [];
    if (s.form_status !== "complete") attentionReasons.push(`Student forms: ${label(s.form_status)}`);
    if (s.duplicate_review_status === "open") {
      attentionReasons.push("Possible duplicate — needs review, never merged automatically");
    }
    rows.push({
      personId: null,
      name: s.name,
      email: null,
      phone: null,
      identityStatus: null,
      roles: [{ kind: "student", label: "Student", status: label(s.enrollment_status), recordId: s.id }],
      attentionReasons,
      unlinked: true,
      fallbackHref: `/app/students/${s.id}`,
    });
  }

  rows.sort((a, b) => a.name.localeCompare(b.name));

  if (filter.type && filter.type !== "all") {
    return rows.filter((row) => row.roles.some((role) => role.kind === filter.type));
  }
  return rows;
}

/**
 * Every hat one human wears, resolved from the table that owns each.
 *
 * The Parent and Contact facets are relationships rather than role records, so
 * they come back as lists: a guardian has children, a contact has partners.
 * They are read here so the person record and the directory can never disagree
 * about who somebody is.
 */
export async function resolvePersonRoleIds(personId: string): Promise<{
  instructorId: string | null;
  studentId: string | null;
  applicationId: string | null;
  guardianOf: { studentId: string; name: string }[];
  contactFor: { organizationId: string; name: string }[];
}> {
  const db = getDb();
  const [instructor, student, application, guardianOf, contactFor] = await Promise.all([
    db.prepare("SELECT id FROM instructors WHERE person_id = ? LIMIT 1").get(personId) as Promise<{ id: string } | undefined>,
    db.prepare("SELECT id FROM students WHERE person_id = ? LIMIT 1").get(personId) as Promise<{ id: string } | undefined>,
    db.prepare("SELECT id FROM applications WHERE person_id = ? ORDER BY created_at DESC LIMIT 1").get(personId) as Promise<{ id: string } | undefined>,
    db
      .prepare(
        `SELECT sg.student_id, s.name
           FROM student_guardians sg
           JOIN students s ON s.id = sg.student_id
          WHERE sg.person_id = ? AND sg.status = 'active'
          ORDER BY s.name`,
      )
      .all(personId) as Promise<{ student_id: string; name: string }[]>,
    db
      .prepare(
        `SELECT op.organization_id, o.name
           FROM organization_people op
           JOIN organizations o ON o.id = op.organization_id
          WHERE op.person_id = ? AND op.active = 1
          ORDER BY o.name`,
      )
      .all(personId) as Promise<{ organization_id: string; name: string }[]>,
  ]);
  return {
    instructorId: instructor?.id ?? null,
    studentId: student?.id ?? null,
    applicationId: application?.id ?? null,
    guardianOf: guardianOf.map((row) => ({ studentId: row.student_id, name: row.name })),
    contactFor: contactFor.map((row) => ({ organizationId: row.organization_id, name: row.name })),
  };
}

/** instructors.id -> people.id, for the instructors/[id] redirect. */
export async function resolveInstructorPersonId(instructorId: string): Promise<string | null> {
  const db = getDb();
  const row = (await db.prepare("SELECT person_id FROM instructors WHERE id = ?").get(instructorId)) as { person_id: string | null } | undefined;
  return row?.person_id ?? null;
}

/** students.id -> people.id, for the students/[id] redirect. */
export async function resolveStudentPersonId(studentId: string): Promise<string | null> {
  const db = getDb();
  const row = (await db.prepare("SELECT person_id FROM students WHERE id = ?").get(studentId)) as { person_id: string | null } | undefined;
  return row?.person_id ?? null;
}

export interface PersonSearchResult {
  personId: string;
  name: string;
  email: string | null;
  roles: PersonRoleBadge[];
}

/** Bounded typeahead search for the portal top bar. Staff-only at the call site. */
export async function searchPeopleDirectory(query: string, limit = 8): Promise<PersonSearchResult[]> {
  const db = getDb();
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  const rows = (await db.prepare(
    `SELECT p.id, p.name, p.email,
            i.id AS instructor_id, i.stage AS instructor_stage,
            s.id AS student_id, s.enrollment_status AS student_enrollment_status,
            a.id AS application_id, a.lifecycle_status AS application_status,
            ra.id AS role_assignment_id, r.title AS role_title
       FROM people p
       LEFT JOIN instructors i ON i.person_id = p.id
       LEFT JOIN students s ON s.person_id = p.id
       LEFT JOIN LATERAL (
         SELECT candidate.* FROM applications candidate WHERE candidate.person_id = p.id
          ORDER BY candidate.created_at DESC LIMIT 1
       ) a ON true
       LEFT JOIN LATERAL (
         SELECT candidate.* FROM role_assignments candidate
          WHERE candidate.person_id = p.id AND candidate.status IN ('activating','active','paused')
          ORDER BY candidate.is_primary DESC, candidate.created_at DESC LIMIT 1
       ) ra ON true
       LEFT JOIN org_roles r ON r.id = ra.role_id
      WHERE p.identity_status <> 'removed'
        AND (lower(p.name) LIKE '%' || ? || '%' OR lower(coalesce(p.email,'')) LIKE '%' || ? || '%')
      ORDER BY CASE WHEN lower(p.name) = ? THEN 0 WHEN lower(p.name) LIKE ? || '%' THEN 1 ELSE 2 END, p.name
      LIMIT ?`,
  ).all(normalized, normalized, normalized, normalized, limit)) as Array<Record<string, unknown>>;

  return rows.map((row) => {
    const roles: PersonRoleBadge[] = [];
    if (row.instructor_id) roles.push({ kind: "instructor", label: "Instructor", status: label(String(row.instructor_stage)), recordId: String(row.instructor_id) });
    if (row.student_id) roles.push({ kind: "student", label: "Student", status: label(String(row.student_enrollment_status)), recordId: String(row.student_id) });
    if (row.application_id) roles.push({ kind: "applicant", label: "Applicant", status: label(String(row.application_status)), recordId: String(row.application_id) });
    if (row.role_assignment_id) roles.push({ kind: "staff", label: String(row.role_title ?? "Staff role"), status: "", recordId: String(row.role_assignment_id) });
    return { personId: String(row.id), name: String(row.name ?? "—"), email: row.email ? String(row.email) : null, roles };
  });
}
