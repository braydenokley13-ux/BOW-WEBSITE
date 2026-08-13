import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge, Button } from "@/components/ds";
import { requireStaff } from "@/lib/dal";
import { getDb } from "@/lib/db";
import {
  allowedProgramTransitions,
  getProgram,
  getProgramFormOptions,
  listPendingProgramRegistrations,
} from "@/lib/operations";
import { directClassForProgram, getPartnerProgramRecord } from "@/lib/partner-program";
import { ROSTER_SOURCE_LABEL } from "@/lib/partner-program-shared";
import ProgramActions from "@/components/app/programs/ProgramActions";
import PublicListingPanel from "@/components/app/programs/PublicListingPanel";
import PendingRegistrations from "@/components/app/programs/PendingRegistrations";
import DuplicateProgramButton from "@/components/app/programs/DuplicateProgramButton";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await getPartnerProgramRecord(id);
  return { title: record?.name ?? "Program" };
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

const statusTone: Record<string, "positive" | "info" | "warning" | "neutral"> = {
  Running: "positive",
  "Ready to start": "info",
  "Being planned": "neutral",
  "On hold": "warning",
  "Up for renewal": "warning",
  Finished: "neutral",
};

/**
 * The partner Program record.
 *
 * This is the one place extra structure is honest: a school runs several
 * sections, on a negotiated schedule, with staffing that may not be settled.
 * So the record shows sections, schedule and staffing — in partner language,
 * not in the stage machine's.
 *
 * What it deliberately is not is the launch cockpit it replaces: no readiness
 * percentage, no progress ring, no eighteen amber rows. Only something that
 * would genuinely stop this Program running gets to look like a problem, and
 * only once somebody is actually trying to start it. Everything else that is
 * unsettled is stated as a decision nobody has made yet, because that is what
 * it is.
 *
 * The machinery that still has to exist — stage transitions, staffing offers,
 * the public listing — is real capability and is kept, one disclosure down,
 * rather than deleted or spread across five tabs.
 */
export default async function ProgramRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireStaff();
  const { id } = await params;

  // A class posted from the composer has a Program because the schema needs
  // one. Showing the operator that Program is exactly the split V1 hides.
  const directClassId = await directClassForProgram(id);
  if (directClassId) redirect(`/app/classes/${directClassId}`);

  const record = await getPartnerProgramRecord(id);
  if (!record) notFound();

  const [detail, options, pendingRegistrations, activity] = await Promise.all([
    getProgram(id),
    getProgramFormOptions(),
    listPendingProgramRegistrations(id),
    readActivity(id),
  ]);
  if (!detail) notFound();

  const settled = record.openQuestions.filter((question) => question.value !== null);
  const open = record.openQuestions.filter((question) => question.value === null);

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
        {record.partnerName ? (
          <Link href={`/app/partners/${record.partnerId}`} style={{ color: "var(--bow-slate)" }}>
            {record.partnerName}
          </Link>
        ) : (
          "No partner linked"
        )}
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
          {record.name}
        </h1>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", flex: "0 1 auto", minWidth: 0 }}>
          <Badge status={statusTone[record.statusLabel] ?? "neutral"}>{record.statusLabel}</Badge>
          {record.next ? (
            record.next.href ? (
              <Button href={record.next.href} variant="primary">
                {record.next.label}
              </Button>
            ) : (
              <Button variant="primary" disabled>
                {record.next.label}
              </Button>
            )
          ) : null}
        </div>
      </div>

      <p style={{ margin: "10px 0 0", fontSize: 15, lineHeight: 1.55, color: "var(--bow-ink)" }}>{record.statusLine}</p>
      <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--bow-slate)" }}>
        {[
          record.deliveryFormat === "online" ? "Online" : record.locationName,
          ROSTER_SOURCE_LABEL[record.rosterSource],
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>

      {/* Only things that would actually stop this running. */}
      {record.blockers.length > 0 ? (
        <section id="blocked" style={{ marginTop: 26 }}>
          <h2 style={sectionHeading}>In the way</h2>
          {record.blockers.map((blocker) => (
            <div
              key={blocker.key}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 12,
                padding: "11px 14px",
                marginBottom: 8,
                background: "var(--bow-warning-tint)",
                borderRadius: "var(--radius-control)",
                flexWrap: "wrap",
              }}
            >
              <span style={{ flex: "1 1 240px", minWidth: 0, fontSize: 13.5, color: "var(--bow-ink)" }}>
                {blocker.title}
                <span style={{ color: "var(--bow-slate)" }}> — {blocker.detail}</span>
              </span>
              {blocker.actionHref ? (
                <Link
                  href={blocker.actionHref}
                  style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.06em", color: "var(--bow-blue)" }}
                >
                  {(blocker.actionLabel ?? "Open").toUpperCase()}
                </Link>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      {/* Sections. The structure that is genuinely worth showing. */}
      <section style={{ marginTop: 30 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
          <h2 style={{ ...sectionHeading, margin: 0 }}>Sections</h2>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)" }}>
            {record.seatsTaken} ENROLLED{record.capacity ? ` OF ${record.capacity}` : ""}
          </span>
        </div>
        {record.sections.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--bow-slate)" }}>
            No sections yet. How many, and when they meet, is still being worked out with the partner.
          </p>
        ) : (
          <div style={{ border: "1px solid var(--border-rule)", borderRadius: "var(--radius-card)", background: "var(--bow-white)" }}>
            {record.sections.map((section, index) => (
              <div
                key={section.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  padding: "13px 16px",
                  borderTop: index === 0 ? "none" : "1px solid var(--border-rule)",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                  <Link href={`/app/classes/${section.id}`} style={{ fontSize: 14.5, fontWeight: 600, color: "var(--bow-ink)" }}>
                    {section.title}
                  </Link>
                  <span style={{ display: "block", marginTop: 3, fontSize: 13, color: "var(--bow-slate)" }}>
                    {[
                      section.scheduleLine,
                      section.instructorNames.length ? section.instructorNames.join(", ") : "no instructor yet",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
                <div style={{ flex: "0 1 auto", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)" }}>
                    {section.seatsTaken}
                    {section.capacity ? `/${section.capacity}` : ""} ENROLLED
                    {section.sessionsTotal ? ` · ${section.sessionsDone}/${section.sessionsTotal} RUN` : ""}
                  </span>
                  <Badge status={section.status === "active" ? "positive" : "neutral"}>{section.statusLabel}</Badge>
                  {section.nextSessionId ? (
                    <Link
                      href={`/app/session/${section.nextSessionId}`}
                      style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.06em", color: "var(--bow-blue)" }}
                    >
                      NEXT SESSION
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* What is settled, and what nobody has decided. Both stated plainly. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 30, marginTop: 30 }}>
        <section>
          <h2 style={sectionHeading}>Settled</h2>
          {settled.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--bow-slate)" }}>Nothing yet.</p>
          ) : (
            settled.map((question) => (
              <div key={question.key} style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--border-rule)" }}>
                <span
                  style={{
                    flex: "0 0 108px",
                    fontFamily: "var(--font-data)",
                    fontSize: 10.5,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--bow-slate)",
                  }}
                >
                  {question.label}
                </span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: "var(--bow-ink)" }}>
                  {question.key === "course" && record.courseId ? (
                    <Link href={`/app/curriculum/${record.courseId}`} style={{ color: "var(--bow-ink)" }}>
                      {question.value}
                    </Link>
                  ) : (
                    question.value
                  )}
                </span>
              </div>
            ))
          )}
        </section>

        <section>
          <h2 style={sectionHeading}>Still deciding</h2>
          {open.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--bow-slate)" }}>Everything is decided.</p>
          ) : (
            <>
              {open.map((question) => (
                <div key={question.key} style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--border-rule)" }}>
                  <span
                    style={{
                      flex: "0 0 108px",
                      fontFamily: "var(--font-data)",
                      fontSize: 10.5,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "var(--bow-slate)",
                    }}
                  >
                    {question.label}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: "var(--bow-slate)" }}>Not decided yet</span>
                </div>
              ))}
              <p style={{ margin: "10px 0 0", fontSize: 12.5, lineHeight: 1.55, color: "var(--bow-slate)" }}>
                Open questions are normal while a partner is scoping. None of them is a problem until somebody is trying
                to start.
              </p>
            </>
          )}
        </section>
      </div>

      {pendingRegistrations.length > 0 ? (
        <section style={{ marginTop: 30 }}>
          <h2 style={sectionHeading}>Families waiting on a decision</h2>
          <PendingRegistrations registrations={pendingRegistrations} />
        </section>
      ) : null}

      <section style={{ marginTop: 30 }}>
        <h2 style={sectionHeading}>History</h2>
        {activity.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--bow-slate)" }}>Nothing recorded yet.</p>
        ) : (
          activity.map((entry) => (
            <div key={entry.id} style={{ padding: "10px 0", borderTop: "1px solid var(--border-rule)" }}>
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: "var(--bow-ink)" }}>{entry.body}</p>
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
                {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(entry.at)}
              </span>
            </div>
          ))
        )}
      </section>

      {/* Everything that changes the Program rather than describes it. Real
          capability, kept — one disclosure away instead of five tabs. */}
      <details style={{ marginTop: 34 }}>
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
          Manage this Program
        </summary>

        <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {!record.isHistorical && record.stage !== "active" && record.stage !== "ready_to_launch" ? (
            <Button href={`/app/programs/${id}/edit`} variant="secondary" size="sm">
              Edit the plan
            </Button>
          ) : null}
          <Button href={`/app/programs/${id}/first-session`} variant="secondary" size="sm">
            First-session prep
          </Button>
          <DuplicateProgramButton programId={id} />
        </div>

        <div style={{ marginTop: 20 }}>
          <h3 style={sectionHeading}>Public listing</h3>
          <PublicListingPanel programId={id} program={detail.program} />
        </div>

        <div style={{ marginTop: 20 }}>
          <ProgramActions
            programId={id}
            programName={record.name}
            stage={detail.program.stage}
            partnerConfirmed={detail.program.partnerConfirmed}
            materialsStatus={detail.program.materialsStatus}
            renewalStatus={detail.program.renewalStatus}
            readinessCanLaunch={detail.readiness.canLaunch}
            availableTransitions={(() => {
              // Defensive only: a legacy row can carry a stage outside the
              // current enum, which would otherwise throw here.
              try {
                return allowedProgramTransitions(detail.program.stage);
              } catch {
                return [];
              }
            })()}
            classes={detail.classes.map((classRecord) => ({ id: classRecord.id, title: classRecord.title }))}
            unassignedClasses={options.unassignedClasses}
            recommendationsByClass={Object.fromEntries(
              detail.staffingByClass.map((entry) => [
                entry.classId,
                {
                  lead: entry.leadRecommendations.filter((recommendation) => recommendation.tier !== "blocked"),
                  additional: entry.additionalRecommendations.filter((recommendation) => recommendation.tier !== "blocked"),
                },
              ]),
            )}
            assignedInstructors={detail.instructors.map((instructor) => ({
              instructorId: instructor.id,
              name: instructor.name,
              role: instructor.role,
              classId: instructor.classId,
              classTitle: detail.classes.find((classRecord) => classRecord.id === instructor.classId)?.title ?? "Section",
            }))}
            canApproveLaunchException={me.role === "admin"}
          />
        </div>
      </details>
    </div>
  );
}

/** The Program's own history, from the one activity table. */
async function readActivity(programId: string): Promise<{ id: string; body: string; at: number }[]> {
  const rows = (await getDb()
    .prepare(
      `SELECT id, body, created_at FROM crm_activity
        WHERE entity_type = 'program' AND entity_id = ?
        ORDER BY created_at DESC
        LIMIT 20`,
    )
    .all(programId)) as { id: string; body: string | null; created_at: number }[];
  return rows.map((row) => ({ id: row.id, body: row.body ?? "", at: Number(row.created_at) }));
}

