import Link from "next/link";
import { Badge, SectionHeader } from "@/components/ds";
import { requireActiveInstructorSelf } from "@/lib/dal";
import { listClassesForInstructor } from "@/lib/hiring";

export default async function TeachClassesPage() {
  const { instructor } = await requireActiveInstructorSelf();
  const classes = listClassesForInstructor(instructor.id);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px clamp(16px,4vw,32px) 96px", display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionHeader kicker="My BOW" title="My Classes" level={1} />
      {classes.length === 0 && (
        <div style={{ background: "var(--bow-white)", border: "1px dashed var(--border-rule)", borderRadius: 6, padding: 32, textAlign: "center" }}>
          <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-slate)" }}>
            You aren&rsquo;t assigned to any classes yet.
          </p>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {classes.map((c) => (
          <Link
            key={c.id}
            href={`/app/teach/classes/${c.id}`}
            style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, textDecoration: "none" }}
          >
            <div>
              <span style={{ fontFamily: "var(--font-interface)", fontSize: 15, color: "var(--bow-ink)", fontWeight: 600 }}>{c.title}</span>
              <p style={{ margin: "4px 0 0", fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)" }}>
                {c.location || c.onlineFormat || "—"} · {c.startDate || "—"}
              </p>
            </div>
            <Badge status="info">{c.status.replace(/_/g, " ")}</Badge>
          </Link>
        ))}
      </div>
    </div>
  );
}
