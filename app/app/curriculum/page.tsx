import { Badge, Button, SectionHeader } from "@/components/ds";
import { listCurricula } from "@/lib/hiring";

export default function CurriculumPage() {
  const curricula = listCurricula();
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px clamp(16px,4vw,32px) 96px", display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionHeader kicker="BOW HQ" title="Curriculum" action={{ label: "New Curriculum", href: "/app/curriculum/new" }} level={1} />
      <p style={{ fontFamily: "var(--font-interface)", fontSize: 15, color: "var(--bow-slate)", maxWidth: 640 }}>
        Published curricula classes are built on. {curricula.length} total.
      </p>

      <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-rule)" }}>
              {["Title", "Age range", "Status", ""].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {curricula.map((c) => (
              <tr key={c.id} style={{ borderBottom: "1px solid var(--border-rule)" }}>
                <td style={{ padding: "11px 12px", fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-ink)" }}>{c.title}</td>
                <td style={{ padding: "11px 12px", fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)" }}>{c.ageRange ?? "—"}</td>
                <td style={{ padding: "11px 12px" }}>
                  <Badge status={c.published ? "positive" : "neutral"}>{c.published ? "Published" : "Draft"}</Badge>
                </td>
                <td style={{ padding: "11px 12px", textAlign: "right" }}>
                  <Button href={`/app/curriculum/${c.id}`} variant="secondary" size="sm">View</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {curricula.length === 0 && (
        <div style={{ background: "var(--bow-white)", border: "1px dashed var(--border-rule)", borderRadius: 6, padding: 32, textAlign: "center" }}>
          <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-slate)" }}>No curricula yet.</p>
        </div>
      )}
    </div>
  );
}
