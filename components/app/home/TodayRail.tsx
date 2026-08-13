import Link from "next/link";
import { Badge, Button } from "@/components/ds";
import { sessionTimeLabel, zoneAbbreviation, type TodaySession } from "@/lib/hq-home-shared";

interface Props {
  sessions: TodaySession[];
  nextSession: { sessionOn: string; classTitle: string } | null;
}

function friendlyDate(sessionOn: string): string {
  const parsed = new Date(`${sessionOn}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return sessionOn;
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" }).format(parsed);
}

function isTomorrow(sessionOn: string): boolean {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const iso = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  return sessionOn === iso;
}

/**
 * Today — the first thing Home answers.
 *
 * A session that is happening leads with its time and the one button that
 * matters (open the sheet). When nothing is scheduled, that is a sentence
 * rather than an empty card, because an empty card reads as something broken.
 */
export default function TodayRail({ sessions, nextSession }: Props) {
  return (
    <section aria-labelledby="today-heading">
      <h2
        id="today-heading"
        style={{
          margin: "0 0 10px",
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: 15,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: "var(--bow-ink)",
        }}
      >
        Today
      </h2>

      {sessions.length === 0 ? (
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--bow-slate)" }}>
          {nextSession
            ? `Nothing today. Next up — ${nextSession.classTitle}, ${friendlyDate(nextSession.sessionOn)}.`
            : "Nothing scheduled today."}
        </p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {sessions.map((session) => (
            <div
              key={session.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 22,
                flexWrap: "wrap",
                background: "var(--bow-white)",
                border: "1px solid var(--border-rule)",
                borderRadius: "var(--radius-card)",
                padding: "18px 22px",
              }}
            >
              <div style={{ flex: "none", minWidth: 96 }}>
                <div
                  style={{
                    fontFamily: "var(--font-data)",
                    fontWeight: 600,
                    fontSize: 20,
                    letterSpacing: "0.02em",
                    color: "var(--bow-ink)",
                  }}
                >
                  {sessionTimeLabel(session.sessionDate, session.timezone)}
                </div>
                <div
                  style={{
                    marginTop: 3,
                    fontFamily: "var(--font-data)",
                    fontSize: 10.5,
                    letterSpacing: "0.06em",
                    color: "var(--bow-slate)",
                  }}
                >
                  {zoneAbbreviation(session.sessionDate, session.timezone)}
                </div>
              </div>

              <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                <Link
                  href={`/app/classes/${session.classId}`}
                  style={{ fontWeight: 600, fontSize: 16, color: "var(--bow-ink)", textDecoration: "none" }}
                >
                  {session.classTitle}
                </Link>
                <div style={{ marginTop: 4, fontSize: 13, lineHeight: 1.5, color: "var(--bow-slate)" }}>
                  {[
                    session.title,
                    `${session.studentCount} student${session.studentCount === 1 ? "" : "s"}`,
                    session.meetingLink ? "Online" : session.location,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 9, flexWrap: "wrap" }}>
                  {session.completed ? (
                    <Badge status="positive">Completed</Badge>
                  ) : session.prepReady ? (
                    <Badge status="positive">Prep ready</Badge>
                  ) : null}
                </div>
              </div>

              <div style={{ flex: "none" }}>
                <Button href={`/app/session/${session.id}`} variant="primary" size="sm">
                  {session.completed ? "View session sheet" : "Open session sheet"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {sessions.length > 0 && nextSession && isTomorrow(nextSession.sessionOn) ? (
        <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--bow-slate)" }}>
          Tomorrow — {nextSession.classTitle}.
        </p>
      ) : sessions.length > 0 && !nextSession ? (
        <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--bow-slate)" }}>Tomorrow — nothing scheduled.</p>
      ) : null}
    </section>
  );
}
