import { Badge, Button, DataTable, SectionHeader } from "@/components/ds";
import { listOrganizations, listDemoRequests } from "@/lib/hiring";
import DemoRequestActions from "@/components/app/partners/DemoRequestActions";

export default function PartnersPage() {
  const organizations = listOrganizations();
  const demoRequests = listDemoRequests();
  const pendingDemoRequests = demoRequests.filter((d) => !d.dispositioned);

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px clamp(16px,4vw,32px) 96px", display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionHeader kicker="BOW HQ" title="Partners" level={1} />
      <p style={{ fontFamily: "var(--font-interface)", fontSize: 15, color: "var(--bow-slate)", maxWidth: 640 }}>
        Partner organizations BOW runs classes with. {organizations.length} total.
      </p>

      <DataTable columns={["Name", "Type", "Location", "Status", ""]} isEmpty={organizations.length === 0} emptyLabel="No partner organizations yet.">
        {organizations.map((o) => (
          <tr key={o.id} style={{ borderBottom: "1px solid var(--border-rule)" }}>
            <td style={{ padding: "11px 12px", fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-ink)" }}>{o.name}</td>
            <td style={{ padding: "11px 12px", fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)" }}>{o.type}</td>
            <td style={{ padding: "11px 12px", fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)" }}>{o.location || "—"}</td>
            <td style={{ padding: "11px 12px" }}>
              <Badge status="neutral">{o.status}</Badge>
            </td>
            <td style={{ padding: "11px 12px", textAlign: "right" }}>
              <Button href={`/app/partners/${o.id}`} variant="secondary" size="sm">View</Button>
            </td>
          </tr>
        ))}
      </DataTable>

      <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, textTransform: "uppercase", letterSpacing: "0.02em", color: "var(--bow-ink)" }}>
            Website demo requests
          </h3>
          <Badge status={pendingDemoRequests.length > 0 ? "warning" : "neutral"}>{pendingDemoRequests.length} pending</Badge>
        </div>
        <p style={{ fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-slate)", maxWidth: 640, margin: 0 }}>
          &quot;Request a Demo&quot; submissions from partner landing pages. Create a follow-up task to disposition one.
        </p>
        <DataTable
          columns={["Org", "Requester", "Message", "Submitted", ""]}
          isEmpty={demoRequests.length === 0}
          emptyLabel="No demo requests yet."
        >
          {demoRequests.map((d) => (
            <tr key={d.id} style={{ borderBottom: "1px solid var(--border-rule)" }}>
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
    </div>
  );
}
