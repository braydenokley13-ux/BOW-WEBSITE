import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Button, DataStrip, PageSection, RecordShell } from "@/components/ds";
import ProgramActions from "@/components/app/programs/ProgramActions";
import { requireStaff } from "@/lib/dal";
import { getDb } from "@/lib/db";
import {
  allowedProgramTransitions,
  dayLabel,
  formatLabel,
  getProgram,
  getProgramFormOptions,
  programStageLabel,
  type ProgramDetail,
} from "@/lib/operations";
import { formatDateTimeInZone } from "@/lib/timezone";

type TabKey = "overview" | "classes" | "people" | "schedule" | "activity";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "classes", label: "Classes" },
  { key: "people", label: "People" },
  { key: "schedule", label: "Schedule" },
  { key: "activity", label: "Activity" },
];

function stageTone(stage: string): "positive" | "warning" | "negative" | "info" | "neutral" | "locked" {
  if (stage === "active" || stage === "renewed") return "positive";
  if (stage === "ready_to_launch" || stage === "partner_confirmed") return "info";
  if (stage === "paused" || stage === "closed") return "negative";
  if (["staffing", "enrollment", "recruiting", "renewal_review"].includes(stage)) return "warning";
  if (stage === "completed") return "locked";
  return "neutral";
}

export default async function ProgramDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const me = await requireStaff();
  const { id } = await params;
  const { tab } = await searchParams;
  const detail = await getProgram(id);
  if (!detail) notFound();
  const options = await getProgramFormOptions();
  const program = detail.program;

  const isActive = program.stage === "active";
  const isHistorical = ["completed", "renewal_review", "renewed", "closed"].includes(program.stage);
  const planLocked = isHistorical || program.stage === "ready_to_launch" || program.stage === "active";
  const showReadiness = !isActive && !isHistorical;

  const activeTab: TabKey = TABS.some((t) => t.key === tab) ? (tab as TabKey) : "overview";

  // Cross-links: instructors/students on a Program record are people —
  // resolve instructors.id/students.id -> people.id in one batch read so
  // each row can link straight to the canonical person record instead of
  // bouncing through the legacy /app/instructors or /app/students routes.
  const db = getDb();
  const instructorIds = detail.instructors.map((i) => i.id);
  const studentIds = detail.students.map((s) => s.id);
  const instructorPersonMap = new Map<string, string>();
  const studentPersonMap = new Map<string, string>();
  if (instructorIds.length > 0) {
    const rows = (await db.prepare(
      `SELECT id, person_id FROM instructors WHERE id = ANY(?)`,
    ).all(instructorIds)) as Array<{ id: string; person_id: string | null }>;
    for (const row of rows) if (row.person_id) instructorPersonMap.set(row.id, row.person_id);
  }
  if (studentIds.length > 0) {
    const rows = (await db.prepare(
      `SELECT id, person_id FROM students WHERE id = ANY(?)`,
    ).all(studentIds)) as Array<{ id: string; person_id: string | null }>;
    for (const row of rows) if (row.person_id) studentPersonMap.set(row.id, row.person_id);
  }

  const contextLine = [
    detail.partner?.name ?? "No partner linked",
    detail.location?.name ?? (program.deliveryFormat === "online" ? "Online" : "No location linked"),
    detail.curriculum?.title ?? "No curriculum selected",
    detail.ownerName ?? "Unassigned owner",
  ].join(" · ");

  return (
    <RecordShell
      eyebrow="Programs · Delivery spine"
      title={program.name}
      subtitle={contextLine}
      status={
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Badge status={stageTone(program.stage)}>{programStageLabel(program.stage)}</Badge>
          {showReadiness && (
            <Badge status={detail.readiness.canLaunch ? "positive" : "negative"}>
              {detail.readiness.canLaunch ? "Launch ready" : `${detail.readiness.blockers.length} blocker${detail.readiness.blockers.length === 1 ? "" : "s"}`}
            </Badge>
          )}
          {program.launchExceptionReason && <Badge status="warning">Launch exception approved</Badge>}
        </div>
      }
      actions={
        <div className="ops-actions" style={{ margin: 0 }}>
          <Button href="/app/programs" variant="secondary">All Programs</Button>
          {!planLocked && <Button href={`/app/programs/${id}/edit`} variant="emphasis">Edit Program Plan</Button>}
        </div>
      }
    >
      <nav aria-label="Program record sections" style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border-rule)", marginBottom: 4, flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "overview" ? `/app/programs/${id}` : `/app/programs/${id}?tab=${t.key}`}
            aria-current={activeTab === t.key ? "page" : undefined}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 14px",
              fontFamily: "var(--font-interface)",
              fontSize: 13,
              fontWeight: 600,
              color: activeTab === t.key ? "var(--bow-ink)" : "var(--bow-slate)",
              borderBottom: activeTab === t.key ? "2px solid var(--bow-blue)" : "2px solid transparent",
              marginBottom: -1,
              textDecoration: "none",
            }}
          >
            {t.label}
            {t.key === "classes" && detail.classes.length > 0 && <span className="ops-record-meta">{detail.classes.length}</span>}
          </Link>
        ))}
      </nav>

      {activeTab === "overview" && (
        <OverviewTab
          me={me}
          detail={detail}
          isActive={isActive}
          isHistorical={isHistorical}
          showReadiness={showReadiness}
        />
      )}
      {activeTab === "classes" && <ClassesTab detail={detail} program={program} />}
      {activeTab === "people" && (
        <PeopleTab
          detail={detail}
          instructorPersonMap={instructorPersonMap}
          studentPersonMap={studentPersonMap}
        />
      )}
      {activeTab === "schedule" && <ScheduleTab detail={detail} />}
      {activeTab === "activity" && <ActivityTab detail={detail} />}

      {/* Actions live on every tab (bottom of page) so a mutation is always
          one scroll away regardless of which tab surfaced the need for it. */}
      <PageSection title="Actions">
        <ProgramActions
          programId={id}
          programName={program.name}
          stage={program.stage}
          partnerConfirmed={program.partnerConfirmed}
          materialsStatus={program.materialsStatus}
          renewalStatus={program.renewalStatus}
          readinessCanLaunch={detail.readiness.canLaunch}
          availableTransitions={(() => {
            // Defensive guard only, no business-logic change: some seeded/legacy
            // rows carry a stage value outside the current PROGRAM_STAGES enum
            // (e.g. QA seed data predating a lifecycle vocabulary change), which
            // would otherwise throw inside allowedProgramTransitions.
            try {
              return allowedProgramTransitions(program.stage);
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
            classTitle: detail.classes.find((classRecord) => classRecord.id === instructor.classId)?.title ?? "Delivery Class",
          }))}
          canApproveLaunchException={me.role === "admin"}
        />
      </PageSection>
    </RecordShell>
  );
}

/* ---------------------------------------------------------------------- */
/* Overview — decision-first: status, unresolved items, quick facts,       */
/* lineage, top actions. Not a data dump.                                 */
/* ---------------------------------------------------------------------- */

function OverviewTab({
  me,
  detail,
  isActive,
  isHistorical,
  showReadiness,
}: {
  me: { role: string };
  detail: ProgramDetail;
  isActive: boolean;
  isHistorical: boolean;
  showReadiness: boolean;
}) {
  const program = detail.program;
  const firstBlocker = detail.readiness.blockers[0];
  const nextAction = detail.readiness.nextAction;

  const dataStripItems = [
    { label: "Classes", value: String(detail.classes.length) },
    { label: "Instructors", value: String(detail.instructorCount) },
    { label: "Enrolled", value: String(detail.enrollmentCount) },
    { label: "Start date", value: program.startDate ?? program.launchDate ?? "Not set" },
  ];

  return (
    <div style={{ display: "grid", gap: 4 }}>
      {detail.originatingInquiry && (
        <PageSection title="Originating demand" noRule>
          <p className="ops-body">
            {detail.originatingInquiry.type} from {detail.originatingInquiry.organizationName} · submitted {detail.originatingInquiry.submittedLabel}
          </p>
          <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
            {detail.partner && (
              <Link className="ops-inline-link" href={`/app/partners/${detail.partner.id}#inquiry-${detail.originatingInquiry.id}`}>Open Partner Intake →</Link>
            )}
            {me.role === "admin" && (
              <Link className="ops-inline-link" href={`/app/admin/inquiries#inquiry-${detail.originatingInquiry.id}`}>Open Demand Inbox →</Link>
            )}
          </div>
        </PageSection>
      )}

      <PageSection title="Status" noRule={!detail.originatingInquiry}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <Badge status={stageTone(program.stage)}>{programStageLabel(program.stage)}</Badge>
          {showReadiness && (
            <Badge status={detail.readiness.canLaunch ? "positive" : "negative"}>{detail.readiness.percent}% ready</Badge>
          )}
          {isActive && <Badge status="positive">Delivery in progress</Badge>}
          {isHistorical && (
            <Badge status={program.renewalStatus === "renewed" || program.renewalStatus === "expanded" ? "positive" : "warning"}>
              Renewal {program.renewalStatus.replace(/_/g, " ")}
            </Badge>
          )}
        </div>
        {showReadiness && firstBlocker ? (
          <div className="ops-alert" data-tone="negative">
            <span className="ops-alert__title">Primary blocker</span>
            <p className="ops-body" style={{ marginTop: 5 }}>{firstBlocker.detail}</p>
            {firstBlocker.actionHref && firstBlocker.actionLabel && (
              <Link className="ops-inline-link" href={firstBlocker.actionHref} style={{ display: "inline-block", marginTop: 9 }}>{firstBlocker.actionLabel} →</Link>
            )}
          </div>
        ) : showReadiness ? (
          <p className="ops-body">The required launch conditions are in place. Leadership can authorize delivery with confidence.</p>
        ) : isHistorical ? (
          <p className="ops-body">{program.outcomeSummary ?? `Delivery is ${program.stage.replace(/_/g, " ")}. Preserve the evidence and make the renewal decision explicit.`}</p>
        ) : (
          <p className="ops-body">{`${detail.enrollmentCount} students are being served across ${detail.classes.length} class${detail.classes.length === 1 ? "" : "es"}.`}</p>
        )}
        {nextAction && (
          <p className="ops-body" style={{ marginTop: 8 }}><strong>{nextAction.owner}</strong> should {nextAction.label.toLowerCase()} next.</p>
        )}
      </PageSection>

      <PageSection title="Quick facts">
        <DataStrip items={dataStripItems} />
      </PageSection>

      {showReadiness && (
        <PageSection title="What's unresolved">
          {detail.readiness.blockers.length === 0 && detail.readiness.warnings.length === 0 ? (
            <p className="ops-body">Nothing is unresolved. Every launch condition is satisfied.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {detail.readiness.blockers.map((blocker, index) => (
                <div className="ops-alert" data-tone="negative" key={`blocker-${index}`}>
                  <span className="ops-alert__title">Blocker</span>
                  <p className="ops-body" style={{ marginTop: 5 }}>{blocker.detail}</p>
                  {blocker.actionHref && blocker.actionLabel && (
                    <Link className="ops-inline-link" href={blocker.actionHref} style={{ display: "inline-block", marginTop: 9 }}>{blocker.actionLabel} →</Link>
                  )}
                </div>
              ))}
              {detail.readiness.warnings.map((warning, index) => (
                <div className="ops-alert" data-tone="warning" key={`warning-${index}`}>
                  <span className="ops-alert__title">Warning</span>
                  <p className="ops-body" style={{ marginTop: 5 }}>{warning.detail}</p>
                  {warning.actionHref && warning.actionLabel && (
                    <Link className="ops-inline-link" href={warning.actionHref} style={{ display: "inline-block", marginTop: 9 }}>{warning.actionLabel} →</Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </PageSection>
      )}

      <PageSection title="Program plan">
        <div className="ops-meta-grid">
          <div className="ops-meta"><span className="ops-label">Partner</span><span className="ops-value">{detail.partner ? <Link href={`/app/partners/${detail.partner.id}`} style={{ color: "var(--bow-blue)" }}>{detail.partner.name}</Link> : "Not linked"}</span></div>
          <div className="ops-meta"><span className="ops-label">Location</span><span className="ops-value">{detail.location ? <Link href={`/app/locations/${detail.location.id}`} style={{ color: "var(--bow-blue)" }}>{detail.location.name}</Link> : program.deliveryFormat === "online" ? "Online" : "Not linked"}</span></div>
          <div className="ops-meta"><span className="ops-label">Primary contact</span><span className="ops-value">{detail.primaryContact?.name ?? "Not linked"}</span></div>
          <div className="ops-meta"><span className="ops-label">BOW owner</span><span className="ops-value">{detail.ownerName ?? "Unassigned"}</span></div>
          <div className="ops-meta"><span className="ops-label">Curriculum</span><span className="ops-value">{detail.curriculum ? <Link href={`/app/curriculum/${detail.curriculum.id}`} style={{ color: "var(--bow-blue)" }}>{detail.curriculum.title}</Link> : "Not selected"}</span></div>
          <div className="ops-meta"><span className="ops-label">Format</span><span className="ops-value">{formatLabel(program.deliveryFormat)}</span></div>
          <div className="ops-meta"><span className="ops-label">Schedule</span><span className="ops-value">{program.scheduleLabel ?? `${dayLabel(program.scheduleDay)} ${program.scheduleStartTime ?? ""}–${program.scheduleEndTime ?? ""}`}</span></div>
          <div className="ops-meta"><span className="ops-label">Dates</span><span className="ops-value">{program.startDate ?? "—"} → {program.endDate ?? "—"}</span></div>
        </div>
        {program.notes && <p className="ops-body" style={{ marginTop: 18, whiteSpace: "pre-wrap" }}>{program.notes}</p>}
      </PageSection>

      {detail.relatedPrograms.length > 0 && (
        <PageSection title="Renewal & expansion lineage">
          <div style={{ display: "grid", gap: 8 }}>
            {detail.relatedPrograms.map((related) => (
              <div className="ops-meta" key={related.id}>
                <span className="ops-label">{related.relationship.replace(/_/g, " ")}</span>
                <Link className="ops-value" href={`/app/programs/${related.id}`} style={{ color: "var(--bow-blue)" }}>{related.name}</Link>
                <span className="ops-record-meta">{programStageLabel(related.stage)}</span>
              </div>
            ))}
          </div>
        </PageSection>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Classes                                                                 */
/* ---------------------------------------------------------------------- */

function ClassesTab({ detail, program }: { detail: ProgramDetail; program: ProgramDetail["program"] }) {
  return (
    <PageSection title="Classes" noRule>
      {detail.classes.length === 0 ? (
        <div className="ops-empty">
          <h3 className="ops-empty__title">No delivery Class exists.</h3>
          <p className="ops-empty__body">Create or connect a Class so staffing, enrollment, sessions, attendance, and reporting can begin. Use the Actions panel below to create or attach one.</p>
        </div>
      ) : (
        <div className="ops-list">
          {detail.classes.map((classRecord) => {
            const sessions = detail.sessions.filter((session) => session.classId === classRecord.id);
            const instructors = detail.instructors.filter((instructor) => instructor.classId === classRecord.id);
            const students = detail.students.filter((student) => student.classId === classRecord.id);
            return (
              <article className="ops-list-row" key={classRecord.id}>
                <div>
                  <Link className="ops-record-name" href={`/app/classes/${classRecord.id}`}>{classRecord.title}</Link>
                  <span className="ops-record-meta">{classRecord.location ?? detail.location?.name ?? formatLabel(program.deliveryFormat)}</span>
                </div>
                <Badge status={stageTone(classRecord.status)}>{programStageLabel(classRecord.status)}</Badge>
                <div><span className="ops-label">Staffing</span><span className="ops-value">{instructors.length} instructor{instructors.length === 1 ? "" : "s"}</span></div>
                <div>
                  <span className="ops-label">Delivery state</span>
                  <span className="ops-value">{students.length} enrolled · {sessions.length} session{sessions.length === 1 ? "" : "s"}</span>
                  <span className="ops-record-meta">{sessions[0] ? `First ${formatDateTimeInZone(sessions[0].sessionDate, sessions[0].scheduleTimezone)}` : "First session not scheduled"}</span>
                </div>
                <Button href={`/app/classes/${classRecord.id}`} variant="secondary" size="sm">Open Class</Button>
              </article>
            );
          })}
        </div>
      )}
      <p className="ops-section-note" style={{ marginTop: 14 }}>Create or connect a class from the Actions panel at the bottom of this record.</p>
      <div style={{ marginTop: 8 }}>
        <Link href={`#actions`} className="ops-inline-link">Go to Actions →</Link>
      </div>
    </PageSection>
  );
}

/* ---------------------------------------------------------------------- */
/* People — instructors + students, cross-linked to the person record,    */
/* plus staffing recommendations by class.                                */
/* ---------------------------------------------------------------------- */

function PeopleTab({
  detail,
  instructorPersonMap,
  studentPersonMap,
}: {
  detail: ProgramDetail;
  instructorPersonMap: Map<string, string>;
  studentPersonMap: Map<string, string>;
}) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <PageSection title="Instructors" noRule>
        {detail.instructors.length === 0 ? (
          <p className="ops-body">No instructor is assigned to this Program yet.</p>
        ) : (
          <div className="ops-list">
            {detail.instructors.map((instructor) => {
              const personId = instructorPersonMap.get(instructor.id);
              const classTitle = detail.classes.find((c) => c.id === instructor.classId)?.title ?? "Delivery Class";
              return (
                <div className="ops-list-row ops-list-row--compact" key={`${instructor.classId}-${instructor.id}`}>
                  <div>
                    {personId ? (
                      <Link className="ops-record-name" href={`/app/people/${personId}?tab=instructor`}>{instructor.name}</Link>
                    ) : (
                      <span className="ops-record-name">{instructor.name}</span>
                    )}
                    <span className="ops-record-meta">{classTitle} · {formatLabel(instructor.role)}</span>
                  </div>
                  <Badge status={instructor.eligibility === "eligible" ? "positive" : "warning"}>{formatLabel(instructor.eligibility)}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </PageSection>

      {detail.staffingByClass.some((entry) => entry.leadRecommendations.length > 0 || entry.additionalRecommendations.length > 0) && (
        <PageSection title="Recommended instructors by class">
          <div style={{ display: "grid", gap: 12 }}>
            {detail.staffingByClass.map((entry) => {
              const classTitle = detail.classes.find((c) => c.id === entry.classId)?.title ?? "Delivery Class";
              const combined = [...entry.leadRecommendations, ...entry.additionalRecommendations].filter((r) => r.tier !== "blocked").slice(0, 5);
              if (combined.length === 0) return null;
              return (
                <div key={entry.classId}>
                  <span className="ops-label">{classTitle}</span>
                  <div className="ops-chip-list" style={{ marginTop: 6 }}>
                    {combined.map((r) => (
                      <Link key={r.instructorId} href={`/app/instructors/${r.instructorId}`} className="ops-chip" data-tone={r.tier === "strong" ? "positive" : "warning"}>
                        #{r.rank} {r.name} · {r.tier}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="ops-section-note" style={{ marginTop: 12 }}>Use the Actions panel at the bottom of this record to assign or remove an instructor.</p>
        </PageSection>
      )}

      <PageSection title="Students">
        {detail.students.length === 0 ? (
          <div className="ops-empty">
            <h3 className="ops-empty__title">No students are enrolled.</h3>
            <p className="ops-empty__body">Open a linked Class to enroll students. Minimum enrollment and form readiness update automatically.</p>
          </div>
        ) : (
          <div className="ops-list">
            {detail.students.map((student) => {
              const personId = studentPersonMap.get(student.id);
              const href = personId ? `/app/people/${personId}?tab=student` : `/app/students/${student.id}`;
              return (
                <div className="ops-list-row ops-list-row--compact" key={`${student.classId}-${student.id}`}>
                  <div>
                    <Link className="ops-record-name" href={href}>{student.name}</Link>
                    <span className="ops-record-meta">Class: {detail.classes.find((item) => item.id === student.classId)?.title ?? "Delivery Class"}</span>
                  </div>
                  <Badge status={student.formStatus === "complete" ? "positive" : "warning"}>Forms {student.formStatus}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </PageSection>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Schedule — sessions, upcoming vs past, "Today" emphasis.                */
/* ---------------------------------------------------------------------- */

function ScheduleTab({ detail }: { detail: ProgramDetail }) {
  const startOfToday = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
  const endOfToday = new Date(new Date().setHours(23, 59, 59, 999)).getTime();
  const sorted = [...detail.sessions].sort((a, b) => a.sessionDate - b.sessionDate);
  const today = sorted.filter((s) => s.sessionDate >= startOfToday && s.sessionDate <= endOfToday);
  const upcoming = sorted.filter((s) => s.sessionDate > endOfToday);
  const past = sorted.filter((s) => s.sessionDate < startOfToday);

  function row(session: ProgramDetail["sessions"][number], emphasis?: boolean) {
    return (
      <div className={emphasis ? "ops-list-row" : "ops-list-row ops-list-row--compact"} key={session.id}>
        <div>
          <Link className="ops-record-name" href={`/app/classes/${session.classId}/sessions/${session.id}`}>{session.classTitle}</Link>
          <span className="ops-record-meta">{session.location ?? "Location not set"}</span>
        </div>
        <span className="ops-value">{formatDateTimeInZone(session.sessionDate, session.scheduleTimezone)}</span>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 4 }}>
      {today.length > 0 && (
        <PageSection title="Today" noRule>
          <div className="ops-list">{today.map((s) => row(s, true))}</div>
        </PageSection>
      )}
      <PageSection title="Upcoming sessions" noRule={today.length === 0}>
        {upcoming.length === 0 ? <p className="ops-body">No upcoming sessions scheduled.</p> : <div className="ops-list">{upcoming.map((s) => row(s))}</div>}
      </PageSection>
      <PageSection title="Past sessions">
        {past.length === 0 ? <p className="ops-body">No sessions recorded yet.</p> : <div className="ops-list">{[...past].reverse().map((s) => row(s))}</div>}
      </PageSection>
      <p className="ops-section-note">{sorted.length} total session{sorted.length === 1 ? "" : "s"}</p>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Activity — connected history timeline, humanized.                       */
/* ---------------------------------------------------------------------- */

function ActivityTab({ detail }: { detail: ProgramDetail }) {
  return (
    <PageSection title="Connected history" noRule>
      {detail.connectedHistory.length === 0 ? (
        <div className="ops-empty">
          <h3 className="ops-empty__title">No operating history has been recorded.</h3>
          <p className="ops-empty__body">Intake, stage decisions, Class delivery evidence, completion, renewal, and expansion will appear here as one record.</p>
        </div>
      ) : (
        <div className="ops-timeline">
          {detail.connectedHistory.map((activity) => (
            <div className="ops-timeline__item" key={activity.id}>
              <span className="ops-label">
                {activity.href ? <Link href={activity.href} style={{ color: "var(--bow-blue)" }}>{activity.scopeLabel}</Link> : activity.scopeLabel}
                {" · "}{activity.kind.replace(/_/g, " ")} · {new Date(activity.createdAt).toLocaleString()}
              </span>
              <p className="ops-body" style={{ marginTop: 5, color: "var(--bow-ink)" }}>{activity.body ?? "Activity recorded."}</p>
              {activity.actorName && <span className="ops-record-meta">By {activity.actorName}</span>}
            </div>
          ))}
        </div>
      )}
    </PageSection>
  );
}
