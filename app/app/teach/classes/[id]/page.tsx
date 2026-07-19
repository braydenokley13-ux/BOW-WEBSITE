import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge, SectionHeader } from "@/components/ds";
import { requireActiveInstructorSelf } from "@/lib/dal";
import { getClassDetail } from "@/lib/hiring";
import { getDb } from "@/lib/db";
import { formatDateTimeInZone } from "@/lib/timezone";

const cardStyle = { background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 22 } as const;
const labelStyle = { fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "var(--bow-slate)" };
const valueStyle = { fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-ink)" };

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function TeachClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { instructor } = await requireActiveInstructorSelf();
  const detail = (await getClassDetail(id));
  if (!detail) notFound();

  // Membership check — a non-member instructor sees nothing here, mirroring
  // the server-action boundary in app/actions/classes.ts.
  const isMember = detail.instructors.some((ci: any) => ci.instructor_id === instructor.id);
  if (!isMember) redirect("/app/teach/classes");

  const { class: cls, sessions, enrollments } = detail;
  const db = getDb();
  const enrolled = enrollments.filter((e) => e.status === "enrolled");
  const roster = (await Promise.all(enrolled.map(async (e) => {
      const s = (await db.prepare("SELECT * FROM students WHERE id = ?").get(e.studentId)) as any;
      return { id: e.studentId, name: s?.name ?? e.studentId };
    })));

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px clamp(16px,4vw,32px) 96px", display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionHeader kicker="My Classes" title={cls.title} level={1} />
      <Badge status="info">{cls.status.replace(/_/g, " ")}</Badge>

      <div style={cardStyle}>
        <span style={{ ...labelStyle, display: "block", marginBottom: 12 }}>Roster</span>
        {roster.length === 0 && <p style={valueStyle}>No students enrolled.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {roster.map((r) => (
            <span key={r.id} style={valueStyle}>{r.name}</span>
          ))}
        </div>
      </div>

      <div style={cardStyle}>
        <span style={{ ...labelStyle, display: "block", marginBottom: 6 }}>Scheduled sessions</span>
        <p style={{ ...valueStyle, color: "var(--bow-slate)", lineHeight: 1.5, margin: "0 0 12px" }}>
          Open a scheduled session to record its locked roster, attendance, delivery notes, and final report.
        </p>
        {sessions.length === 0 && (
          <p style={{ ...valueStyle, margin: 0 }}>
            No sessions are scheduled yet. Delivery cannot be recorded until the Class has a real session.
          </p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sessions.map((s) => (
            <Link
              aria-label={`Open scheduled session ${formatDateTimeInZone(s.sessionDate, s.timeZone ?? cls.scheduleTimezone)}`}
              key={s.id}
              href={`/app/teach/classes/${id}/sessions/${s.id}`}
              style={{ ...valueStyle, color: "var(--bow-blue)", display: "block" }}
            >
              Open session · {formatDateTimeInZone(s.sessionDate, s.timeZone ?? cls.scheduleTimezone)} {s.location ? `— ${s.location}` : ""}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
