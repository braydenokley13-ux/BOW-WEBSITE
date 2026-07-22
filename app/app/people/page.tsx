import Link from "next/link";
import { Badge } from "@/components/ds";
import { requireStaff } from "@/lib/dal";
import { getPeopleOperationsData } from "@/lib/people-operations";

const standingBadge = {
  strong: { label: "Strong", status: "positive" as const },
  on_track: { label: "On Track", status: "info" as const },
  needs_attention: { label: "Needs Attention", status: "warning" as const },
  at_risk: { label: "At Risk", status: "negative" as const },
};

export default async function MyPeoplePage() {
  const me = await requireStaff();
  const data = await getPeopleOperationsData({ userId: me.id, role: me.role });
  const ordered = [...data.people].sort((a, b) => {
    const rank = { at_risk: 0, needs_attention: 1, on_track: 2, strong: 3 };
    return rank[a.standing] - rank[b.standing] || a.name.localeCompare(b.name);
  });
  const needsAttention = ordered.filter((person) => ["at_risk", "needs_attention"].includes(person.standing));

  return (
    <main className="ops-page">
      <header className="ops-hero">
        <div className="ops-hero__copy">
          <span className="ops-eyebrow">BOW OS · Management by exception</span>
          <h1 className="ops-title">My People</h1>
          <p className="ops-summary">See who is executing, who is blocked, and who needs feedback. The evidence comes from real Work, weekly commitments, and role history—not a made-up person score.</p>
        </div>
      </header>

      <section aria-label="Manager summary" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
        <div className="ops-panel" style={{ padding: 16 }}><span className="ops-label">In scope</span><strong style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 32 }}>{ordered.length}</strong><span className="ops-field__help">{me.role === "admin" ? "Active BOW operating team" : "You and your direct reports"}</span></div>
        <div className="ops-panel" style={{ padding: 16 }}><span className="ops-label">Needs attention</span><strong style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 32 }}>{needsAttention.length}</strong><span className="ops-field__help">Exceptions before normal work</span></div>
        <div className="ops-panel" style={{ padding: 16 }}><span className="ops-label">Weekly commitments missing</span><strong style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 32 }}>{ordered.filter((person) => !person.currentWeek).length}</strong><span className="ops-field__help">Current week beginning {data.currentWeekStart}</span></div>
        <div className="ops-panel" style={{ padding: 16 }}><span className="ops-label">Waiting for review</span><strong style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 32 }}>{ordered.reduce((sum, person) => sum + person.waitingReview, 0)}</strong><span className="ops-field__help">Submitted Work awaiting judgment</span></div>
      </section>

      {ordered.length === 0 ? (
        <section className="ops-empty"><h2 className="ops-empty__title">No people are in your management scope yet</h2><p className="ops-empty__body">Create role assignments and reporting relationships before using the manager layer.</p></section>
      ) : (
        <section aria-labelledby="people-attention-heading" style={{ display: "grid", gap: 10 }}>
          <div><span className="ops-label">At risk first</span><h2 id="people-attention-heading" className="ops-section-title">Who needs me?</h2></div>
          <div className="ops-panel" style={{ padding: 0, overflow: "hidden" }}>
            {ordered.map((person, index) => {
              const standing = standingBadge[person.standing];
              return <article key={person.personId} style={{ padding: "18px clamp(14px,3vw,22px)", borderBottom: index === ordered.length - 1 ? 0 : "1px solid var(--border-rule)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 18, alignItems: "start" }}>
                <div><Badge status={standing.status}>{standing.label}</Badge><h3 style={{ margin: "8px 0 2px", fontFamily: "var(--font-interface)", fontSize: 17 }}><Link href={`/app/people/${person.personId}`} style={{ color: "inherit", textDecoration: "none" }}>{person.name}</Link></h3><p className="ops-field__help">{person.roleTitle} · {person.assignmentStatus?.replace(/_/g, " ") ?? "no role assignment"}</p></div>
                <div>{person.attentionReasons.length ? <ul className="ops-body" style={{ margin: 0, paddingLeft: 18 }}>{person.attentionReasons.slice(0, 4).map((reason) => <li key={reason}>{reason}</li>)}</ul> : <p className="ops-body" style={{ margin: 0 }}>No current exception. Work and weekly commitment are on track.</p>}{person.currentWeek && <p className="ops-body" style={{ margin: "8px 0 0" }}><strong>This week:</strong> {person.currentWeek.commitment}</p>}</div>
                <div><span className="ops-label">Work · {person.openWork} open</span><p className="ops-field__help">{person.overdueWork} overdue · {person.waitingReview} review</p><span className="ops-label">Capacity · {person.availabilityStatus}</span><p className="ops-field__help">{person.weeklyCapacityHours == null ? "Not estimated" : `${person.weeklyCapacityHours} hrs / week`}</p><Link href={`/app/people/${person.personId}`} className="ops-label" style={{ color: "var(--bow-blue)", textDecoration: "none" }}>Open operating profile →</Link></div>
              </article>;
            })}
          </div>
        </section>
      )}
    </main>
  );
}
