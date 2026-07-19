import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ds";
import { getCurrentUser } from "@/lib/dal";
import { getDb } from "@/lib/db";
import { getInstructorDetail, listActivity, listOpenTasksForEntity, listStaffUsers, resolveUserNames } from "@/lib/hiring";
import { getInstructorWorkforceDossier, type WorkforceAssignment } from "@/lib/instructor-workforce";
import InstructorDetailActions from "@/components/app/hiring/InstructorDetailActions";
import InstructorWorkforceActions from "@/components/app/hiring/InstructorWorkforceActions";
import { canonicalDateInZone, formatCanonicalDate, formatDateTimeInZone } from "@/lib/timezone";

const STAGE_LABEL: Record<string, string> = {
  applied: "Applied",
  reviewing: "Reviewing",
  interview_scheduled: "Interview scheduled",
  interviewed: "Interviewed",
  founder_review: "Founder review",
  accepted: "Accepted",
  onboarding: "Onboarding",
  training: "Training",
  practice_evaluation: "Practice evaluation",
  eligible: "Eligible",
  active: "Active",
  rejected: "Rejected",
  inactive: "Inactive",
};

const DAY_LABEL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatLabel(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateLabel(value: number | string | null): string {
  if (value == null) return "Not scheduled";
  if (typeof value === "string") return formatCanonicalDate(value);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not scheduled" : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function ratingTone(value: number | null): "positive" | "warning" | "negative" | "neutral" {
  if (value == null) return "neutral";
  if (value >= 4) return "positive";
  if (value >= 3) return "neutral";
  if (value >= 2) return "warning";
  return "negative";
}

function stageTone(stage: string): "positive" | "warning" | "negative" | "info" | "neutral" | "locked" {
  if (["active", "eligible", "accepted"].includes(stage)) return "positive";
  if (["rejected"].includes(stage)) return "negative";
  if (["inactive"].includes(stage)) return "locked";
  if (["founder_review", "onboarding", "training", "practice_evaluation"].includes(stage)) return "warning";
  return "info";
}

function AssignmentList({ assignments, empty }: { assignments: WorkforceAssignment[]; empty: string }) {
  if (assignments.length === 0) return <p className="ops-body">{empty}</p>;
  return (
    <div className="ops-list">
      {assignments.map((assignment) => (
        <div className="ops-list-row" key={assignment.id}>
          <div>
            <Link className="ops-record-name" href={`/app/classes/${assignment.classId}`}>{assignment.classTitle}</Link>
            <span className="ops-record-meta">{assignment.programName}</span>
          </div>
          <div>
            <span className="ops-label">Role</span>
            <span className="ops-value">{formatLabel(assignment.role)}</span>
          </div>
          <div>
            <span className="ops-label">Scope</span>
            <span className="ops-value">{assignment.curriculumTitle}<br />{assignment.locationName}</span>
          </div>
          <div>
            <span className="ops-label">Dates</span>
            <span className="ops-value">{dateLabel(assignment.startDate)} – {dateLabel(assignment.endDate)}</span>
            {assignment.status === "removed" && assignment.decisionReason && <span className="ops-record-meta">Removed: {assignment.decisionReason}</span>}
          </div>
          <Badge status={stageTone(assignment.status)}>{formatLabel(assignment.status)}</Badge>
        </div>
      ))}
    </div>
  );
}

export default async function InstructorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentUser();
  const detail = (await getInstructorDetail(id));
  const dossier = (await getInstructorWorkforceDossier(id));
  if (!detail || !dossier) notFound();

  const { instructor, person, completions, evaluations } = detail;
  const now = Number(((await getDb().prepare("SELECT unixepoch('now') * 1000 AS now").get()) as { now: number }).now);
  const today = canonicalDateInZone(now);
  const activity = (await listActivity("instructor", id)).slice(0, 30);
  const openTasks = (await listOpenTasksForEntity("instructor", id));
  const staffUsers = (await listStaffUsers());
  const resolvedOwnerName = instructor.ownerUserId
    ? (await resolveUserNames([instructor.ownerUserId])).get(instructor.ownerUserId)
    : null;
  const ownerName = instructor.ownerUserId
    ? resolvedOwnerName && resolvedOwnerName !== instructor.ownerUserId ? resolvedOwnerName : "Former staff member"
    : null;
  let answers: Record<string, string> = {};
  try {
    answers = JSON.parse(instructor.answers || "{}");
  } catch {
    answers = {};
  }

  const activeQualifications = dossier.qualifications.filter((qualification) => qualification.status === "approved");
  const historicalQualifications = dossier.qualifications.filter((qualification) => qualification.status !== "approved");
  const openDevelopment = dossier.development.filter((item) => item.status === "open");
  const resolvedDevelopment = dossier.development.filter((item) => item.status !== "open").slice(0, 10);
  const reliabilityTone = dossier.reliability.missingReports180d > 0 || dossier.reliability.lowReliabilitySignals180d > 0 ? "warning" : "positive";

  return (
    <main className="ops-page" data-accent="blue">
      <header className="ops-hero">
        <div className="ops-hero__copy">
          <span className="ops-eyebrow">Instructor workforce dossier</span>
          <h1 className="ops-title">{dossier.profile.name}</h1>
          <p className="ops-summary">
            One decision record for hiring, teaching scope, workload, quality evidence, development, recognition, and future leadership capacity.
          </p>
          <div className="ops-status-line">
            <Badge status={stageTone(instructor.stage)}>{STAGE_LABEL[instructor.stage] ?? formatLabel(instructor.stage)}</Badge>
            <Badge status={instructor.onboardingStatus === "complete" ? "positive" : "neutral"}>Onboarding · {formatLabel(instructor.onboardingStatus)}</Badge>
            <Badge status={instructor.trainingStatus === "complete" ? "positive" : instructor.trainingStatus === "behind" ? "negative" : "neutral"}>Training · {formatLabel(instructor.trainingStatus)}</Badge>
            <Badge status={instructor.eligibilityStatus === "eligible" ? "positive" : "neutral"}>{formatLabel(instructor.eligibilityStatus)}</Badge>
            <Badge status="info">{formatLabel(dossier.profile.progressionLevel)}</Badge>
          </div>
        </div>
        <div className="ops-actions">
          <Link href="/app/instructors" className="ops-inline-link">All instructors</Link>
          <Link href="/app/tasks" className="ops-inline-link">Open Work</Link>
        </div>
      </header>

      <section className="ops-alert" data-tone={dossier.nextAction.tone} aria-labelledby="manager-next-action">
        <span className="ops-label">Manager next action</span>
        <h2 id="manager-next-action" className="ops-alert__title" style={{ marginTop: 7 }}>{dossier.nextAction.title}</h2>
        <p className="ops-body" style={{ marginTop: 5 }}>{dossier.nextAction.detail}</p>
        <a href={dossier.nextAction.href} className="ops-inline-link" style={{ display: "inline-block", marginTop: 10 }}>Go to action</a>
      </section>

      <div className="ops-grid">
        <div className="ops-stack">
          <section className="ops-panel" aria-labelledby="pipeline-actions-title">
            <div className="ops-section-head">
              <div>
                <span className="ops-label">Lifecycle</span>
                <h2 id="pipeline-actions-title" className="ops-section-title">Pipeline &amp; access decisions</h2>
              </div>
              <p className="ops-section-note">Hiring gates remain separate from workforce quality and teaching approval decisions.</p>
            </div>
            <InstructorDetailActions
              instructorId={id}
              stage={instructor.stage}
              trainingStatus={instructor.trainingStatus}
              isAdmin={me?.role === "admin"}
              isStaff={me?.role === "admin" || me?.role === "growth"}
              staffUsers={staffUsers}
              availability={detail.availability.map((slot) => ({ dayOfWeek: slot.dayOfWeek, startTime: slot.startTime, endTime: slot.endTime, notes: slot.notes ?? "" }))}
            />
          </section>

          <section id="assignments" className="ops-panel ops-anchor" aria-labelledby="assignments-title">
            <div className="ops-section-head">
              <div>
                <span className="ops-label">Current delivery</span>
                <h2 id="assignments-title" className="ops-section-title">Assignments</h2>
              </div>
              <p className="ops-section-note">{dossier.workload.currentClasses} of {dossier.workload.maximumClasses} weekly Class slots in use{dossier.workload.pausedClasses > 0 ? ` · ${dossier.workload.pausedClasses} paused` : ""}.</p>
            </div>
            <AssignmentList assignments={dossier.currentAssignments} empty="No current Class assignments." />
            <details style={{ marginTop: 20 }}>
              <summary className="ops-inline-link" style={{ cursor: "pointer" }}>Prior assignments ({dossier.priorAssignments.length})</summary>
              <div style={{ marginTop: 14 }}>
                <AssignmentList assignments={dossier.priorAssignments} empty="No prior Class assignments." />
              </div>
            </details>
          </section>

          <section className="ops-panel" aria-labelledby="qualifications-title">
            <div className="ops-section-head">
              <div>
                <span className="ops-label">Staffing scope</span>
                <h2 id="qualifications-title" className="ops-section-title">Qualifications</h2>
              </div>
              <p className="ops-section-note">Only active, unexpired approvals count toward ranked staffing fit.</p>
            </div>
            {activeQualifications.length === 0 ? (
              <div className="ops-alert" data-tone="warning">
                <p className="ops-alert__title">No active teaching approvals</p>
                <p className="ops-body" style={{ marginTop: 5 }}>Staffing recommendations will remain blocked until scope is approved below.</p>
              </div>
            ) : (
              <div className="ops-list">
                {activeQualifications.map((qualification) => (
                  <div className="ops-list-row ops-list-row--compact" key={qualification.id}>
                    <div>
                      <span className="ops-record-name" style={{ fontSize: 19 }}>{qualification.label}</span>
                      <span className="ops-record-meta">{formatLabel(qualification.kind)}</span>
                    </div>
                    <span className="ops-body">
                      {qualification.approverName ? `Approved by ${qualification.approverName}` : "Approval source not recorded"}
                      {qualification.expiresOn || qualification.expiresAt
                        ? ` · expires ${dateLabel(qualification.expiresOn ?? qualification.expiresAt)}`
                        : " · no expiration"}
                      {qualification.notes ? <><br />{qualification.notes}</> : null}
                    </span>
                    <Badge status="positive">Approved</Badge>
                  </div>
                ))}
              </div>
            )}
            {historicalQualifications.length > 0 && (
              <details style={{ marginTop: 18 }}>
                <summary className="ops-inline-link" style={{ cursor: "pointer" }}>Expired and revoked ({historicalQualifications.length})</summary>
                <div className="ops-chip-list" style={{ marginTop: 12 }}>
                  {historicalQualifications.map((qualification) => (
                    <span className="ops-chip" data-tone="warning" key={qualification.id}>{qualification.label} · {qualification.status}</span>
                  ))}
                </div>
              </details>
            )}
          </section>

          <section id="quality" className="ops-panel ops-anchor" aria-labelledby="quality-title">
            <div className="ops-section-head">
              <div>
                <span className="ops-label">Continuous quality loop</span>
                <h2 id="quality-title" className="ops-section-title">Evidence, not reputation</h2>
              </div>
              <Badge status={dossier.qualityTrend.tone}>{dossier.qualityTrend.label}</Badge>
            </div>
            <p className="ops-body" style={{ marginBottom: 18 }}>{dossier.qualityTrend.detail}</p>
            <div className="ops-meta-grid" style={{ marginBottom: 24 }}>
              {dossier.qualityDimensions.map((dimension) => (
                <div className="ops-meta" key={dimension.key}>
                  <span className="ops-label">{dimension.label}</span>
                  <span className="ops-value ops-value--large">{dimension.recentAverage?.toFixed(1) ?? dimension.average?.toFixed(1) ?? "—"}<span style={{ fontSize: 13, fontFamily: "var(--font-data)", color: "var(--bow-slate)" }}> / 5</span></span>
                  <span className="ops-record-meta">{dimension.evidenceCount} scored signal{dimension.evidenceCount === 1 ? "" : "s"}</span>
                </div>
              ))}
            </div>

            {dossier.feedback.length === 0 ? (
              <div className="ops-empty">
                <p className="ops-empty__title">No quality evidence yet</p>
                <p className="ops-empty__body">Record the first staff, partner, parent, student, peer, or self-reflection signal in the manager workspace below.</p>
              </div>
            ) : (
              <div className="ops-timeline">
                {dossier.feedback.slice(0, 20).map((feedback) => {
                  const scores = [
                    ["Curriculum", feedback.ratings.curriculumDelivery],
                    ["Student/family", feedback.ratings.studentFamilyRelationships],
                    ["Reliability", feedback.ratings.organizationReliability],
                    ["Leadership", feedback.ratings.leadershipContribution],
                  ] as const;
                  return (
                    <article className="ops-timeline__item" key={feedback.id}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div>
                          <h3 className="ops-record-name" style={{ fontSize: 19 }}>{formatLabel(feedback.sourceType)}</h3>
                          <span className="ops-record-meta">{feedback.authorName ?? "Source not named"} · {dateLabel(feedback.createdAt)} · {feedback.contextLabel}</span>
                        </div>
                        {feedback.followUpRequired && <Badge status="warning">Follow-up linked</Badge>}
                      </div>
                      <div className="ops-chip-list" style={{ marginTop: 9 }}>
                        {scores.filter(([, score]) => score != null).map(([label, score]) => (
                          <span className="ops-chip" data-tone={ratingTone(score)} key={label}>{label} · {score}/5</span>
                        ))}
                      </div>
                      {feedback.body && <p className="ops-body" style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>{feedback.body}</p>}
                      {feedback.strengths && <p className="ops-body" style={{ marginTop: 8 }}><strong style={{ color: "var(--bow-positive)" }}>Strength:</strong> {feedback.strengths}</p>}
                      {feedback.concerns && <p className="ops-body" style={{ marginTop: 8 }}><strong style={{ color: "var(--bow-negative)" }}>Concern:</strong> {feedback.concerns}</p>}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section id="development" className="ops-panel ops-anchor" aria-labelledby="development-title">
            <div className="ops-section-head">
              <div>
                <span className="ops-label">Instructor development</span>
                <h2 id="development-title" className="ops-section-title">Plans &amp; recognition</h2>
              </div>
              <p className="ops-section-note">{openDevelopment.length} open · {resolvedDevelopment.length} recently resolved</p>
            </div>
            {openDevelopment.length === 0 ? (
              <p className="ops-body">No open development or recognition items.</p>
            ) : (
              <div className="ops-list">
                {openDevelopment.map((item) => (
                  <div className="ops-list-row ops-list-row--compact" key={item.id}>
                    <div>
                      <span className="ops-record-name" style={{ fontSize: 19 }}>{item.title}</span>
                      <span className="ops-record-meta">{formatLabel(item.kind)} · {formatLabel(item.stage)}{item.relatedToFeedback ? " · linked to feedback" : ""}</span>
                    </div>
                    <span className="ops-body">
                      Owner: {item.ownerName ?? "Former or unassigned staff"}<br />
                      Due: {dateLabel(item.dueOn ?? item.dueAt)}
                      {item.notes ? <><br />{item.notes}</> : null}
                    </span>
                    <Badge status={item.dueOn ? (item.dueOn < today ? "negative" : "warning") : item.dueAt && item.dueAt < now ? "negative" : "warning"}>
                      {item.dueOn ? (item.dueOn < today ? "Overdue" : "Open") : item.dueAt && item.dueAt < now ? "Overdue" : "Open"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
            {resolvedDevelopment.length > 0 && (
              <details style={{ marginTop: 18 }}>
                <summary className="ops-inline-link" style={{ cursor: "pointer" }}>Resolved history</summary>
                <div className="ops-timeline" style={{ marginTop: 14 }}>
                  {resolvedDevelopment.map((item) => (
                    <div className="ops-timeline__item" key={item.id}>
                      <span className="ops-record-name" style={{ fontSize: 17 }}>{item.title}</span>
                      <span className="ops-record-meta">{formatLabel(item.kind)} · resolved {dateLabel(item.resolvedAt)}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </section>

          <InstructorWorkforceActions
            instructorId={id}
            instructorName={dossier.profile.name}
            stage={instructor.stage}
            progressionLevel={dossier.profile.progressionLevel}
            maxWeeklyClasses={dossier.profile.maxWeeklyClasses}
            developmentFocus={dossier.profile.developmentFocus}
            staffUsers={staffUsers}
            qualificationOptions={dossier.qualificationOptions}
            feedbackContextOptions={dossier.feedbackContextOptions}
            qualifications={dossier.qualifications.map((qualification) => ({ id: qualification.id, kind: qualification.kind, label: qualification.label, status: qualification.status }))}
            developmentItems={dossier.development.map((item) => ({ id: item.id, title: item.title, kind: item.kind, stage: item.stage, status: item.status }))}
          />
        </div>

        <aside className="ops-stack" aria-label="Instructor operating context">
          <section className="ops-panel ops-panel--ink" aria-labelledby="identity-title">
            <span className="ops-label" style={{ color: "#b9bcc4" }}>Identity &amp; ownership</span>
            <h2 id="identity-title" className="ops-section-title" style={{ color: "var(--bow-white)", marginTop: 7 }}>{dossier.profile.name}</h2>
            <div className="ops-meta-grid" style={{ marginTop: 16 }}>
              <div className="ops-meta"><span className="ops-label" style={{ color: "#b9bcc4" }}>Email</span><span className="ops-value" style={{ color: "var(--bow-white)" }}>{person?.email ?? "—"}</span></div>
              <div className="ops-meta"><span className="ops-label" style={{ color: "#b9bcc4" }}>Phone</span><span className="ops-value" style={{ color: "var(--bow-white)" }}>{person?.phone || "—"}</span></div>
              <div className="ops-meta"><span className="ops-label" style={{ color: "#b9bcc4" }}>Source</span><span className="ops-value" style={{ color: "var(--bow-white)" }}>{instructor.source ? formatLabel(instructor.source) : "—"}</span></div>
              <div className="ops-meta"><span className="ops-label" style={{ color: "#b9bcc4" }}>Owner</span><span className="ops-value" style={{ color: "var(--bow-white)" }}>{ownerName ?? "Unassigned"}</span></div>
            </div>
          </section>

          <section id="reliability" className="ops-panel ops-anchor" aria-labelledby="reliability-title">
            <div className="ops-section-head">
              <div><span className="ops-label">180-day evidence</span><h2 id="reliability-title" className="ops-section-title">Reliability</h2></div>
              <Badge status={reliabilityTone}>{reliabilityTone === "positive" ? "Clear" : "Review"}</Badge>
            </div>
            <div className="ops-meta-grid">
              <div className="ops-meta"><span className="ops-label">Assigned sessions</span><span className="ops-value ops-value--large">{dossier.reliability.deliveredSessions180d}</span></div>
              <div className="ops-meta"><span className="ops-label">Reports by instructor</span><span className="ops-value ops-value--large">{dossier.reliability.reportsSubmittedByInstructor180d}</span></div>
              <div className="ops-meta"><span className="ops-label">Missing final reports</span><span className="ops-value ops-value--large">{dossier.reliability.missingReports180d}</span></div>
              <div className="ops-meta"><span className="ops-label">Low reliability signals</span><span className="ops-value ops-value--large">{dossier.reliability.lowReliabilitySignals180d}</span></div>
              <div className="ops-meta"><span className="ops-label">Next 30 days</span><span className="ops-value">{dossier.reliability.next30DaySessions} session{dossier.reliability.next30DaySessions === 1 ? "" : "s"}</span></div>
              <div className="ops-meta"><span className="ops-label">Weekly load</span><span className="ops-value">{dossier.workload.currentClasses} / {dossier.workload.maximumClasses} Classes</span></div>
            </div>
          </section>

          <section className="ops-panel" aria-labelledby="availability-title">
            <div className="ops-section-head"><div><span className="ops-label">Capacity signal</span><h2 id="availability-title" className="ops-section-title">Availability</h2></div></div>
            {dossier.availability.length === 0 ? <p className="ops-body">No weekly availability recorded.</p> : (
              <div className="ops-list">
                {dossier.availability.map((slot) => (
                  <div className="ops-meta" key={slot.id}>
                    <span className="ops-label">{DAY_LABEL[slot.dayOfWeek] ?? `Day ${slot.dayOfWeek}`}</span>
                    <span className="ops-value">{slot.startTime}–{slot.endTime}{slot.notes ? ` · ${slot.notes}` : ""}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="ops-panel" aria-labelledby="focus-title">
            <div className="ops-section-head"><div><span className="ops-label">Manager intent</span><h2 id="focus-title" className="ops-section-title">Development focus</h2></div></div>
            <p className="ops-body">{dossier.profile.developmentFocus ?? "No current development focus has been set."}</p>
          </section>

          <section className="ops-panel" aria-labelledby="training-title">
            <div className="ops-section-head"><div><span className="ops-label">Readiness evidence</span><h2 id="training-title" className="ops-section-title">Training</h2></div></div>
            <div className="ops-meta-grid">
              <div className="ops-meta"><span className="ops-label">Modules complete</span><span className="ops-value ops-value--large">{completions.length}</span></div>
              <div className="ops-meta"><span className="ops-label">Practice evaluations</span><span className="ops-value ops-value--large">{evaluations.length}</span></div>
            </div>
            {evaluations[0] && <p className="ops-body" style={{ marginTop: 12 }}>Latest: {formatLabel(evaluations[0].decision)} · {dateLabel(evaluations[0].evaluatedAt)}</p>}
          </section>

          <section id="work" className="ops-panel ops-anchor" aria-labelledby="work-title">
            <div className="ops-section-head"><div><span className="ops-label">Universal Work</span><h2 id="work-title" className="ops-section-title">Open Work</h2></div><Badge status={openTasks.length > 0 ? "warning" : "positive"}>{openTasks.length}</Badge></div>
            {openTasks.length === 0 ? <p className="ops-body">No open Work linked to this instructor.</p> : (
              <div className="ops-list">
                {openTasks.map((task) => (
                  <div className="ops-meta" key={task.id}>
                    <span className="ops-value">{task.title}</span>
                    <span className="ops-record-meta">{formatLabel(task.kind)}{task.dueOn || task.dueAt ? ` · due ${dateLabel(task.dueOn ?? task.dueAt)}` : ""}{task.handoffToFounder ? " · founder handoff" : ""}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {(Object.keys(answers).length > 0 || instructor.interviewAt || instructor.interviewNotes || instructor.founderDecision) && (
            <section className="ops-panel" aria-labelledby="hiring-evidence-title">
              <div className="ops-section-head"><div><span className="ops-label">Hiring evidence</span><h2 id="hiring-evidence-title" className="ops-section-title">Application record</h2></div></div>
              {instructor.interviewAt && <p className="ops-body"><strong>Interview:</strong> {formatDateTimeInZone(instructor.interviewAt, instructor.interviewTimeZone)}</p>}
              {instructor.interviewNotes && <p className="ops-body" style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>{instructor.interviewNotes}</p>}
              {instructor.founderDecision && <p className="ops-body" style={{ marginTop: 10 }}><strong>Founder decision:</strong> {formatLabel(instructor.founderDecision)}{instructor.decidedAt ? ` · ${dateLabel(instructor.decidedAt)}` : ""}</p>}
              {Object.entries(answers).map(([key, value]) => (
                <div className="ops-meta" key={key}>
                  <span className="ops-label">{formatLabel(key.replace(/([a-z])([A-Z])/g, "$1 $2"))}</span>
                  <span className="ops-value">{value || "—"}</span>
                </div>
              ))}
            </section>
          )}

          <section className="ops-panel" aria-labelledby="activity-title">
            <div className="ops-section-head"><div><span className="ops-label">Audit trail</span><h2 id="activity-title" className="ops-section-title">Recent activity</h2></div></div>
            {activity.length === 0 ? <p className="ops-body">No activity yet.</p> : (
              <div className="ops-timeline">
                {activity.map((item) => (
                  <div className="ops-timeline__item" key={item.id}>
                    <span className="ops-record-meta">{new Date(item.createdAt).toLocaleString()} · {formatLabel(item.kind)}</span>
                    <p className="ops-body" style={{ marginTop: 3 }}>{item.body}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
