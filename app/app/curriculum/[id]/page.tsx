import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge, SectionHeader } from "@/components/ds";
import { getCurrentUser } from "@/lib/dal";
import { getDb, rowToCurriculum, rowToClass } from "@/lib/db";
import CurriculumForm from "@/components/app/curriculum/CurriculumForm";

const cardStyle = { background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 22 } as const;
const labelStyle = { fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "var(--bow-slate)" };
const valueStyle = { fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-ink)" };

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function CurriculumDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentUser();
  const db = getDb();
  const row = db.prepare("SELECT * FROM curricula WHERE id = ?").get(id) as any;
  if (!row) notFound();
  const curriculum = rowToCurriculum(row);
  const classes = (db.prepare("SELECT * FROM classes WHERE curriculum_id = ? ORDER BY updated_at DESC").all(id) as any[]).map(rowToClass);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px clamp(16px,4vw,32px) 96px", display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionHeader kicker="Curriculum" title={curriculum.title} level={1} />
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <Badge status={curriculum.published ? "positive" : "neutral"}>{curriculum.published ? "Published" : "Draft"}</Badge>
        {curriculum.ageRange && <Badge status="info">{curriculum.ageRange}</Badge>}
      </div>
      {curriculum.description && <p style={valueStyle}>{curriculum.description}</p>}

      <div style={cardStyle}>
        <span style={{ ...labelStyle, display: "block", marginBottom: 12 }}>Classes built on this curriculum</span>
        {classes.length === 0 && <p style={valueStyle}>No classes yet.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {classes.map((c) => (
            <Link key={c.id} href={`/app/classes/${c.id}`} style={{ ...valueStyle, color: "var(--bow-blue)" }}>
              {c.title} — {c.status}
            </Link>
          ))}
        </div>
      </div>

      {me?.role === "admin" && (
        <div style={cardStyle}>
          <span style={{ ...labelStyle, display: "block", marginBottom: 12 }}>Edit</span>
          <CurriculumForm
            mode="edit"
            curriculumId={curriculum.id}
            initial={{ title: curriculum.title, description: curriculum.description ?? "", ageRange: curriculum.ageRange ?? "", published: curriculum.published }}
          />
        </div>
      )}
    </div>
  );
}
