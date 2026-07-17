import { Badge, Button, SectionHeader } from "@/components/ds";
import { listOrganizations } from "@/lib/hiring";

export default function PartnersPage() {
  const organizations = listOrganizations();

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px clamp(16px,4vw,32px) 96px", display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionHeader kicker="BOW HQ" title="Partners" />
      <p style={{ fontFamily: "var(--font-interface)", fontSize: 15, color: "var(--bow-slate)", maxWidth: 640 }}>
        Partner organizations BOW runs classes with. {organizations.length} total.
      </p>

      <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-rule)" }}>
              {["Name", "Type", "Location", "Status", ""].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {organizations.map((o) => (
              <tr key={o.id} style={{ borderBottom: "1px solid var(--border-rule)" }}>
                <td style={{ padding: "11px 12px", fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-ink)" }}>{o.name}</td>
                <td style={{ padding: "11px 12px", fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)" }}>{o.type}</td>
                <td style={{ padding: "11px 12px", fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)" }}>{o.location || "—"}</td>
                <td style={{ padding: "11px 12px" }}><Badge status="neutral">{o.status}</Badge></td>
                <td style={{ padding: "11px 12px", textAlign: "right" }}>
                  <Button href={`/app/partners/${o.id}`} variant="secondary" size="sm">View</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {organizations.length === 0 && (
        <div style={{ background: "var(--bow-white)", border: "1px dashed var(--border-rule)", borderRadius: 6, padding: 32, textAlign: "center" }}>
          <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-slate)" }}>No partner organizations yet.</p>
        </div>
      )}
    </div>
  );
}
