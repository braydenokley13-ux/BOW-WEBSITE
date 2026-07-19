import { getDb } from "@/lib/db";
import type { GrowthOption } from "@/lib/growth";

export const GROWTH_SEARCH_KINDS = [
  "person",
  "prospective_contributor",
  "student",
  "referral_student",
  "program",
] as const;

export type GrowthSearchKind = (typeof GROWTH_SEARCH_KINDS)[number];

export function isGrowthSearchKind(value: unknown): value is GrowthSearchKind {
  return typeof value === "string" && GROWTH_SEARCH_KINDS.includes(value as GrowthSearchKind);
}

/**
 * Bounded database search for high-cardinality Growth form identities.
 * Authorization belongs at the server-action boundary; keeping this reader
 * separate makes the exact SQL independently verifiable against an isolated DB.
 */
export async function searchGrowthEntityOptions(kind: GrowthSearchKind, query: string): Promise<GrowthOption[]> {
  const db = getDb();
  const normalizedQuery = query.trim().toLowerCase();
  let rows: Array<Record<string, unknown>>;

  if (kind === "person" || kind === "prospective_contributor") {
    rows = (await db.prepare(
          `SELECT p.id, p.name AS label, p.email AS meta
         FROM people p
        WHERE (? = '' OR instr(lower(p.name), ?) > 0 OR instr(lower(p.email), ?) > 0)
          ${kind === "prospective_contributor" ? "AND NOT EXISTS (SELECT 1 FROM growth_contributors c WHERE c.person_id = p.id)" : ""}
        ORDER BY CASE
          WHEN lower(p.name) = ? OR lower(p.email) = ? THEN 0
          WHEN instr(lower(p.name), ?) = 1 THEN 1
          ELSE 2
        END, p.name, p.id
        LIMIT 20`,
        ).all(
          normalizedQuery,
          normalizedQuery,
          normalizedQuery,
          normalizedQuery,
          normalizedQuery,
          normalizedQuery,
        )) as unknown as Array<Record<string, unknown>>;
  } else if (kind === "student" || kind === "referral_student") {
    rows = (await db.prepare(
          `SELECT s.id, s.name AS label,
              COALESCE(NULLIF(trim(s.email), ''), NULLIF(trim(s.grade), ''), 'Student') AS meta
         FROM students s
        WHERE s.enrollment_status = 'active'
          AND ${kind === "referral_student" ? "s.person_id IS NOT NULL" : "(s.person_id IS NOT NULL OR s.guardian_person_id IS NOT NULL)"}
          AND (? = '' OR instr(lower(s.name), ?) > 0 OR instr(lower(COALESCE(s.email, '')), ?) > 0)
        ORDER BY CASE
          WHEN lower(s.name) = ? OR lower(COALESCE(s.email, '')) = ? THEN 0
          WHEN instr(lower(s.name), ?) = 1 THEN 1
          ELSE 2
        END, s.name, s.id
        LIMIT 20`,
        ).all(
          normalizedQuery,
          normalizedQuery,
          normalizedQuery,
          normalizedQuery,
          normalizedQuery,
          normalizedQuery,
        )) as unknown as Array<Record<string, unknown>>;
  } else {
    rows = (await db.prepare(
          `SELECT p.id, p.name AS label, replace(p.stage, '_', ' ') AS meta
         FROM programs p
        WHERE (? = '' OR instr(lower(p.name), ?) > 0 OR instr(lower(p.id), ?) > 0)
        ORDER BY CASE
          WHEN lower(p.name) = ? OR lower(p.id) = ? THEN 0
          WHEN instr(lower(p.name), ?) = 1 THEN 1
          ELSE 2
        END,
        CASE WHEN p.stage IN ('completed','renewed','closed') THEN 1 ELSE 0 END,
        p.name, p.id
        LIMIT 20`,
        ).all(
          normalizedQuery,
          normalizedQuery,
          normalizedQuery,
          normalizedQuery,
          normalizedQuery,
          normalizedQuery,
        )) as unknown as Array<Record<string, unknown>>;
  }

  return rows.map((row) => ({
    id: String(row.id),
    label: String(row.label),
    meta: row.meta == null ? undefined : String(row.meta),
  }));
}
