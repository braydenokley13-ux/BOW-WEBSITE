import Link from "next/link";
import { Badge, PageHeader, PageSection } from "@/components/ds";
import { requireInstructorSelf } from "@/lib/dal";
import { getDb } from "@/lib/db";
import { getInstructorDetail, listClassesForInstructor, listTrainingModules, listTrainingSessions } from "@/lib/hiring";
import TrainingModuleCard from "@/components/app/teach/TrainingModuleCard";
import RegisterSessionButton from "@/components/app/teach/RegisterSessionButton";
import AvailabilityEditor from "@/components/app/hiring/AvailabilityEditor";
import { formatDateTimeInZone } from "@/lib/timezone";
import SubmitWorkControls from "@/components/app/tasks/SubmitWorkControls";
import { sessionHref } from "@/lib/routes";

const STAGE_LABEL: Record<string, string> = {
  accepted: "Accepted",
  onboarding: "Onboarding",
  training: "Training",
  practice_evaluation: "Practice Evaluation",
  eligible: "Eligible",
  active: "Active",
  inactive: "Inactive",
};

const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_STAGES = ["eligible", "active"];

function upcomingSorted<T extends { scheduledAt: number }>(sessions: T[], now: number): T[] {
  return sessions.filter((s) => s.scheduledAt >= now).sort((a, b) => a.scheduledAt - b.scheduledAt);
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

  const latestEval = detail.evaluations[0] ?? null;

  const stageBadges = (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
      <Badge status="info">{STAGE_LABEL[instructor.stage] ?? instructor.stage}</Badge>
      <Badge status={instructor.onboardingStatus === "complete" ? "positive" : "neutral"}>Onboarding: {instructor.onboardingStatus}</Badge>
      <Badge status={instructor.trainingStatus === "complete" ? "positive" : instructor.trainingStatus === "behind" ? "negative" : "neutral"}>
        Training: {instructor.trainingStatus}
      </Badge>
      {latestEval && <Badge status={latestEval.decision === "pass" ? "positive" : "warning"}>Practice eval: {latestEval.decision}</Badge>}
    </div>
  );

  if (!isDelivering) {
    // Onboarding / training / not-yet-eligible: checklist + modules + next
    // session to attend is the whole job right now.
    return (
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px clamp(16px,4vw,32px) 96px", display: "flex", flexDirection: "column", gap: 24 }}>
        <PageHeader
          eyebrow="My BOW"
          title="Onboarding & training"
          context={incompleteModuleCount > 0 ? `${incompleteModuleCount} item${incompleteModuleCount === 1 ? "" : "s"} left before you're ready to teach.` : "You're caught up — watch for your next session."}
        />
        {stageBadges}

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
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
  const upcomingClassSessions = sessionRows
    .filter((s) => s.session_date >= now - DAY_MS && s.session_date <= now + 14 * DAY_MS)
    .sort((a, b) => a.session_date - b.session_date)
    .slice(0, 8);

  const reportedSessionIds = new Set(
    (classIds.length
      ? ((await db
                .prepare(
                  `SELECT session_id FROM class_session_reports WHERE session_id IN (${sessionRows.map(() => "?").join(",")})`,
                )
                .all(...sessionRows.map((s) => s.id))) as { session_id: string }[])
      : []
    ).map((r) => r.session_id),
  );
  const followUpsDue = sessionRows.filter((s) => s.session_date < now && !reportedSessionIds.has(s.id));

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px clamp(16px,4vw,32px) 96px", display: "flex", flexDirection: "column", gap: 24 }}>
      <PageHeader eyebrow="My BOW" title="Today" context={`${classes.length} assigned class${classes.length === 1 ? "" : "es"}.`} />
      {stageBadges}

      <PageSection title="Sessions to teach" noRule>
        {upcomingClassSessions.length === 0 ? (
          <p className="ops-body">No sessions scheduled in the next two weeks.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {upcomingClassSessions.map((s) => (
              <Link
                key={s.id}
                href={sessionHref(s.class_id, s.id)}
                style={{ display: "flex", justifyContent: "space-between", gap: 12, textDecoration: "none", color: "var(--bow-ink)", padding: "10px 0", borderBottom: "1px solid var(--border-rule)" }}
              >
                <span style={{ fontFamily: "var(--font-interface)", fontSize: 14 }}>{classTitleById.get(s.class_id) ?? "Class"}</span>
                <span className="ops-label">{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(s.session_date)} · Prep →</span>
              </Link>
            ))}
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
                <span style={{ fontFamily: "var(--font-interface)", fontSize: 14 }}>{classTitleById.get(s.class_id) ?? "Class"} — session report needed</span>
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
                <span className="ops-label">{c.status}</span>
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
