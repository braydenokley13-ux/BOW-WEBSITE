import { Badge, Button, DataTable } from "@/components/ds";
import { listOrganizations, listDemoRequests } from "@/lib/hiring";
import DemoRequestActions from "@/components/app/partners/DemoRequestActions";

export default async function PartnersPage() {
  const organizations = (await listOrganizations());
  const demoRequests = (await listDemoRequests());
  const pendingDemoRequests = demoRequests.filter((d) => !d.dispositioned);

  return (
    <main className="ops-page" data-accent="blue">
      <header className="ops-hero">
        <div className="ops-hero__copy">
          <span className="ops-eyebrow">BOW HQ · Partners</span>
          <h1 className="ops-title">Partners</h1>
          <p className="ops-summary">
            Partner organizations BOW runs classes with. {organizations.length} total.
          </p>
        </div>
      </header>

      {organizations.length === 0 ? (
        <section className="ops-empty">
          <h2 className="ops-empty__title">No partner organizations yet.</h2>
          <p className="ops-empty__body">Partner organizations will appear here once created.</p>
        </section>
      ) : (
        <section className="ops-list" aria-label="Partner organizations">
          {organizations.map((o) => (
            <article className="ops-list-row" key={o.id}>
              <div>
                <a className="ops-record-name" href={`/app/partners/${o.id}`}>{o.name}</a>
                <span className="ops-record-meta">{o.location || "Location not set"}</span>
              </div>
              <div>
                <span className="ops-label">Type</span>
                <span className="ops-value">{o.type}</span>
              </div>
              <div>
                <span className="ops-label">Status</span>
                <Badge status="neutral">{o.status}</Badge>
              </div>
              <div />
              <Button href={`/app/partners/${o.id}`} variant="secondary" size="sm">View</Button>
            </article>
          ))}
        </section>
      )}

      <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="ops-section-head">
          <div>
            <h2 className="ops-section-title">Website demo requests</h2>
            <p className="ops-section-note">
              &quot;Request a Demo&quot; submissions from partner landing pages. Create a follow-up task to disposition one.
            </p>
          </div>
          <Badge status={pendingDemoRequests.length > 0 ? "warning" : "neutral"}>{pendingDemoRequests.length} pending</Badge>
        </div>
        <DataTable
          columns={["Org", "Requester", "Message", "Submitted", ""]}
          isEmpty={demoRequests.length === 0}
          emptyLabel="No demo requests yet."
        >
          {demoRequests.map((d) => (
            <tr key={d.id}>
              <td style={{ padding: "11px 12px", fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-ink)" }}>{d.orgName ?? d.orgSlug}</td>
              <td style={{ padding: "11px 12px", fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)" }}>
                {d.requesterName} · {d.requesterEmail}
              </td>
              <td style={{ padding: "11px 12px", fontFamily: "var(--font-interface)", fontSize: 13, color: "var(--bow-slate)", maxWidth: 260 }}>
                {d.message || "—"}
              </td>
              <td style={{ padding: "11px 12px", fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)" }}>
                {new Date(d.createdAt).toLocaleDateString()}
              </td>
              <td style={{ padding: "11px 12px", textAlign: "right" }}>
                {d.dispositioned ? <Badge status="positive">Dispositioned</Badge> : <DemoRequestActions demoRequestId={d.id} />}
              </td>
            </tr>
          ))}
        </DataTable>
      </section>
    </main>
  );
}
