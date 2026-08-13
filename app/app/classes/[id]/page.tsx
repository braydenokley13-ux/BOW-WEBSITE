import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/dal";
import { Badge, Button, FactRow } from "@/components/ds";
import { getClassRecord } from "@/lib/class-record";
import { classFactLine, seatLabel } from "@/lib/class-record-shared";
import ShareClassLink from "@/components/app/classes/ShareClassLink";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await getClassRecord(id);
  return { title: record?.title ?? "Class" };
}

const sectionHeading: React.CSSProperties = {
  margin: "0 0 10px",
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: 14,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--bow-ink)",
};

function shortDate(sessionOn: string): string {
  const parsed = new Date(`${sessionOn}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return sessionOn;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(parsed).toUpperCase();
}

/**
 * The direct class record — one operational page, no tabs.
 *
 * Stacked in the order the work happens: what to do next, how full it is, the
 * run, who is in it, what families have been told, what it teaches, and the
 * settings. To the operator this is "your class"; the Program underneath it is
 * never named.
 *
 * The exceptions listed here are the same records HQ Home's queue holds, so
 * resolving one in either place resolves it in both.
 */
export default async function ClassRecordPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const record = await getClassRecord(id);
  if (!record) notFound();
  const now = record.now;

  const publicUrl = record.publicSlug
    ? `${(process.env.NEXT_PUBLIC_SITE_URL ?? "https://bowsportscapital.com").replace(/\/+$/, "")}/programs/p/${record.publicSlug}`
    : null;

  const upcoming = record.run.filter((s) => s.status === "scheduled");
  const shownRun = record.run.slice(0, 6);
  const hiddenRun = record.run.length - shownRun.length;

  return (
    <div style={{ maxWidth: 1000 }}>
      <p
        style={{
          margin: 0,
          fontFamily: "var(--font-data)",
          fontSize: 10.5,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--bow-slate)",
        }}
      >
        {record.partnerName ? `${record.partnerName} · Section` : "Your class"}
      </p>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 18, flexWrap: "wrap", margin: "10px 0 6px" }}>
        <h1
          style={{
            margin: 0,
            flex: "1 1 320px",
            minWidth: 0,
            fontFamily: "var(--font-editorial)",
            fontWeight: 600,
            fontSize: "clamp(24px, 3.4vw, 32px)",
            lineHeight: 1.15,
            color: "var(--bow-ink)",
          }}
        >
          {record.title}
        </h1>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flex: "none" }}>
          {record.primary.href ? (
            <Button href={record.primary.href} variant="primary">
              {record.primary.label}
            </Button>
          ) : (
            <Button variant="primary" disabled>
              {record.primary.label}
            </Button>
          )}
        </div>
      </div>

      {/* Seats — the fact the founder checks first. */}
      <p style={{ margin: "14px 0 4px", fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.05em", color: "var(--bow-ink)" }}>
        <strong style={{ fontWeight: 600 }}>{record.confirmed} CONFIRMED</strong>
        {record.waitlisted > 0 ? ` · ${record.waitlisted} WAITLIST` : ""}
        {record.seatsRemaining !== null
          ? ` · ${record.seatsRemaining} SEAT${record.seatsRemaining === 1 ? "" : "S"} LEFT OF ${record.capacity}`
          : ""}
      </p>
      <p style={{ margin: 0, fontSize: 13, color: "var(--bow-slate)" }}>
        {classFactLine(record)}
        {record.instructorNames.length ? ` · ${record.instructorNames.join(", ")} teaches it` : " · no instructor yet"}
      </p>

      {publicUrl ? <ShareClassLink url={publicUrl} /> : null}

      {/* Anything blocking, in place — same records as Home's queue. */}
      {record.exceptions.length > 0 ? (
        <section id="needs-attention" style={{ marginTop: 26 }}>
          <h2 style={sectionHeading}>Needs attention</h2>
          {record.exceptions.map((exception) => (
            <div
              key={exception.key}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                padding: "11px 14px",
                marginBottom: 8,
                background: "var(--bow-warning-tint)",
                borderRadius: "var(--radius-control)",
              }}
            >
              <span style={{ flex: "1 1 auto", fontSize: 13.5, color: "var(--bow-ink)" }}>
                {exception.title}
                <span style={{ color: "var(--bow-slate)" }}> — {exception.detail}</span>
              </span>
            </div>
          ))}
        </section>
      ) : null}

      {/* The run */}
      <section style={{ marginTop: 30 }}>
        <h2 style={sectionHeading}>The run</h2>
        <div style={{ border: "1px solid var(--border-rule)", borderRadius: "var(--radius-card)", background: "var(--bow-white)" }}>
          {shownRun.map((session, index) => {
            const isNext = session.id === record.nextSessionId;
            return (
              <div
                key={session.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "12px 18px",
                  borderTop: index === 0 ? "none" : "1px solid var(--border-rule)",
                  flexWrap: "wrap",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    flex: "none",
                    boxSizing: "border-box",
                    background: session.completed ? "var(--bow-positive)" : isNext ? "var(--bow-blue)" : "transparent",
                    border: session.completed || isNext ? "none" : "1.5px solid var(--bow-border)",
                  }}
                />
                <span style={{ fontFamily: "var(--font-data)", fontSize: 12, minWidth: 62, color: "var(--bow-ink)" }}>
                  {shortDate(session.sessionOn)}
                </span>
                <span style={{ flex: "1 1 200px", minWidth: 0, fontSize: 13.5, color: "var(--bow-ink)" }}>
                  {session.title ?? `Session ${session.index}`}
                </span>
                {session.completed ? <Badge status="positive">Done</Badge> : null}
                {session.flagged ? <Badge status="warning">Flagged</Badge> : null}
                {isNext ? (
                  <Button href={`/app/session/${session.id}`} variant="secondary" size="sm">
                    Open sheet
                  </Button>
                ) : (
                  <Link
                    href={`/app/session/${session.id}`}
                    style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.06em", color: "var(--bow-blue)" }}
                  >
                    OPEN
                  </Link>
                )}
              </div>
            );
          })}
          {record.run.length === 0 ? (
            <p style={{ margin: 0, padding: "16px 18px", fontSize: 13.5, color: "var(--bow-slate)" }}>
              No sessions scheduled yet.
            </p>
          ) : null}
        </div>
        {hiddenRun > 0 ? (
          <p style={{ margin: "9px 0 0", fontSize: 12.5, color: "var(--bow-slate)" }}>
            + {hiddenRun} more · {upcoming.length} still to run
          </p>
        ) : null}
      </section>

      {/* Roster */}
      <section id="roster" style={{ marginTop: 30 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ ...sectionHeading, margin: 0 }}>Roster</h2>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)" }}>
            {record.confirmed} CONFIRMED{record.waitlisted ? ` · ${record.waitlisted} WAITLIST` : ""}
          </span>
        </div>
        <div style={{ marginTop: 10, overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 520, borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Student", "Grade", "Guardian", "Status"].map((head) => (
                  <th
                    key={head}
                    style={{
                      textAlign: "left",
                      padding: "0 12px 8px 0",
                      fontFamily: "var(--font-data)",
                      fontSize: 10,
                      letterSpacing: "0.07em",
                      textTransform: "uppercase",
                      color: "var(--bow-slate)",
                      fontWeight: 500,
                    }}
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {record.roster.map((entry) => {
                const seat = seatLabel(entry.registrationStatus, entry.offerExpiresAt, now);
                return (
                  <tr key={entry.studentId} style={{ borderTop: "1px solid var(--border-rule)" }}>
                    <td style={{ padding: "11px 12px 11px 0", fontSize: 13.5, color: "var(--bow-ink)" }}>{entry.name}</td>
                    <td style={{ padding: "11px 12px 11px 0", fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)" }}>
                      {entry.grade ?? "—"}
                    </td>
                    <td style={{ padding: "11px 12px 11px 0", fontSize: 13, color: "var(--bow-slate)" }}>
                      {entry.guardianName ?? "—"}
                    </td>
                    <td style={{ padding: "11px 0" }}>
                      <Badge status={seat.tone}>{seat.label}</Badge>
                      {entry.needsIdentityReview ? (
                        <span style={{ marginLeft: 6 }}>
                          <Badge status="warning">Needs review</Badge>
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {record.roster.length === 0 ? (
            <p style={{ margin: "12px 0 0", fontSize: 13.5, color: "var(--bow-slate)" }}>
              Nobody has registered yet. {publicUrl ? "Share the link above and they will appear here." : ""}
            </p>
          ) : null}
        </div>
      </section>

      {/* Messages to families */}
      <section style={{ marginTop: 30 }}>
        <h2 style={sectionHeading}>Messages to families</h2>
        {record.messages.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--bow-slate)" }}>
            Nothing sent yet. Reminders and confirmations go out on their own.
          </p>
        ) : (
          record.messages.map((message) => (
            <div key={message.id} style={{ padding: "11px 0", borderTop: "1px solid var(--border-rule)" }}>
              <span style={{ fontSize: 13.5, color: "var(--bow-ink)" }}>{message.title}</span>
              <span
                style={{
                  display: "block",
                  marginTop: 3,
                  fontFamily: "var(--font-data)",
                  fontSize: 10.5,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--bow-slate)",
                }}
              >
                {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(message.sentAt)} ·{" "}
                {message.delivered}/{message.recipients} families
              </span>
            </div>
          ))
        )}
      </section>

      {/* Curriculum + settings */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 30, marginTop: 30 }}>
        <section>
          <h2 style={sectionHeading}>Curriculum</h2>
          {record.courseTitle ? (
            <>
              <p style={{ margin: 0, fontSize: 14, color: "var(--bow-ink)" }}>{record.courseTitle}</p>
              <Link
                href={record.courseId ? `/app/curriculum/${record.courseId}` : "/app/curriculum"}
                style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.06em", color: "var(--bow-blue)" }}
              >
                VIEW COURSE
              </Link>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--bow-slate)" }}>
              No course attached — sessions are planned by hand.
            </p>
          )}
        </section>

        <section>
          <h2 style={sectionHeading}>Settings</h2>
          <FactRow label="Visibility" value={record.isPublic ? "Public listing" : "Not listed"} />
          <FactRow
            label="Seats"
            value={record.capacity ? `${record.capacity} · waitlist auto` : null}
            undecidedLabel="No limit set"
            mono
          />
          <FactRow label="Price" value="Free" />
          <FactRow
            label="Instructor"
            value={record.instructorNames.length ? record.instructorNames.join(", ") : null}
            undecidedLabel="Not assigned yet"
          />
        </section>
      </div>
    </div>
  );
}
