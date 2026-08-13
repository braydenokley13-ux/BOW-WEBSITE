import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ds";
import { requireUser } from "@/lib/dal";
import { getInstructorByUserId } from "@/lib/hiring";
import { isAcceptedClassMember } from "@/lib/delivery";
import { getSessionSheet, type SheetViewer } from "@/lib/session-sheet";
import { resolveSheetPhase } from "@/lib/session-sheet-shared";
import { RESOURCE_KIND_LABEL } from "@/lib/curriculum-resources-shared";
import { formatDateTimeInZone } from "@/lib/timezone";
import AttendanceSheet from "@/components/app/session/AttendanceSheet";
import SessionPlanForm from "@/components/app/classes/SessionPlanForm";
import SessionPrepForm from "@/components/app/teach/SessionPrepForm";
import { getMySessionPrep } from "@/app/actions/delivery";

export const metadata = { title: "Session" };

/**
 * The Session Sheet — the canonical address for one session, for whoever is
 * about to teach it.
 *
 * Written for a phone opened five minutes before class: where to be, what to
 * teach, who is in the room, and the one button that ends it. Anything an
 * instructor does not need in that moment — CRM, partner history, guardian
 * contacts, admin controls — is not on this page at all, rather than hidden
 * behind a role check that a future refactor could lose.
 *
 * Authorization is a real boundary, not decoration: staff may read any
 * session, an instructor only a class they have actually accepted, and
 * everyone else gets a 404 rather than a "forbidden" that would confirm the
 * session exists.
 */
export default async function SessionSheetPage({ params }: { params: Promise<{ sid: string }> }) {
  const me = await requireUser();
  const { sid } = await params;

  let viewer: SheetViewer;
  if (me.role === "admin" || me.role === "growth") {
    viewer = { kind: "staff" };
  } else if (me.role === "instructor") {
    const instructor = await getInstructorByUserId(me.id);
    if (!instructor || instructor.stage === "inactive" || instructor.stage === "rejected") notFound();
    viewer = { kind: "instructor", instructorId: instructor.id };
  } else {
    notFound();
  }

  const sheet = await getSessionSheet(sid, viewer);
  if (!sheet) notFound();
  if (viewer.kind === "instructor" && !(await isAcceptedClassMember(sheet.classId, viewer.instructorId))) {
    notFound();
  }

  const prep = viewer.kind === "instructor" ? await getMySessionPrep(sid) : null;

  const phase = resolveSheetPhase({
    startsAt: sheet.startsAt,
    endsAt: sheet.endsAt,
    status: sheet.status,
    finalized: sheet.finalized,
    now: sheet.now,
  });

  const when = formatDateTimeInZone(sheet.startsAt, sheet.timezone);
  const whenLead =
    phase === "live"
      ? "Happening now"
      : phase === "soon"
        ? `Starts ${new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: sheet.timezone }).format(sheet.startsAt)}`
        : when;

  return (
    <div style={{ maxWidth: 640 }}>
      <Link
        href={sheet.backHref}
        style={{
          display: "inline-block",
          marginBottom: 14,
          fontFamily: "var(--font-data)",
          fontSize: 11,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--bow-slate)",
        }}
      >
        ← {sheet.classTitle}
      </Link>

      <p
        style={{
          margin: 0,
          fontFamily: "var(--font-data)",
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--bow-slate)",
        }}
      >
        {sheet.partnerName ? `${sheet.partnerName} · ` : ""}
        Session {sheet.index} of {sheet.total}
      </p>

      <h1
        style={{
          margin: "8px 0 0",
          fontFamily: "var(--font-interface)",
          fontWeight: 600,
          fontSize: "clamp(21px, 3vw, 26px)",
          lineHeight: 1.25,
          color: "var(--bow-ink)",
        }}
      >
        {whenLead}
      </h1>
      <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--bow-slate)" }}>
        {phase === "live" || phase === "soon" ? when : sheet.classTitle}
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        {sheet.status === "cancelled" ? <Badge status="negative">Cancelled</Badge> : null}
        {sheet.finalized ? <Badge status="positive">Complete</Badge> : null}
        {sheet.flagged && !sheet.finalized ? <Badge status="warning">Flagged</Badge> : null}
        {sheet.coInstructors.length ? (
          <Badge status="neutral">With {sheet.coInstructors.join(", ")}</Badge>
        ) : null}
      </div>

      {/* Where. The one thing that is useless thirty seconds late. */}
      <section style={{ marginTop: 22 }}>
        {sheet.meetingLink ? (
          <a
            className="bow-button bow-button-primary bow-button-md bow-button-full"
            href={sheet.meetingLink}
            target="_blank"
            rel="noreferrer noopener"
          >
            Join the meeting
          </a>
        ) : (
          <p style={{ margin: 0, fontSize: 15, color: "var(--bow-ink)" }}>
            {sheet.location ?? "No location set for this session."}
          </p>
        )}
        {sheet.meetingLink && sheet.location ? (
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--bow-slate)" }}>{sheet.location}</p>
        ) : null}
      </section>

      {/* What you are teaching. */}
      <section style={{ marginTop: 26 }}>
        <h2
          style={{
            margin: "0 0 8px",
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--bow-ink)",
          }}
        >
          What you are teaching
        </h2>
        {sheet.lesson ? (
          <>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.4, color: "var(--bow-ink)" }}>{sheet.lesson.title}</p>
            <p style={{ margin: "5px 0 0", fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)" }}>
              {[
                sheet.lesson.position && sheet.lesson.total
                  ? `Lesson ${sheet.lesson.position} of ${sheet.lesson.total}`
                  : null,
                sheet.lesson.estMinutes ? `${sheet.lesson.estMinutes} min` : null,
                sheet.lesson.historical ? "Recorded when this session was completed" : null,
                !sheet.lesson.historical && !sheet.lesson.published ? "Draft — not published yet" : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {sheet.lesson.href ? (
              <Link
                href={sheet.lesson.href}
                style={{
                  display: "inline-block",
                  marginTop: 8,
                  fontFamily: "var(--font-data)",
                  fontSize: 10.5,
                  letterSpacing: "0.06em",
                  color: "var(--bow-blue)",
                }}
              >
                OPEN THE COURSE
              </Link>
            ) : null}
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "var(--bow-slate)" }}>
            No lesson is attached to this session.
            {sheet.objective ? "" : " Whoever runs it plans it."}
          </p>
        )}
        {/* Materials. The single most repetitive thing an instructor does
            before a class is hunt for the Slides; this is the whole point of
            attaching them to the course once. Every link opens in a new tab so
            the sheet — and the attendance about to be taken on it — survives. */}
        {sheet.lesson?.resources.length ? (
          <div className="bow-materials">
            {sheet.lesson.resources.map((resource) => (
              <a
                key={resource.id}
                className="bow-materials__item"
                href={resource.url}
                target="_blank"
                rel="noreferrer noopener"
              >
                <span className="bow-materials__kind">{RESOURCE_KIND_LABEL[resource.kind]}</span>
                <span className="bow-materials__label">{resource.label}</span>
              </a>
            ))}
          </div>
        ) : null}

        {sheet.lesson?.teachingNote ? (
          <p style={{ margin: "12px 0 0", fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap", color: "var(--bow-ink)" }}>
            {sheet.lesson.teachingNote}
          </p>
        ) : null}

        {sheet.objective ? (
          <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.55, color: "var(--bow-ink)" }}>
            {sheet.objective}
          </p>
        ) : null}
        {sheet.agenda ? (
          <p style={{ margin: "8px 0 0", fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap", color: "var(--bow-slate)" }}>
            {sheet.agenda}
          </p>
        ) : null}
        {sheet.materials ? (
          <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", color: "var(--bow-slate)" }}>
            Bring: {sheet.materials}
          </p>
        ) : null}
      </section>

      <div style={{ marginTop: 26 }}>
        <AttendanceSheet
          key={sheet.roster.map((student) => student.studentId).join(",")}
          sessionId={sheet.sessionId}
          roster={sheet.roster}
          lock={sheet.attendance}
          notes={sheet.notes}
          flagged={sheet.flagged}
          flagReason={sheet.flagReason}
          finalized={sheet.finalized}
          reportedAt={sheet.reportedAt}
        />
      </div>

      {/* The instructor's own preparation. Before the session, not during it —
          which is why it sits under the sheet rather than above the roster. */}
      {sheet.viewer === "instructor" && !sheet.finalized && sheet.status === "scheduled" ? (
        <details style={{ marginTop: 4 }}>
          <summary
            style={{
              cursor: "pointer",
              fontFamily: "var(--font-data)",
              fontSize: 11,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--bow-slate)",
            }}
          >
            My preparation
          </summary>
          <div style={{ marginTop: 14 }}>
            <SessionPrepForm
              sessionId={sheet.sessionId}
              initialChecklist={prep?.checklist ?? []}
              initialBlockers={prep?.blockers ?? ""}
              initialStatus={prep?.status ?? "not_started"}
            />
          </div>
        </details>
      ) : null}

      {/* Staff-only: editing the plan is an office job, not a courtside one. */}
      {sheet.viewer === "staff" && sheet.status === "scheduled" && !sheet.finalized ? (
        <details style={{ marginTop: 4 }}>
          <summary
            style={{
              cursor: "pointer",
              fontFamily: "var(--font-data)",
              fontSize: 11,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--bow-slate)",
            }}
          >
            Edit session details
          </summary>
          <div style={{ marginTop: 14 }}>
            <SessionPlanForm
              sessionId={sheet.sessionId}
              status={sheet.status}
              plan={{
                title: sheet.title ?? "",
                objective: sheet.objective ?? "",
                agenda: sheet.agenda ?? "",
                materials: sheet.materials ?? "",
                meetingLink: sheet.meetingLink ?? "",
                location: sheet.location ?? "",
              }}
            />
          </div>
        </details>
      ) : null}
    </div>
  );
}
