import Link from "next/link";
import { Badge, PageHeader, PageSection } from "@/components/ds";
import { requireInstructorSelf } from "@/lib/dal";
import { getDb } from "@/lib/db";
import { getInstructorDetail, listClassesForInstructor, listTrainingModules, listTrainingSessions } from "@/lib/hiring";
import TrainingModuleCard from "@/components/app/teach/TrainingModuleCard";
import RegisterSessionButton from "@/components/app/teach/RegisterSessionButton";
import AvailabilityEditor from "@/components/app/hiring/AvailabilityEditor";
import { formatDateTimeInZone, canonicalDateInZone } from "@/lib/timezone";
import SubmitWorkControls from "@/components/app/tasks/SubmitWorkControls";
import MissionUpdateForm from "@/components/app/teach/MissionUpdateForm";
import InstructorReferralForm from "@/components/app/teach/InstructorReferralForm";
import { sessionHref } from "@/lib/routes";
import { getMissionWithUpdates } from "@/lib/instructor-missions";
import { getInstructorImpact } from "@/lib/instructor-growth";
import { impactHeadline, impactStats } from "@/lib/instructor-growth-shared";
import { missionAreaMeta, missionIsOverdue, MISSION_UPDATE_KIND_LABEL, type InstructorMission, type MissionUpdate } from "@/lib/instructor-missions-shared";

const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_STAGES = ["eligible", "active"];

/**
 * The instructor's headline responsibility right now — "what am I responsible
 * for?" — rendered above the fold on the self-service home. Shows the outcome,
 * cadence, any due date, recent progress/feedback, and a way to post an update.
 */
function MissionCard({
  data,
  showEmpty,
  now,
}: {
  data: { mission: InstructorMission; updates: MissionUpdate[] } | null;
  showEmpty: boolean;
  now: number;
}) {
  if (!data) {
    if (!showEmpty) return null;
    return (
      <PageSection title="Current mission" noRule>
        <div className="ops-alert" data-tone="info">
          <p className="ops-body" style={{ margin: 0 }}>
            No current mission yet. Your BOW lead will set one — or tell them the mission you&rsquo;d like to take on
            (a class, a school introduction, recruiting an instructor, content, or curriculum).
          </p>
        </div>
      </PageSection>
    );
  }
  const { mission, updates } = data;
  const area = missionAreaMeta(mission.area);
  const overdue = missionIsOverdue(mission.dueOn, canonicalDateInZone(now));
  return (
    <PageSection title="Current mission" noRule>
      <div className="ops-alert" data-tone={overdue ? "warning" : "positive"} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Badge status="info">{area.label}</Badge>
          {mission.dueOn && <Badge status={overdue ? "negative" : "neutral"}>{overdue ? "Overdue " : "Due "}{mission.dueOn}</Badge>}
          {mission.cadence !== "once" && <span className="ops-label">{mission.cadence} cadence</span>}
        </div>
        <h3 className="ops-alert__title" style={{ margin: "2px 0 0" }}>{mission.title}</h3>
        <p className="ops-body" style={{ margin: 0 }}>{mission.outcome}</p>
        {mission.relatedEntityLabel && <span className="ops-label">Linked to {mission.relatedEntityLabel}</span>}
      </div>

      {updates.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <span className="ops-label">Recent updates</span>
          <div className="ops-timeline" style={{ marginTop: 6 }}>
            {updates.slice(0, 3).map((update) => (
              <div className="ops-timeline__item" key={update.id}>
                <span className="ops-record-meta">
                  {new Date(update.createdAt).toLocaleDateString()} · {MISSION_UPDATE_KIND_LABEL[update.kind]}
                  {update.authorName ? ` · ${update.authorName}` : ""}
                </span>
                <p className="ops-body" style={{ marginTop: 3 }}>{update.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <MissionUpdateForm missionId={mission.id} />
    </PageSection>
  );
}

function upcomingSorted<T extends { scheduledAt: number }>(sessions: T[], now: number): T[] {
  return sessions.filter((s) => s.scheduledAt >= now).sort((a, b) => a.scheduledAt - b.scheduledAt);
}

/** Presentation-layer humanizer for raw snake_case/lowercase enum values. */
function humanize(value: string): string {
  return value.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function isSameCalendarDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * /app/teach is THE stage-aware instructor home (Stage 2). Materially
 * different by stage: onboarding/training instructors get a checklist +
 * training modules + next session to attend; eligible/active instructors
 * get a "Today" view (next sessions to teach, assigned classes,
 * follow-ups) with onboarding detail moved below the fold.
 */
export default async function TeachHomePage() {
  const { user, instructor } = await requireInstructorSelf();
  const detail = (await getInstructorDetail(instructor.id))!;
  const completedModuleIds = new Set(detail.completions.map((c) => c.moduleId));
  const db = getDb();
  const now = Number(((await db.prepare("SELECT unixepoch('now') * 1000 AS now").get()) as { now: number }).now);

  const isDelivering = ACTIVE_STAGES.includes(instructor.stage) && instructor.eligibilityStatus === "eligible";
  // Resilient: never break an instructor's own home if the mission migration
  // is briefly behind the deployed code.
  const missionData = await getMissionWithUpdates(instructor.id).catch(() => null);

  const modules = (await listTrainingModules());
  const moduleViews = new Map(
    ((await db.prepare("SELECT module_id, first_viewed_at FROM training_module_views WHERE instructor_id = ?").all(instructor.id)) as { module_id: string; first_viewed_at: number }[])
      .map((view) => [view.module_id, view.first_viewed_at]),
  );
  const onboardingModules = modules.filter((m) => m.category === "onboarding");
  const trainingModules = modules.filter((m) => m.category === "training");
  const incompleteModuleCount = [...onboardingModules, ...trainingModules].filter((m) => !completedModuleIds.has(m.id)).length;

  const trainingSessions = (await listTrainingSessions());
  const upcomingTrainingSessions = upcomingSorted(trainingSessions, now);
  const nextTrainingSession = upcomingTrainingSessions[0] ?? null;
  const registeredSessionIds = new Set(
    ((await db.prepare("SELECT session_id FROM training_session_registrations WHERE instructor_id = ?").all(instructor.id)) as { session_id: string }[]).map(
      (r) => r.session_id,
    ),
  );

  const openTasks = ((await db.prepare("SELECT * FROM tasks WHERE (owner_user_id = ? OR doer_user_id = ?) AND status = 'open' ORDER BY due_at").all(user.id, user.id)) as any[]).map(
    (r) => ({
      id: r.id,
      title: r.title,
      dueAt: r.due_at ?? null,
      workflowState: r.workflow_state ?? "assigned",
      expectedResult: r.expected_result ?? null,
      definitionOfDone: r.definition_of_done ?? null,
      evidenceRequirement: r.evidence_requirement ?? null,
    }),
  );

  // Training status only needs a mention when it isn't the unremarkable
  // "on track" default — humanized, folded into the context line rather
  // than a chip strip (item 4/3 of the Stage 2.1 review).
  const trainingNote = instructor.trainingStatus === "behind"
    ? " Training is behind."
    : instructor.trainingStatus === "in_progress"
      ? " Training in progress."
      : "";

  if (!isDelivering) {
    // Onboarding / training / not-yet-eligible: checklist + modules + next
    // session to attend is the whole job right now.
    return (
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px clamp(16px,4vw,32px) 96px", display: "flex", flexDirection: "column", gap: 24 }}>
        <PageHeader
          eyebrow="My BOW"
          title="Onboarding & training"
          context={
            (incompleteModuleCount > 0
              ? `${incompleteModuleCount} item${incompleteModuleCount === 1 ? "" : "s"} left before you're ready to teach.`
              : "You're caught up — watch for your next session.") + trainingNote
          }
        />

        <MissionCard data={missionData} showEmpty={false} now={now} />

        {nextTrainingSession && (
          <PageSection title="Next session to attend" noRule>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <span style={{ fontFamily: "var(--font-interface)", fontSize: 15 }}>{nextTrainingSession.title}</span>{" "}
                {nextTrainingSession.required && <Badge status="negative">Required</Badge>}
                <p className="ops-label" style={{ margin: "4px 0 0" }}>{formatDateTimeInZone(nextTrainingSession.scheduledAt, nextTrainingSession.timeZone)}</p>
              </div>
              {registeredSessionIds.has(nextTrainingSession.id) ? (
                <Badge status="positive">Registered</Badge>
              ) : (
                <RegisterSessionButton sessionId={nextTrainingSession.id} instructorId={instructor.id} />
              )}
            </div>
          </PageSection>
        )}

        <PageSection title="Onboarding checklist">
          {onboardingModules.length === 0 && <p className="ops-body">Nothing to complete.</p>}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {(await Promise.all(onboardingModules.map(async (module) => (
                                <TrainingModuleCard key={module.id} instructorId={instructor.id} module={module} completed={completedModuleIds.has(module.id)} initialViewedAt={(await moduleViews.get(module.id)) ?? null} renderedAt={now} />
                              ))))}
          </div>
        </PageSection>

        <PageSection title="Training modules">
          {trainingModules.length === 0 && <p className="ops-body">Nothing to complete.</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(await Promise.all(trainingModules.map(async (module) => (
                                <TrainingModuleCard key={module.id} instructorId={instructor.id} module={module} completed={completedModuleIds.has(module.id)} initialViewedAt={(await moduleViews.get(module.id)) ?? null} renderedAt={now} />
                              ))))}
          </div>
        </PageSection>

        {upcomingTrainingSessions.length > 1 && (
          <PageSection title="Other upcoming sessions">
            <div style={{ display: "flex", flexDirection: "column" }}>
              {upcomingTrainingSessions.slice(1).map((s) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "10px 0", borderBottom: "1px solid var(--border-rule)" }}>
                  <div>
                    <span style={{ fontFamily: "var(--font-interface)", fontSize: 14 }}>{s.title}</span> {s.required && <Badge status="negative">Required</Badge>}
                    <p className="ops-label" style={{ margin: "4px 0 0" }}>{formatDateTimeInZone(s.scheduledAt, s.timeZone)}</p>
                  </div>
                  {registeredSessionIds.has(s.id) ? (
                    <Badge status="positive">Registered</Badge>
                  ) : (
                    <RegisterSessionButton sessionId={s.id} instructorId={instructor.id} />
                  )}
                </div>
              ))}
            </div>
          </PageSection>
        )}

        <PageSection title="Availability">
          <AvailabilityEditor
            instructorId={instructor.id}
            initialSlots={detail.availability.map((a) => ({ dayOfWeek: a.dayOfWeek, startTime: a.startTime, endTime: a.endTime, notes: a.notes ?? "" }))}
          />
        </PageSection>

        {openTasks.length > 0 && (
          <PageSection title="Your work">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {openTasks.map((t) => (
                <article key={t.id} style={{ border: "1px solid var(--border-rule)", padding: 14, borderRadius: 4 }}>
                  <p style={{ fontFamily: "var(--font-interface)", fontWeight: 700, margin: 0 }}>{t.title}</p>
                  {t.expectedResult && <p style={{ margin: "6px 0 0", fontSize: 14 }}><strong>Expected result:</strong> {t.expectedResult}</p>}
                  {t.definitionOfDone && <p style={{ margin: "6px 0 0", fontSize: 14 }}><strong>Done means:</strong> {t.definitionOfDone}</p>}
                  {t.evidenceRequirement && <p style={{ margin: "6px 0 0", fontSize: 14 }}><strong>Evidence:</strong> {t.evidenceRequirement}</p>}
                  <div style={{ marginTop: 12 }}><SubmitWorkControls taskId={t.id} workflowState={t.workflowState} /></div>
                </article>
              ))}
            </div>
          </PageSection>
        )}
      </div>
    );
  }

  // Active / eligible: "Today" view — sessions to teach, assigned classes,
  // follow-ups due — first; onboarding detail moves below.
  const classes = await listClassesForInstructor(instructor.id);
  const classIds = classes.map((c) => c.id);
  const classTitleById = new Map(classes.map((c) => [c.id, c.title]));

  const sessionRows = classIds.length
    ? ((await db
            .prepare(
              `SELECT id, class_id, session_date FROM class_sessions WHERE class_id IN (${classIds.map(() => "?").join(",")}) ORDER BY session_date`,
            )
            .all(...classIds)) as { id: string; class_id: string; session_date: number }[])
    : [];
  const reportedSessionIds = new Set(
    (sessionRows.length
      ? ((await db
                .prepare(
                  `SELECT session_id FROM class_session_reports WHERE session_id IN (${sessionRows.map(() => "?").join(",")})`,
                )
                .all(...sessionRows.map((s) => s.id))) as { session_id: string }[])
      : []
    ).map((r) => r.session_id),
  );

  // Split on the calendar day, not on `now`, and make the two lists disjoint.
  // Today's session belongs under "Sessions to teach" for the whole day even
  // once its start time has passed — it used to also appear under "Follow-ups
  // due" the moment the clock went past it, so the same session was
  // simultaneously something to prepare for and something to report on.
  const isPastDay = (s: { session_date: number }) =>
    s.session_date < now && !isSameCalendarDay(s.session_date, now);

  const upcomingClassSessions = sessionRows
    .filter((s) => !isPastDay(s) && s.session_date <= now + 14 * DAY_MS)
    .sort((a, b) => a.session_date - b.session_date)
    .slice(0, 8);

  const followUpsDue = sessionRows.filter((s) => isPastDay(s) && !reportedSessionIds.has(s.id));
  const impact = await getInstructorImpact(instructor.id, now).catch(() => null);
  const visibleImpact = impact ? impactStats(impact).filter((stat) => stat.value > 0) : [];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px clamp(16px,4vw,32px) 96px", display: "flex", flexDirection: "column", gap: 24 }}>
      <PageHeader eyebrow="My BOW" title="Today" context={`${classes.length} assigned class${classes.length === 1 ? "" : "es"}.`} />

      <MissionCard data={missionData} showEmpty now={now} />

      <PageSection title="Sessions to teach" noRule>
        {upcomingClassSessions.length === 0 ? (
          <p className="ops-body">No sessions scheduled in the next two weeks.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {upcomingClassSessions.map((s) => {
              const isToday = isSameCalendarDay(s.session_date, now);
              return (
                <Link
                  key={s.id}
                  href={sessionHref(s.class_id, s.id)}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, textDecoration: "none",
                    color: "var(--bow-ink)", padding: "12px 14px", margin: "0 -14px",
                    borderBottom: "1px solid var(--border-rule)",
                    background: isToday ? "var(--bow-paper)" : "transparent",
                    borderLeft: isToday ? "3px solid var(--bow-blue)" : "3px solid transparent",
                  }}
                >
                  <span style={{ fontFamily: "var(--font-interface)", fontSize: 14, fontWeight: isToday ? 700 : 400 }}>
                    {isToday && <Badge status="info">Today</Badge>} {classTitleById.get(s.class_id) ?? "Class"}
                  </span>
                  <span className="ops-label">{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(s.session_date)} · Prep →</span>
                </Link>
              );
            })}
          </div>
        )}
      </PageSection>

      {followUpsDue.length > 0 && (
        <PageSection title="Follow-ups due">
          <div style={{ display: "flex", flexDirection: "column" }}>
            {followUpsDue.map((s) => (
              <Link
                key={s.id}
                href={sessionHref(s.class_id, s.id)}
                style={{ display: "flex", justifyContent: "space-between", gap: 12, textDecoration: "none", color: "var(--bow-ink)", padding: "10px 0", borderBottom: "1px solid var(--border-rule)" }}
              >
                <span style={{ fontFamily: "var(--font-interface)", fontSize: 14 }}>
                  {classTitleById.get(s.class_id) ?? "Class"} — {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(s.session_date)} session report needed
                </span>
                <Badge status="warning">Submit report</Badge>
              </Link>
            ))}
          </div>
        </PageSection>
      )}

      <PageSection title="Assigned classes">
        {classes.length === 0 ? (
          <p className="ops-body">No classes assigned yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {classes.map((c) => (
              <Link
                key={c.id}
                href={`/app/teach/classes/${c.id}`}
                style={{ display: "flex", justifyContent: "space-between", gap: 12, textDecoration: "none", color: "var(--bow-ink)", padding: "10px 0", borderBottom: "1px solid var(--border-rule)" }}
              >
                <span style={{ fontFamily: "var(--font-interface)", fontSize: 14 }}>{c.title}</span>
                <span className="ops-label">{humanize(c.status)}</span>
              </Link>
            ))}
          </div>
        )}
      </PageSection>

      {openTasks.length > 0 && (
        <PageSection title="Your work">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {openTasks.map((t) => (
              <article key={t.id} style={{ border: "1px solid var(--border-rule)", padding: 14, borderRadius: 4 }}>
                <p style={{ fontFamily: "var(--font-interface)", fontWeight: 700, margin: 0 }}>{t.title}</p>
                {t.expectedResult && <p style={{ margin: "6px 0 0", fontSize: 14 }}><strong>Expected result:</strong> {t.expectedResult}</p>}
                {t.definitionOfDone && <p style={{ margin: "6px 0 0", fontSize: 14 }}><strong>Done means:</strong> {t.definitionOfDone}</p>}
                {t.evidenceRequirement && <p style={{ margin: "6px 0 0", fontSize: 14 }}><strong>Evidence:</strong> {t.evidenceRequirement}</p>}
                <div style={{ marginTop: 12 }}><SubmitWorkControls taskId={t.id} workflowState={t.workflowState} /></div>
              </article>
            ))}
          </div>
        </PageSection>
      )}

      {impact && visibleImpact.length > 0 && (
        <PageSection title="What you've accomplished">
          <p className="ops-body" style={{ marginTop: 0 }}>{impactHeadline(impact)}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginTop: 6 }}>
            {visibleImpact.map((stat) => (
              <div key={stat.key}>
                <span className="ops-label">{stat.label}</span>
                <strong style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 22 }}>{stat.value}</strong>
              </div>
            ))}
          </div>
        </PageSection>
      )}

      <PageSection title="Grow BOW">
        <p className="ops-body" style={{ marginTop: 0 }}>Know someone who&rsquo;d be a strong instructor? Refer them — you&rsquo;ll get credit when they join and become active.</p>
        <InstructorReferralForm />
      </PageSection>

      <PageSection title="Development">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p className="ops-body">Onboarding and training modules stay available from here if you want to revisit them.</p>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <Link className="ops-inline-link" href="/app/instructor/learn">Playbook Console →</Link>
            <Link className="ops-inline-link" href="/app/teach/proposals">Propose a class →</Link>
          </div>
        </div>
      </PageSection>
    </div>
  );
}
