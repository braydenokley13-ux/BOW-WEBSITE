import Link from "next/link";
import { Badge, FacetChip } from "@/components/ds";
import { requireStaff } from "@/lib/dal";
import { getPeopleOperationsData, type PersonAttentionView } from "@/lib/people-operations";
import { listPeopleDirectory, type PersonDirectoryRow, type PersonRoleKind } from "@/lib/people-directory";

export const metadata = { title: "People" };

const FACETS: { key: PersonRoleKind | "all"; label: string }[] = [
  { key: "all", label: "Everyone" },
  { key: "student", label: "Students" },
  { key: "parent", label: "Parents" },
  { key: "instructor", label: "Instructors" },
  { key: "contact", label: "Contacts" },
  { key: "applicant", label: "Applicants" },
  { key: "staff", label: "Staff" },
];

const FACET_TONE: Record<PersonRoleKind, "positive" | "warning" | "info" | "neutral"> = {
  student: "positive",
  parent: "info",
  instructor: "info",
  contact: "neutral",
  applicant: "warning",
  staff: "neutral",
};

const STANDING = {
  strong: { label: "Strong", status: "positive" as const },
  on_track: { label: "On track", status: "info" as const },
  needs_attention: { label: "Needs attention", status: "warning" as const },
  at_risk: { label: "At risk", status: "negative" as const },
};

/**
 * People — one directory, search first.
 *
 * There is exactly one identity model underneath: a `people` row. Student,
 * parent, instructor, contact, applicant and staff are facets that accumulate
 * on it, read from the tables that already own each relationship —
 * `students`, `student_guardians`, `instructors`, `organization_people`,
 * `applications`, `role_assignments`. A parent who also runs the athletic
 * department is one human with two chips, not two records, and the facets here
 * filter that single list rather than opening six of them.
 *
 * Search leads because that is how anybody actually finds a person: by typing
 * a name, not by first deciding which kind of person they are.
 *
 * A possible duplicate is shown and never acted on. Merging two children
 * because their names normalize the same is a decision for a person, and the
 * review that makes it lives on Home.
 */
export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string }>;
}) {
  const me = await requireStaff();
  const { type, q } = await searchParams;
  const query = (q ?? "").trim();
  const facet = (FACETS.some((f) => f.key === type) ? type : "all") as PersonRoleKind | "all";

  const [directory, opsData] = await Promise.all([
    listPeopleDirectory({ query }),
    getPeopleOperationsData({ userId: me.id, role: me.role }),
  ]);

  const standingByPerson = new Map(opsData.people.map((person) => [person.personId, person]));

  const counts = Object.fromEntries(
    FACETS.map((f) => [
      f.key,
      f.key === "all" ? directory.length : directory.filter((row) => row.roles.some((role) => role.kind === f.key)).length,
    ]),
  ) as Record<string, number>;

  const visible = directory
    .filter((row) => facet === "all" || row.roles.some((role) => role.kind === facet))
    .map((row) => ({ row, ops: row.personId ? standingByPerson.get(row.personId) : undefined }))
    .sort((a, b) => {
      // Anything that needs a person floats, then alphabetical. Search
      // results keep alphabetical order so a typed name lands where expected.
      const rank = (entry: { row: PersonDirectoryRow; ops?: PersonAttentionView }) =>
        entry.ops && ["at_risk", "needs_attention"].includes(entry.ops.standing)
          ? 0
          : entry.row.attentionReasons.length > 0
            ? 1
            : 2;
      return rank(a) - rank(b) || a.row.name.localeCompare(b.row.name);
    });

  const needingAttention = directory.filter(
    (row) =>
      row.attentionReasons.length > 0
      || (row.personId && ["at_risk", "needs_attention"].includes(standingByPerson.get(row.personId)?.standing ?? "")),
  ).length;

  return (
    <div style={{ maxWidth: 1000 }}>
      <p
        style={{
          margin: 0,
          fontFamily: "var(--font-data)",
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--bow-slate)",
        }}
      >
        People
      </p>
      <h1
        style={{
          margin: "9px 0 0",
          fontFamily: "var(--font-interface)",
          fontWeight: 600,
          fontSize: "clamp(19px, 2.6vw, 24px)",
          lineHeight: 1.3,
          color: "var(--bow-ink)",
        }}
      >
        {directory.length} {directory.length === 1 ? "person" : "people"}
        {needingAttention > 0 ? `, ${needingAttention} needing something` : ""}.
      </h1>

      {/* Search first. Everything below is a way of narrowing it. */}
      <form method="get" action="/app/people" style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
        {facet !== "all" ? <input type="hidden" name="type" value={facet} /> : null}
        <label htmlFor="people-search" className="bow-sr-only">
          Search people by name or email
        </label>
        <input
          id="people-search"
          className="bow-input"
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Search by name or email"
          style={{ flex: "1 1 260px", maxWidth: 420 }}
        />
        <button type="submit" className="bow-button bow-button-secondary bow-button-md">
          Search
        </button>
        {query ? (
          <Link
            href={facet === "all" ? "/app/people" : `/app/people?type=${facet}`}
            className="bow-button bow-button-ghost bow-button-md"
          >
            Clear
          </Link>
        ) : null}
      </form>

      <nav aria-label="People facets" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 16 }}>
        {FACETS.map((f) => (
          <FacetChip
            key={f.key}
            href={buildHref(f.key, query)}
            active={facet === f.key}
            count={counts[f.key] ?? 0}
          >
            {f.label}
          </FacetChip>
        ))}
      </nav>

      <div style={{ marginTop: 20 }}>
        {visible.length === 0 ? (
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--bow-slate)" }}>
            {query
              ? `Nobody matches “${query}”. Try part of a name, or an email address.`
              : "Nobody here yet."}
          </p>
        ) : (
          <div style={{ border: "1px solid var(--border-rule)", borderRadius: "var(--radius-card)", background: "var(--bow-white)" }}>
            {visible.map(({ row, ops }, index) => (
              <PersonRow key={row.personId ?? row.fallbackHref} row={row} ops={ops} first={index === 0} />
            ))}
          </div>
        )}
      </div>

      <p style={{ margin: "18px 0 0", display: "flex", gap: 16, flexWrap: "wrap" }}>
        {[
          { href: "/app/hiring", label: "Hiring pipeline" },
          { href: "/app/training", label: "Training" },
          { href: "/app/instructor-ops", label: "Instructor operations" },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-blue)" }}
          >
            {link.label} →
          </Link>
        ))}
      </p>
    </div>
  );
}

function buildHref(facet: string, query: string): string {
  const params = new URLSearchParams();
  if (facet !== "all") params.set("type", facet);
  if (query) params.set("q", query);
  const suffix = params.toString();
  return suffix ? `/app/people?${suffix}` : "/app/people";
}

function PersonRow({
  row,
  ops,
  first,
}: {
  row: PersonDirectoryRow;
  ops: PersonAttentionView | undefined;
  first: boolean;
}) {
  const href = row.personId ? `/app/people/${row.personId}` : (row.fallbackHref ?? "#");
  const standing = ops ? STANDING[ops.standing] : null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
        padding: "13px 16px",
        borderTop: first ? "none" : "1px solid var(--border-rule)",
        flexWrap: "wrap",
      }}
    >
      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
        <Link href={href} style={{ fontSize: 15, fontWeight: 600, color: "var(--bow-ink)" }}>
          {row.name}
        </Link>
        <span style={{ display: "block", marginTop: 3, fontSize: 13, color: "var(--bow-slate)" }}>
          {row.email ?? "No email on file"}
          {row.unlinked ? " · not linked to a person record yet" : ""}
        </span>
        {row.attentionReasons.length > 0 ? (
          <span style={{ display: "block", marginTop: 5, fontSize: 12.5, lineHeight: 1.5, color: "var(--bow-warning-text)" }}>
            {row.attentionReasons.slice(0, 2).join(" · ")}
          </span>
        ) : null}
      </div>

      <div style={{ flex: "1 1 200px", minWidth: 0, display: "flex", gap: 6, flexWrap: "wrap" }}>
        {row.roles.length === 0 ? (
          <span style={{ fontSize: 12.5, color: "var(--bow-slate)" }}>No role yet</span>
        ) : (
          row.roles.map((role) => (
            <Badge key={`${role.kind}-${role.recordId}`} status={FACET_TONE[role.kind]}>
              {role.label}
              {role.status ? ` · ${role.status}` : ""}
            </Badge>
          ))
        )}
      </div>

      {standing ? (
        <div style={{ flex: "none" }}>
          <Badge status={standing.status}>{standing.label}</Badge>
        </div>
      ) : null}
    </div>
  );
}
