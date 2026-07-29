import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/dal";
import { guardianPersonForUser } from "@/lib/parent-activation";
import { loadFamilyDashboard } from "@/lib/family-portal";
import { computeNextAction } from "@/components/family/next-action";
import NotificationCard from "@/components/family/NotificationCard";
import RequirementList from "@/components/family/RequirementList";
import type { SessionRow } from "@/lib/family-portal";

export const metadata: Metadata = { title: "Dashboard" };

function icsDate(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

/**
 * Client-side "add to calendar" — a data: URI .ics file, no calendar
 * integration to stand up. One event, one hour default length (session
 * end time isn't tracked), title/location/link taken from the session.
 */
function buildCalendarLink(programName: string, session: SessionRow): string {
  const start = icsDate(session.sessionDate);
  const end = icsDate(session.sessionDate + 60 * 60 * 1000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BOW Sports Capital//Family Portal//EN",
    "BEGIN:VEVENT",
    `UID:${session.id}@bowsportscapital.org`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${(session.title || programName).replace(/\r?\n/g, " ")}`,
    session.location ? `LOCATION:${session.location.replace(/\r?\n/g, " ")}` : null,
    session.meetingLink ? `DESCRIPTION:${session.meetingLink}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter((l): l is string => l != null);
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join("\r\n"))}`;
}

export default async function FamilyDashboardPage() {
  const me = await requireRole("parent");
  const personId = await guardianPersonForUser(me.id);

  if (!personId) {
    return (
      <div role="alert" style={panelStyle}>
        <h1 style={h1Style}>We couldn&apos;t find your family</h1>
        <p style={bodyStyle}>
          Your account isn&apos;t linked to a guardian record yet. Contact BOW support and we&apos;ll connect it.
        </p>
      </div>
    );
  }

  const dashboard = await loadFamilyDashboard(personId);
  const nextAction = computeNextAction(dashboard);

  if (dashboard.children.length === 0 && dashboard.completedPrograms.length === 0) {
    return (
      <div style={panelStyle}>
        <h1 style={h1Style}>Welcome</h1>
        <p style={bodyStyle}>No children are linked to your account yet. If that&apos;s unexpected, contact BOW support.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {/* 1. One most important next action. */}
      {nextAction && (
        <section
          style={{
            border: `2px solid ${nextAction.urgency === "urgent" ? "#c0442b" : "var(--bow-orange, #d4531f)"}`,
            borderRadius: 10,
            background: "#fff",
            padding: "20px 22px",
          }}
        >
          <p style={{ margin: "0 0 6px", fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: nextAction.urgency === "urgent" ? "#c0442b" : "var(--bow-orange, #d4531f)" }}>
            Next step
          </p>
          <h2 style={{ margin: "0 0 6px", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20 }}>{nextAction.title}</h2>
          <p style={{ margin: "0 0 14px", ...bodyStyle }}>{nextAction.body}</p>
          <Link href={nextAction.href} style={ctaLinkStyle}>{nextAction.ctaLabel} →</Link>
        </section>
      )}
      {!nextAction && (
        <section style={{ ...panelStyle, background: "#f2f3f5" }}>
          <p style={{ ...bodyStyle, margin: 0 }}>You&apos;re all caught up — nothing needs your attention right now.</p>
        </section>
      )}

      {/* 2. Children. */}
      <section>
        <h2 style={h2Style}>Children</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {dashboard.children.map((child) => (
            <div key={child.registrationId} style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <p style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 17 }}>{child.studentName}</p>
                  <p style={{ margin: "2px 0 0", ...smallStyle }}>{child.programName}</p>
                </div>
                <StatusPill label={child.statusLabel} />
              </div>
              {child.nextSession && (
                <>
                  <p style={{ margin: "10px 0 0", ...smallStyle }}>
                    Next session: {new Date(child.nextSession.sessionDate).toLocaleString()}
                    {child.nextSession.location ? ` · ${child.nextSession.location}` : ""}
                  </p>
                  <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
                    {child.nextSession.meetingLink && (
                      <a href={child.nextSession.meetingLink} target="_blank" rel="noopener noreferrer" style={ctaLinkStyle}>
                        Join session →
                      </a>
                    )}
                    <a
                      href={buildCalendarLink(child.programName, child.nextSession)}
                      download={`${child.programName.replace(/[^a-z0-9]+/gi, "-")}.ics`}
                      style={ctaLinkStyle}
                    >
                      Add to calendar →
                    </a>
                  </div>
                </>
              )}
              {child.instructorName && <p style={{ margin: "8px 0 0", ...smallStyle }}>Instructor: {child.instructorName}</p>}
              {child.whatToBring && <p style={{ margin: "4px 0 0", ...smallStyle }}>What to bring: {child.whatToBring}</p>}
              {child.supportContact && <p style={{ margin: "4px 0 0", ...smallStyle }}>Need help? {child.supportContact}</p>}
              {child.missingRequirements > 0 && (
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "#a0451f", fontWeight: 600 }}>
                  {child.missingRequirements} step{child.missingRequirements === 1 ? "" : "s"} remaining
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 3. Family schedule. */}
      <section>
        <h2 style={h2Style}>Upcoming schedule</h2>
        {dashboard.schedule.length === 0 ? (
          <p style={bodyStyle}>No upcoming sessions scheduled yet.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {dashboard.schedule.map((s) => (
              <li key={s.id} style={cardStyle}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>
                  {s.studentName} · {s.programName}
                </p>
                <p style={{ margin: "4px 0 0", ...smallStyle }}>
                  {new Date(s.sessionDate).toLocaleString()} {s.timezone ? `(${s.timezone})` : ""}
                  {s.location
                    ? ` · ${s.location}`
                    : s.meetingLink && (
                        <>
                          {" · "}
                          <a href={s.meetingLink} target="_blank" rel="noopener noreferrer">
                            Join online
                          </a>
                        </>
                      )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 4. Requirements, grouped. */}
      <section>
        <h2 style={h2Style}>Requirements</h2>
        <RequirementList title="Required now" items={dashboard.requirementsRequiredNow} />
        <RequirementList title="Due later" items={dashboard.requirementsDueLater} />
        <RequirementList title="Completed" items={dashboard.requirementsCompleted} collapsedByDefault />
      </section>

      {/* 5. Notifications. */}
      <section>
        <h2 style={h2Style}>Notifications</h2>
        {dashboard.notifications.length === 0 ? (
          <p style={bodyStyle}>No notifications yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {dashboard.notifications.slice(0, 15).map((n) => (
              <NotificationCard key={n.id} notification={n} />
            ))}
          </div>
        )}
      </section>

      {/* 6. Completed programs. */}
      {dashboard.completedPrograms.length > 0 && (
        <section>
          <h2 style={h2Style}>Completed programs</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {dashboard.completedPrograms.map((p) => (
              <div key={p.registrationId} style={cardStyle}>
                <p style={{ margin: 0, fontWeight: 700 }}>{p.studentName} · {p.programName}</p>
                <p style={{ margin: "4px 0 0", ...smallStyle }}>
                  {p.sessionsAttended}/{p.sessionsTotal} sessions attended
                  {p.completedAt ? ` · completed ${new Date(p.completedAt).toLocaleDateString()}` : ""}
                </p>
                {p.certificateSerial && <p style={{ margin: "4px 0 0", ...smallStyle }}>Certificate {p.certificateSerial}</p>}
                {p.recommendedNextProgramName && (
                  <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--bow-orange, #d4531f)", fontWeight: 600 }}>
                    Suggested next: {p.recommendedNextProgramName}
                  </p>
                )}
                {!p.feedbackSubmitted && <p style={{ margin: "6px 0 0", fontSize: 13 }}>Feedback not yet shared.</p>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatusPill({ label }: { label: string }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-data)",
        fontSize: 11,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        padding: "4px 10px",
        borderRadius: 999,
        background: "#eef0f2",
        border: "1px solid #d8dae0",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

const panelStyle: React.CSSProperties = { background: "#fff", border: "1px solid #e4e2dc", borderRadius: 10, padding: 24 };
const h1Style: React.CSSProperties = { fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 26, margin: "0 0 10px" };
const h2Style: React.CSSProperties = { fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, margin: "0 0 12px" };
const bodyStyle: React.CSSProperties = { fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.6, color: "var(--bow-slate, #55585f)" };
const smallStyle: React.CSSProperties = { fontFamily: "var(--font-interface)", fontSize: 13, color: "var(--bow-slate, #6b6e75)" };
const cardStyle: React.CSSProperties = { background: "#fff", border: "1px solid #e4e2dc", borderRadius: 8, padding: "14px 16px" };
const ctaLinkStyle: React.CSSProperties = {
  display: "inline-block",
  fontFamily: "var(--font-interface)",
  fontWeight: 700,
  fontSize: 14,
  color: "var(--bow-orange, #d4531f)",
  textDecoration: "none",
};
