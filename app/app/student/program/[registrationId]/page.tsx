import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireRole } from "@/lib/dal";
import { loadStudentProgramHome } from "@/lib/family-portal";
import { registrationLabel } from "@/lib/enrollment-shared";

export const metadata: Metadata = { title: "My program" };

/**
 * One clear home per student program. Scoped by `s.user_id = session user`
 * inside loadStudentProgramHome() — a student changing the registrationId in
 * the URL can only ever land on their own registrations or a 404, never a
 * sibling's or another student's.
 */
export default async function StudentProgramPage({ params }: { params: Promise<{ registrationId: string }> }) {
  const { registrationId } = await params;
  const me = await requireRole("student");
  const home = await loadStudentProgramHome(me.id, registrationId);
  if (!home) notFound();

  const beforeFirstSession = home.sessions.every((s) => s.status === "scheduled") && home.sessionsCompleted === 0;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "clamp(16px,4vw,32px)" }}>
      <header style={{ marginBottom: 24 }}>
        <p style={{ margin: "0 0 4px", fontFamily: "var(--font-data)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--bow-slate, #6b6e75)" }}>
          {registrationLabel(home.status)}
        </p>
        <h1 style={{ margin: "0 0 8px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(24px,4vw,32px)" }}>{home.programName}</h1>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 14, color: "var(--bow-slate, #55585f)" }}>
          {home.instructorName && <span>Instructor: {home.instructorName}</span>}
          {home.location && <span>Location: {home.location}</span>}
        </div>
        {home.nextSession ? (
          <div style={{ marginTop: 14, padding: "12px 16px", background: "#fff4ec", border: "1px solid #f0c9ab", borderRadius: 8, display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <strong>Next session:</strong> {new Date(home.nextSession.sessionDate).toLocaleString()}
              {home.nextSession.location ? ` · ${home.nextSession.location}` : home.nextSession.meetingLink ? " · Online" : ""}
            </div>
            {/* The one immediate action: join the link when it's the way in. Never hidden behind hover — it's the primary CTA for this screen. */}
            {home.nextSession.meetingLink && (
              <a
                href={home.nextSession.meetingLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  alignSelf: "flex-start",
                  minHeight: 44,
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "10px 18px",
                  fontFamily: "var(--font-interface)",
                  fontWeight: 700,
                  fontSize: 14,
                  color: "#fff",
                  background: "var(--bow-orange, #d4531f)",
                  borderRadius: 6,
                  textDecoration: "none",
                }}
              >
                Join session
              </a>
            )}
          </div>
        ) : (
          <p style={{ marginTop: 14, fontSize: 14 }}>No upcoming session scheduled yet.</p>
        )}
      </header>

      {beforeFirstSession && (
        <section style={sectionStyle}>
          <h2 style={h2Style}>Welcome</h2>
          {home.shortDescription && <p style={pStyle}>{home.shortDescription}</p>}
          {home.longDescription && <p style={pStyle}>{home.longDescription}</p>}
          {home.instructorName && <p style={pStyle}>Your instructor is {home.instructorName}.</p>}
        </section>
      )}

      {home.whatToBring && (
        <section style={sectionStyle}>
          <h2 style={h2Style}>How to prepare</h2>
          <p style={pStyle}>{home.whatToBring}</p>
        </section>
      )}

      <section style={sectionStyle}>
        <h2 style={h2Style}>Sessions</h2>
        {home.sessions.length === 0 ? (
          <p style={pStyle}>No sessions scheduled yet.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {home.sessions.map((s) => (
              <li key={s.id} style={{ border: "1px solid #e4e2dc", borderRadius: 6, padding: "10px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <span>{s.title || "Session"} — {new Date(s.sessionDate).toLocaleString()}</span>
                  <span style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--bow-slate, #6b6e75)" }}>
                    {sessionStatusLabel(s.status)}
                    {s.attendanceStatus ? ` · ${s.attendanceStatus}` : ""}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Progress</h2>
        <p style={pStyle}>
          {home.sessionsCompleted} of {home.sessionsTotal} sessions completed · {home.sessionsAttended} attended ·{" "}
          {home.sessionsRemaining} remaining
        </p>
        {home.completion && (
          <p style={pStyle}>
            {home.completion.outcome === "completed" ? "Program completed." : home.completion.outcome === "participated" ? "Participation recorded." : "Not yet complete."}
            {home.completion.certificateSerial ? ` Certificate ${home.completion.certificateSerial}.` : ""}
          </p>
        )}
      </section>
    </div>
  );
}

function sessionStatusLabel(status: string): string {
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";
  return "Scheduled";
}

const sectionStyle: React.CSSProperties = { marginBottom: 24 };
const h2Style: React.CSSProperties = { margin: "0 0 10px", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18 };
const pStyle: React.CSSProperties = { margin: "0 0 8px", fontFamily: "var(--font-interface)", fontSize: 14.5, lineHeight: 1.6, color: "var(--bow-slate, #3f4147)" };
