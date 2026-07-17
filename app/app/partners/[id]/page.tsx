import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, SectionHeader } from "@/components/ds";
import { getOrganizationDetail, listActivity } from "@/lib/hiring";

const cardStyle = { background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 22 } as const;
const labelStyle = { fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "var(--bow-slate)" };
const valueStyle = { fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-ink)" };

export default async function PartnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = getOrganizationDetail(id);
  if (!detail) notFound();
  const { org, relatedClasses } = detail;
  const activity = listActivity("organization", id);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px clamp(16px,4vw,32px) 96px", display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionHeader kicker="Partners" title={org.name} />
      <div style={{ display: "flex", gap: 10 }}>
        <Badge status="info">{org.type}</Badge>
        <Badge status="neutral">{org.status}</Badge>
      </div>

      <div style={cardStyle}>
        <span style={labelStyle}>Location</span>
        <p style={valueStyle}>{org.location || "—"}</p>
      </div>

      <div style={cardStyle}>
        <span style={{ ...labelStyle, display: "block", marginBottom: 12 }}>Classes with this partner</span>
        {relatedClasses.length === 0 && <p style={valueStyle}>No classes yet.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {relatedClasses.map((c) => (
            <Link key={c.id} href={`/app/classes/${c.id}`} style={{ ...valueStyle, color: "var(--bow-blue)" }}>
              {c.title} — {c.status}
            </Link>
          ))}
        </div>
      </div>

      <div style={cardStyle}>
        <span style={{ ...labelStyle, display: "block", marginBottom: 12 }}>Activity</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {activity.length === 0 && <span style={valueStyle}>No activity yet.</span>}
          {activity.map((a) => (
            <div key={a.id} style={{ borderBottom: "1px solid var(--border-rule)", paddingBottom: 8 }}>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)" }}>
                {new Date(a.createdAt).toLocaleString()} · {a.kind}
              </span>
              <p style={{ ...valueStyle, margin: "2px 0 0" }}>{a.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
