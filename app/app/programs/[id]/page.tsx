import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Button } from "@/components/ds";
import ProgramActions from "@/components/app/programs/ProgramActions";
import { requireStaff } from "@/lib/dal";
import {
  allowedProgramTransitions,
  dayLabel,
  formatLabel,
  getProgram,
  getProgramFormOptions,
  programStageLabel,
} from "@/lib/operations";
import { formatCanonicalDate, formatDateTimeInZone } from "@/lib/timezone";

function stageTone(stage: string): "positive" | "warning" | "negative" | "info" | "neutral" | "locked" {
  if (stage === "active" || stage === "renewed") return "positive";
  if (stage === "ready_to_launch" || stage === "partner_confirmed") return "info";
  if (stage === "paused" || stage === "closed") return "negative";
  if (["staffing", "enrollment", "recruiting", "renewal_review"].includes(stage)) return "warning";
  if (stage === "completed") return "locked";
  return "neutral";
}

function readinessTone(state: string): "positive" | "warning" | "negative" | "neutral" {
  if (state === "complete") return "positive";
  if (state === "blocked") return "negative";
  if (state === "warning") return "warning";
  return "neutral";
}

export default async function ProgramDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireStaff();
  const { id } = await params;
  const detail = getProgram(id);
  if (!detail) notFound();
  const options = getProgramFormOptions();
  const program = detail.program;
  const firstBlocker = detail.readiness.blockers[0];
  const nextAction = detail.readiness.nextAction;
  const isActive = program.stage === "active";
  const isHistorical = ["completed", "renewal_review", "renewed", "closed"].includes(program.stage);
  const planLocked = isHistorical || program.stage === "ready_to_launch" || program.stage === "active";
  const showReadiness = !isActive && !isHistorical;
  const contextLabel = isActive ? "Delivery command" : isHistorical ? "Outcome and continuation" : program.stage === "paused" ? "Recovery room" : "Launch room";
  const summary = isActive
    ? `${detail.enrollmentCount} students are being served across ${detail.classes.length} Class${detail.classes.length === 1 ? "" : "es"}. Keep delivery quality, open work, and the next lifecycle decision visible.`
    : isHistorical
      ? program.outcomeSummary ?? `Delivery is ${program.stage.replace(/_/g, " ")}. Preserve the evidence, close open work, and make renewal or expansion explicit.`
      : firstBlocker
        ? `${firstBlocker.detail} ${nextAction ? `${nextAction.owner} should ${nextAction.label.toLowerCase()} next.` : ""}`
        : "The required launch conditions are in place. Leadership can authorize delivery with confidence.";

  return (
    <main className="ops-page">
      <header className="ops-hero">
        <div className="ops-hero__copy">
          <span className="ops-eyebrow">Programs · {contextLabel}</span>
          <h1 className="ops-title">{program.name}</h1>
          <p className="ops-summary">{summary}</p>
          <div className="ops-status-line">
            <Badge status={stageTone(program.stage)}>{programStageLabel(program.stage)}</Badge>
            {showReadiness ? (
              <Badge status={detail.readiness.canLaunch ? "positive" : "negative"}>
                {detail.readiness.canLaunch ? "Launch ready" : `${detail.readiness.blockers.length} blocker${detail.readiness.blockers.length === 1 ? "" : "s"}`}
              </Badge>
            ) : isActive ? (
              <Badge status="positive">Delivery in progress</Badge>
            ) : (
              <Badge status={program.renewalStatus === "renewed" || program.renewalStatus === "expanded" ? "positive" : "warning"}>
                Renewal {program.renewalStatus.replace(/_/g, " ")}
              </Badge>
            )}
            {program.launchExceptionReason && <Badge status="warning">Launch exception approved</Badge>}
          </div>
        </div>
        <div className="ops-actions">
          <Button href="/app/programs" variant="secondary">All Programs</Button>
          {!planLocked && <Button href={`/app/programs/${id}/edit`} variant="emphasis">Edit Program Plan</Button>}
        </div>
      </header>

      {detail.originatingInquiry && (
        <section className="ops-panel ops-panel--flat">
          <div className="ops-section-head">
            <div>
              <span className="ops-label">Intake origin</span>
              <h2 className="ops-section-title">Demand that created this Program</h2>
            </div>
            <Badge status="positive">Source connected</Badge>
          </div>
          <div className="ops-meta-grid">
            <div className="ops-meta"><span className="ops-label">Inquiry type</span><span className="ops-value">{detail.originatingInquiry.type}</span></div>
            <div className="ops-meta"><span className="ops-label">Submitted</span><span className="ops-value">{detail.originatingInquiry.submittedLabel}</span></div>
            <div className="ops-meta"><span className="ops-label">Organization</span><span className="ops-value">{detail.originatingInquiry.organizationName}</span></div>
            <div className="ops-meta"><span className="ops-label">Contact</span><span className="ops-value">{detail.originatingInquiry.name} · {detail.originatingInquiry.email}</span></div>
          </div>
          <p className="ops-body" style={{ marginTop: 16 }}>{detail.originatingInquiry.summary}</p>
          <div className="ops-actions" style={{ justifyContent: "flex-start", marginTop: 16 }}>
            {detail.partner && (
              <Button href={`/app/partners/${detail.partner.id}#inquiry-${detail.originatingInquiry.id}`} variant="secondary" size="sm">
                Open Partner Intake
              </Button>
            )}
            {me.role === "admin" && (
              <Button href={`/app/admin/inquiries#inquiry-${detail.originatingInquiry.id}`} variant="secondary" size="sm">
                Open Demand Inbox
              </Button>
            )}
          </div>
        </section>
      )}

      {showReadiness && firstBlocker && (
        <section className="ops-alert">
          <span className="ops-alert__title">Primary launch blocker</span>
          <p className="ops-body" style={{ marginTop: 5, color: "var(--bow-ink)" }}>{firstBlocker.detail}</p>
          {firstBlocker.actionHref && firstBlocker.actionLabel && (
            <Link className="ops-inline-link" href={firstBlocker.actionHref} style={{ display: "inline-block", marginTop: 9 }}>
              {firstBlocker.actionLabel} →
            </Link>
          )}
        </section>
      )}

      <div className="ops-grid">
        <div className="ops-stack">
          {showReadiness ? (
            <section className="ops-panel ops-panel--signal">
            <div className="ops-section-head">
              <div>
                <span className="ops-label">Launch readiness</span>
                <h2 className="ops-section-title">What is true—and what is not</h2>
              </div>
            </div>
            <div className="ops-readiness-head">
              <span className="ops-readiness-number">{detail.readiness.percent}%</span>
              <div>
                <div
                  className="ops-progress"
                  role="progressbar"
                  aria-label="Launch readiness"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={detail.readiness.percent}
                >
                  <span style={{ width: `${detail.readiness.percent}%` }} />
                </div>
                <p className="ops-section-note" style={{ marginTop: 8 }}>
                  {detail.readiness.completedCount} of {detail.readiness.totalCount} launch conditions complete. Readiness is calculated from the operating record below.
                </p>
              </div>
            </div>
            <div className="ops-checklist">
              {detail.readiness.items.map((item) => (
                <div className="ops-check" data-state={item.state} key={item.key}>
                  <span className="ops-check__dot" aria-hidden="true" />
                  <div>
                    <span className="ops-check__name">{item.label}</span>
                    <div style={{ marginTop: 5 }}><Badge status={readinessTone(item.state)}>{item.state.replace(/_/g, " ")}</Badge></div>
                  </div>
                  <p className="ops-check__detail">{item.detail}</p>
                  <div className="ops-check__owner">
                    {item.owner}
                    {item.actionHref && item.actionLabel && <><br /><Link href={item.actionHref} style={{ color: "var(--bow-blue)" }}>{item.actionLabel}</Link></>}
                  </div>
                </div>
              ))}
            </div>
            </section>
          ) : (
            <section className="ops-panel ops-panel--signal">
              <div className="ops-section-head">
                <div>
                  <span className="ops-label">{isActive ? "Delivery health" : "Outcome record"}</span>
                  <h2 className="ops-section-title">{isActive ? "Run the work in motion" : "Preserve evidence and decide what follows"}</h2>
                </div>
              </div>
              <div className="ops-meta-grid">
                <div className="ops-meta"><span className="ops-label">Classes</span><span className="ops-value">{detail.classes.length}</span></div>
                <div className="ops-meta"><span className="ops-label">Students served</span><span className="ops-value">{detail.enrollmentCount}</span></div>
                <div className="ops-meta"><span className="ops-label">Open work</span><span className="ops-value">{detail.tasks.length}</span></div>
                <div className="ops-meta"><span className="ops-label">Sessions recorded</span><span className="ops-value">{detail.sessions.length}</span></div>
              </div>
              {isHistorical && (
                <div className="ops-alert" data-tone={program.outcomeSummary ? "positive" : "warning"} style={{ marginTop: 18 }}>
                  <span className="ops-alert__title">{program.outcomeSummary ? "Outcome captured" : "Outcome evidence is incomplete"}</span>
                  <p className="ops-body" style={{ marginTop: 5 }}>{program.outcomeSummary ?? "Record the result before using this Program as evidence for renewal or expansion."}</p>
                </div>
              )}
            </section>
          )}

          {!isHistorical && <section id="staffing" className="ops-panel ops-anchor">
            <div className="ops-section-head">
              <div>
                <span className="ops-label">Deterministic staffing</span>
                <h2 className="ops-section-title">Who fits this Program—and why</h2>
              </div>
              <span className="ops-section-note">Eligibility and scoped approvals are hard requirements. Availability, Location, workload, experience, and reliability explain the ranking.</span>
            </div>
            {detail.recommendations.length === 0 ? (
              <div className="ops-empty">
                <h3 className="ops-empty__title">No instructor can be recommended yet.</h3>
                <p className="ops-empty__body">Move an instructor through onboarding, training, practice evaluation, and eligibility before staffing this Program.</p>
                <div style={{ marginTop: 16 }}><Button href="/app/instructors" variant="secondary">Open Instructor Pipeline</Button></div>
              </div>
            ) : (
              <div className="ops-rank-list">
                {detail.recommendations.slice(0, 10).map((recommendation) => (
                  <article className="ops-rank" key={recommendation.instructorId}>
                    <span className="ops-rank__number">{String(recommendation.rank).padStart(2, "0")}</span>
                    <div>
                      <Link className="ops-record-name" href={`/app/instructors/${recommendation.instructorId}`}>{recommendation.name}</Link>
                      <span className="ops-record-meta">{programStageLabel(recommendation.progressionLevel)} · {recommendation.workload}/{recommendation.maxWorkload} workload</span>
                      <div style={{ marginTop: 7 }}><Badge status={recommendation.tier === "strong" ? "positive" : recommendation.tier === "possible" ? "warning" : "negative"}>{recommendation.tier} fit</Badge></div>
                    </div>
                    <div>
                      <span className="ops-label">Confirmed fit</span>
                      <div className="ops-chip-list" style={{ marginTop: 8 }}>
                        {recommendation.matches.map((match) => <span className="ops-chip" data-tone="positive" key={match}>{match}</span>)}
                      </div>
                    </div>
                    <div>
                      <span className="ops-label">Missing or conflicting</span>
                      <div className="ops-chip-list" style={{ marginTop: 8 }}>
                        {recommendation.missing.map((missing) => <span className="ops-chip" data-tone="negative" key={missing}>{missing}</span>)}
                        {recommendation.conflicts.map((conflict) => <span className="ops-chip" data-tone="warning" key={conflict}>{conflict}</span>)}
                        {recommendation.missing.length === 0 && recommendation.conflicts.length === 0 && <span className="ops-chip" data-tone="positive">No known conflicts</span>}
                      </div>
                    </div>
                    <span className="ops-section-note">{recommendation.reliabilityNote}</span>
                  </article>
                ))}
              </div>
            )}
          </section>}
        </div>

        <aside className="ops-stack">
          <section id="program-plan" className="ops-panel ops-anchor">
            <div className="ops-section-head">
              <div><span className="ops-label">Program plan</span><h2 className="ops-section-title">At a glance</h2></div>
            </div>
            <div className="ops-meta-grid">
              <div className="ops-meta"><span className="ops-label">Partner</span><span className="ops-value">{detail.partner ? <Link href={`/app/partners/${detail.partner.id}`} style={{ color: "var(--bow-blue)" }}>{detail.partner.name}</Link> : "Not linked"}</span></div>
              <div className="ops-meta"><span className="ops-label">Location</span><span className="ops-value">{detail.location ? <Link href={`/app/locations/${detail.location.id}`} style={{ color: "var(--bow-blue)" }}>{detail.location.name}</Link> : program.deliveryFormat === "online" ? "Online" : "Not linked"}</span></div>
              <div className="ops-meta"><span className="ops-label">Primary contact</span><span className="ops-value">{detail.primaryContact?.name ?? "Not linked"}</span></div>
              <div className="ops-meta"><span className="ops-label">BOW owner</span><span className="ops-value">{detail.ownerName ?? "Unassigned"}</span></div>
              <div className="ops-meta"><span className="ops-label">Curriculum</span><span className="ops-value">{detail.curriculum?.title ?? "Not selected"}</span></div>
              <div className="ops-meta"><span className="ops-label">Audience</span><span className="ops-value">{program.audience ?? "Not set"}</span></div>
              <div className="ops-meta"><span className="ops-label">Format</span><span className="ops-value">{formatLabel(program.deliveryFormat)}</span></div>
              <div className="ops-meta"><span className="ops-label">Launch</span><span className="ops-value">{program.launchDate ?? "Not set"}</span></div>
              <div className="ops-meta"><span className="ops-label">Dates</span><span className="ops-value">{program.startDate ?? "—"} → {program.endDate ?? "—"}</span></div>
              <div className="ops-meta"><span className="ops-label">Schedule</span><span className="ops-value">{program.scheduleLabel ?? `${dayLabel(program.scheduleDay)} ${program.scheduleStartTime ?? ""}–${program.scheduleEndTime ?? ""}`}</span></div>
              <div className="ops-meta"><span className="ops-label">Delivery timezone</span><span className="ops-value">{program.scheduleTimezone ?? detail.location?.timezone ?? "Not set"}</span></div>
              <div className="ops-meta"><span className="ops-label">Enrollment</span><span className="ops-value">{detail.enrollmentCount} unique students</span></div>
              <div className="ops-meta"><span className="ops-label">Class enrollment target</span><span className="ops-value">{program.minimumEnrollment} minimum · {program.capacity ?? "no cap"} capacity</span></div>
            </div>
            {program.notes && <p className="ops-body" style={{ marginTop: 18, whiteSpace: "pre-wrap" }}>{program.notes}</p>}
          </section>

          <ProgramActions
            programId={id}
            programName={program.name}
            stage={program.stage}
            partnerConfirmed={program.partnerConfirmed}
            materialsStatus={program.materialsStatus}
            renewalStatus={program.renewalStatus}
            readinessCanLaunch={detail.readiness.canLaunch}
            availableTransitions={allowedProgramTransitions(program.stage)}
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
        </aside>
      </div>

      <section id="classes" className="ops-panel ops-panel--flat ops-anchor">
        <div className="ops-section-head">
          <div><span className="ops-label">Delivery</span><h2 className="ops-section-title">Classes and first sessions</h2></div>
          <span className="ops-section-note">Classes hold instructors, rosters, sessions, attendance, and reports. Programs hold the plan and lifecycle.</span>
        </div>
        {detail.classes.length === 0 ? (
          <div className="ops-empty"><h3 className="ops-empty__title">No delivery Class exists.</h3><p className="ops-empty__body">Create or connect a Class so staffing, enrollment, sessions, attendance, and reporting can begin.</p></div>
        ) : (
          <div className="ops-list">
            {detail.classes.map((classRecord) => {
              const sessions = detail.sessions.filter((session) => session.classId === classRecord.id);
              const instructors = detail.instructors.filter((instructor) => instructor.classId === classRecord.id);
              const students = detail.students.filter((student) => student.classId === classRecord.id);
              return (
                <article className="ops-list-row" key={classRecord.id}>
                  <div><Link className="ops-record-name" href={`/app/classes/${classRecord.id}`}>{classRecord.title}</Link><span className="ops-record-meta">{classRecord.location ?? detail.location?.name ?? formatLabel(program.deliveryFormat)}</span></div>
                  <Badge status={stageTone(classRecord.status)}>{programStageLabel(classRecord.status)}</Badge>
                  <div><span className="ops-label">Staffing</span><span className="ops-value">{instructors.length} instructor{instructors.length === 1 ? "" : "s"}</span></div>
                  <div><span className="ops-label">Delivery state</span><span className="ops-value">{students.length} enrolled · {sessions.length} session{sessions.length === 1 ? "" : "s"}</span><span className="ops-record-meta">{sessions[0] ? `First ${formatDateTimeInZone(sessions[0].sessionDate, sessions[0].scheduleTimezone)}` : "First session not scheduled"}</span></div>
                  <Button href={`/app/classes/${classRecord.id}`} variant="secondary" size="sm">Open Class</Button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <div className="ops-grid">
        <section id="students" className="ops-panel ops-anchor">
          <div className="ops-section-head"><div><span className="ops-label">Enrollment</span><h2 className="ops-section-title">Students and forms</h2></div></div>
          {detail.students.length === 0 ? (
            <div className="ops-empty"><h3 className="ops-empty__title">No students are enrolled.</h3><p className="ops-empty__body">Open a linked Class to enroll students. Minimum enrollment and form readiness update automatically.</p></div>
          ) : (
            <div className="ops-list">
              {detail.students.map((student) => (
                <div className="ops-list-row ops-list-row--compact" key={`${student.classId}-${student.id}`}>
                  <div><Link className="ops-record-name" href={`/app/students/${student.id}`}>{student.name}</Link><span className="ops-record-meta">Class: {detail.classes.find((item) => item.id === student.classId)?.title ?? "Delivery Class"}</span></div>
                  <Badge status={student.formStatus === "complete" ? "positive" : "warning"}>Forms {student.formStatus}</Badge>
                  <Button href={`/app/students/${student.id}`} variant="secondary" size="sm">Open Student</Button>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="ops-stack">
          <section className="ops-panel">
            <div className="ops-section-head"><div><span className="ops-label">Work</span><h2 className="ops-section-title">Open ownership</h2></div></div>
            {detail.tasks.length === 0 ? <p className="ops-body">No open Program work. Add a task when a decision, follow-up, meeting, or issue needs explicit ownership.</p> : detail.tasks.map((task) => (
              <div className="ops-meta" key={task.id}>
                <span className="ops-label">{task.kind} · {task.priority}</span>
                <span className="ops-value">{task.title}</span>
                <span className="ops-record-meta">{task.ownerName ?? "Unassigned"}{task.dueOn ? ` · due ${formatCanonicalDate(task.dueOn)}` : task.dueAt ? ` · due ${new Date(task.dueAt).toLocaleDateString()}` : ""}</span>
                {task.context && <p className="ops-section-note" style={{ marginTop: 5 }}>{task.context}</p>}
              </div>
            ))}
            <div style={{ marginTop: 16 }}><Button href="/app/tasks" variant="secondary" size="sm">Open Work</Button></div>
          </section>

          {detail.relatedPrograms.length > 0 && (
            <section className="ops-panel">
              <div className="ops-section-head"><div><span className="ops-label">Lifecycle lineage</span><h2 className="ops-section-title">Renewal and expansion</h2></div></div>
              {detail.relatedPrograms.map((related) => (
                <div className="ops-meta" key={related.id}><span className="ops-label">{related.relationship.replace(/_/g, " ")}</span><Link className="ops-value" href={`/app/programs/${related.id}`} style={{ color: "var(--bow-blue)" }}>{related.name}</Link><span className="ops-record-meta">{programStageLabel(related.stage)}</span></div>
              ))}
            </section>
          )}
        </aside>
      </div>

      <section className="ops-panel ops-panel--flat">
        <div className="ops-section-head"><div><span className="ops-label">Connected history</span><h2 className="ops-section-title">Intake, planning, delivery, and continuation</h2></div></div>
        {detail.connectedHistory.length === 0 ? (
          <div className="ops-empty"><h3 className="ops-empty__title">No operating history has been recorded.</h3><p className="ops-empty__body">Intake, stage decisions, Class delivery evidence, completion, renewal, and expansion will appear here as one record.</p></div>
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
      </section>
    </main>
  );
}
