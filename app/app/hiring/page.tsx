import Link from "next/link";
import { Badge, Button, PageHeader, PageSection } from "@/components/ds";
import { requireStaff } from "@/lib/dal";
import { getHiringCommandData } from "@/lib/people-work";
import HiringPackageForm from "@/components/app/hiring/HiringPackageForm";
import PublishOpeningButton from "@/components/app/hiring/PublishOpeningButton";

/**
 * Presented tabs are collapsed to three (Stage 5): Attention is the default
 * management-by-exception view, Candidates is the full pipeline list, and
 * Openings folds hiring needs/requisitions into the opening row (a
 * requisition is ~1:1 with an opening — target/filled reads inline instead
 * of as a separate tab). Roles and Processes are pure org/versioning config;
 * their data and actions are untouched, but they no longer compete for
 * attention on the day-to-day hiring surface — reachable via the quiet
 * "Roles & processes" link at the bottom of Openings.
 */
const NAV_VIEWS = ["attention", "candidates", "openings"] as const;
type NavView = typeof NAV_VIEWS[number];
type View = NavView | "config";

function isView(value: unknown): value is View {
  return NAV_VIEWS.includes(value as NavView) || value === "config";
}

export default async function HiringPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const me = await requireStaff();
  const { view: requested } = await searchParams;
  const view: View = isView(requested) ? requested : "attention";
  const data = await getHiringCommandData();
  const labels: Record<NavView, string> = { attention: "Needs Attention", candidates: "Candidates", openings: "Openings" };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px clamp(16px,4vw,32px) 96px", display: "flex", flexDirection: "column", gap: 4 }}>
      <PageHeader
        eyebrow="BOW OS · Talent"
        title="Hiring"
        context="Every active candidate has an owner, a next action, and an immutable record of the process they entered."
        action={me.role === "admin" ? <HiringPackageForm /> : undefined}
      />

      <nav aria-label="Hiring views" style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border-rule)", margin: "8px 0 4px", flexWrap: "wrap" }}>
        {NAV_VIEWS.map((item) => (
          <Link
            key={item}
            href={item === "attention" ? "/app/hiring" : `/app/hiring?view=${item}`}
            aria-current={view === item ? "page" : undefined}
            style={{
              display: "inline-flex", alignItems: "center", padding: "10px 14px", fontFamily: "var(--font-interface)",
              fontSize: 13, fontWeight: 600, color: view === item ? "var(--bow-ink)" : "var(--bow-slate)",
              borderBottom: view === item ? "2px solid var(--bow-blue)" : "2px solid transparent", marginBottom: -1, textDecoration: "none",
            }}
          >
            {labels[item]}
          </Link>
        ))}
      </nav>

      {view === "attention" && (
        <PageSection title="What needs attention?" noRule>
          {data.attention.length === 0 ? (
            <div className="ops-empty"><Badge status="positive">Pipeline clear</Badge><h3 className="ops-empty__title" style={{ marginTop: 10 }}>No candidate is overdue or in limbo.</h3></div>
          ) : (
            <div className="ops-list">
              {data.attention.map((item) => (
                <article key={item.id} className="ops-list-row">
                  <div><Link className="ops-record-name" href={`/app/hiring/applications/${item.id}`}>{item.personName}</Link><span className="ops-record-meta">{item.openingTitle} · {item.stageTitle}</span></div>
                  <div><span className="ops-label">Shown because</span><span className="ops-value">{item.reason}</span></div>
                  <div><span className="ops-label">Owner</span><span className="ops-value">{item.ownerName ?? "Unassigned"}</span></div>
                  <Badge status={item.tone}>{item.tone === "negative" ? "Act now" : item.tone === "warning" ? "Due soon" : "Next"}</Badge>
                  <Button href={`/app/hiring/applications/${item.id}`} size="sm" variant="secondary">Open</Button>
                </article>
              ))}
            </div>
          )}
        </PageSection>
      )}

      {view === "candidates" && (
        <PageSection
          title="Candidates"
          action={<Badge status="info">{data.candidates.length}</Badge>}
          noRule
        >
          <div className="ops-list">
            {data.candidates.map((candidate) => (
              <article className="ops-list-row" key={candidate.id}>
                <div><Link className="ops-record-name" href={`/app/hiring/applications/${candidate.id}`}>{candidate.personName}</Link><span className="ops-record-meta">{candidate.email}</span></div>
                <div><span className="ops-label">Opening</span><span className="ops-value">{candidate.openingTitle}</span></div>
                <div><span className="ops-label">Stage</span><span className="ops-value">{candidate.stageTitle}</span></div>
                <div><span className="ops-label">Next</span><span className="ops-value">{candidate.nextAction ?? "Final"}</span></div>
                <Badge status={["accepted"].includes(candidate.lifecycle) ? "positive" : ["rejected", "withdrawn"].includes(candidate.lifecycle) ? "locked" : "info"}>{candidate.lifecycle}</Badge>
              </article>
            ))}
          </div>
        </PageSection>
      )}

      {view === "openings" && (
        <PageSection title="Openings" noRule>
          <div className="ops-list">
            {data.openings.map((opening) => {
              const need = data.requisitions.find((r) => r.title === opening.title) ?? data.requisitions[0];
              return (
                <div className="ops-list-row" key={opening.id}>
                  <div><span className="ops-record-name">{opening.title}</span><span className="ops-record-meta">/join/{opening.slug} · version {opening.version}</span></div>
                  {need && (
                    <div>
                      <span className="ops-label">Target vs filled</span>
                      <span className="ops-value">{need.filled} / {need.target} filled · {need.pipeline} in pipeline</span>
                    </div>
                  )}
                  {need?.neededBy && <div><span className="ops-label">Needed by</span><span className="ops-value">{need.neededBy}</span></div>}
                  <Badge status={opening.status === "published" ? "positive" : "neutral"}>{opening.status}</Badge>
                  {opening.status === "published" ? (
                    <Button href={`/join/${opening.slug}`} size="sm" variant="secondary">View Public Page</Button>
                  ) : me.role === "admin" ? (
                    <PublishOpeningButton openingId={opening.id} />
                  ) : null}
                </div>
              );
            })}
          </div>
          <p style={{ marginTop: 16 }}>
            <Link href="/app/hiring?view=config" className="ops-inline-link">Roles &amp; processes (config) →</Link>
          </p>
        </PageSection>
      )}

      {view === "config" && (
        <>
          <PageSection title="Roles" noRule>
            <div className="ops-list">
              {data.roles.map((role) => (
                <div className="ops-list-row" key={role.id}>
                  <div><span className="ops-record-name">{role.title}</span><span className="ops-record-meta">{role.unitName}</span></div>
                  <Badge status={role.status === "active" ? "positive" : "locked"}>{role.status}</Badge>
                </div>
              ))}
            </div>
          </PageSection>
          <PageSection title="Processes">
            <div className="ops-list">
              {data.processes.map((process) => (
                <div className="ops-list-row" key={process.id}>
                  <div><span className="ops-record-name">{process.name}</span><span className="ops-record-meta">Latest version {process.latestVersion}</span></div>
                  <Badge status={process.status === "active" ? "positive" : "locked"}>{process.status}</Badge>
                </div>
              ))}
            </div>
          </PageSection>
          <p><Link href="/app/hiring" className="ops-inline-link">← Back to Hiring</Link></p>
        </>
      )}
    </div>
  );
}
