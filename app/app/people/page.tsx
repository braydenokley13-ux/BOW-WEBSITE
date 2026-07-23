import Link from "next/link";
import { Badge, PageHeader, PageSection } from "@/components/ds";
import { requireStaff } from "@/lib/dal";
import { getPeopleOperationsData, type PersonAttentionView } from "@/lib/people-operations";
import { listPeopleDirectory, type PersonDirectoryRow } from "@/lib/people-directory";

const ROLE_BADGE_TONE: Record<string, "positive" | "warning" | "negative" | "info" | "neutral" | "locked"> = {
  instructor: "info",
  student: "positive",
  applicant: "warning",
  staff: "neutral",
};

const FACETS = [
  { key: "attention", label: "Needs attention" },
  { key: "all", label: "All" },
  { key: "instructor", label: "Instructors" },
  { key: "student", label: "Students" },
  { key: "applicant", label: "Applicants" },
  { key: "staff", label: "Staff" },
] as const;

const STANDING_BADGE = {
  strong: { label: "Strong", status: "positive" as const },
  on_track: { label: "On track", status: "info" as const },
  needs_attention: { label: "Needs attention", status: "warning" as const },
  at_risk: { label: "At risk", status: "negative" as const },
};

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const me = await requireStaff();
  const { type } = await searchParams;
  const facet = (type ?? "attention") as (typeof FACETS)[number]["key"];

  const [directory, opsData] = await Promise.all([
    listPeopleDirectory(facet === "attention" || facet === "all" ? {} : { type: facet }),
    getPeopleOperationsData({ userId: me.id, role: me.role }),
  ]);

  const standingByPerson = new Map(opsData.people.map((p) => [p.personId, p]));

  const rows = directory.map((row) => ({
    row,
    ops: row.personId ? standingByPerson.get(row.personId) : undefined,
  }));

  let visible = rows;
  if (facet === "attention") {
    visible = rows.filter(({ row, ops }) => row.attentionReasons.length > 0 || (ops && ["at_risk", "needs_attention"].includes(ops.standing)));
  }

  const standingRank = { at_risk: 0, needs_attention: 1, on_track: 2, strong: 3 };
  visible = [...visible].sort((a, b) => {
    const aRank = a.ops ? standingRank[a.ops.standing] : a.row.attentionReasons.length > 0 ? 1 : 2;
    const bRank = b.ops ? standingRank[b.ops.standing] : b.row.attentionReasons.length > 0 ? 1 : 2;
    return aRank - bRank || a.row.name.localeCompare(b.row.name);
  });

  const totalCount = directory.length;
  const attentionCount = rows.filter(({ row, ops }) => row.attentionReasons.length > 0 || (ops && ["at_risk", "needs_attention"].includes(ops.standing))).length;

  return (
    <main className="ops-page">
      <PageHeader
        eyebrow="BOW OS · People"
        title="People"
        context="Every human at BOW — instructor, student, applicant, or staff role-holder — in one place. Find anyone without knowing which record they live in."
        action={
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <Link href="/app/hiring" className="ops-inline-link">Hiring pipeline →</Link>
            <Link href="/app/training" className="ops-inline-link">Training →</Link>
          </div>
        }
        meta={[
          { label: "In view", value: totalCount },
          { label: "Needs attention", value: attentionCount },
        ]}
      />

      <nav aria-label="People facets" style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "4px 0 4px" }}>
        {FACETS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "attention" ? "/app/people" : `/app/people?type=${f.key}`}
            className="ops-chip"
            data-tone={facet === f.key ? "positive" : undefined}
            aria-current={facet === f.key ? "page" : undefined}
            style={{ textDecoration: "none" }}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      <PageSection noRule>
        {visible.length === 0 ? (
          <div className="ops-empty">
            <h2 className="ops-empty__title">{facet === "attention" ? "Nothing needs attention right now." : "No people match this view."}</h2>
            <p className="ops-empty__body">
              {facet === "attention" ? "Everyone in scope has current Work, weekly commitments, and role status on track." : "Try a different facet above."}
            </p>
          </div>
        ) : (
          <div className="ops-panel" style={{ padding: 0, overflow: "hidden" }}>
            {visible.map(({ row, ops }, index) => (
              <PersonRow key={row.personId ?? row.fallbackHref} row={row} ops={ops} isLast={index === visible.length - 1} />
            ))}
          </div>
        )}
      </PageSection>
    </main>
  );
}

function PersonRow({
  row,
  ops,
  isLast,
}: {
  row: PersonDirectoryRow;
  ops: PersonAttentionView | undefined;
  isLast: boolean;
}) {
  const href = row.personId ? `/app/people/${row.personId}` : row.fallbackHref ?? "#";
  const standing = ops ? STANDING_BADGE[ops.standing] : null;

  return (
    <article
      style={{
        padding: "16px clamp(14px,3vw,22px)",
        borderBottom: isLast ? 0 : "1px solid var(--border-rule)",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 16,
        alignItems: "start",
      }}
    >
      <div>
        <h3 style={{ margin: "0 0 3px", fontFamily: "var(--font-interface)", fontSize: 16 }}>
          <Link href={href} style={{ color: "inherit", textDecoration: "none" }}>{row.name}</Link>
        </h3>
        <span className="ops-field__help">{row.email ?? "No email on file"}{row.unlinked ? " · not yet linked to a person record" : ""}</span>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {row.roles.map((role) => (
          <span className="ops-chip" data-tone={ROLE_BADGE_TONE[role.kind]} key={`${role.kind}-${role.recordId}`}>
            {role.label} · {role.status}
          </span>
        ))}
        {row.roles.length === 0 && <span className="ops-field__help">No active role</span>}
      </div>

      <div>
        {standing && <Badge status={standing.status}>{standing.label}</Badge>}
        {row.attentionReasons.length > 0 ? (
          <ul className="ops-body" style={{ margin: "6px 0 0", paddingLeft: 16 }}>
            {row.attentionReasons.slice(0, 3).map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : (
          !standing && <p className="ops-body" style={{ margin: 0 }}>On track.</p>
        )}
      </div>

      <div>
        {ops && <p className="ops-field__help">{ops.openWork} open work · {ops.overdueWork} overdue</p>}
        <Link href={href} className="ops-label" style={{ color: "var(--bow-blue)", textDecoration: "none" }}>
          {row.unlinked ? "Open record →" : "Open profile →"}
        </Link>
      </div>
    </article>
  );
}
