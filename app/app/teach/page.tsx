import { Badge, SectionHeader } from "@/components/ds";
import { requireInstructorSelf } from "@/lib/dal";
import { getDb } from "@/lib/db";
import { getInstructorDetail, listTrainingModules, listTrainingSessions } from "@/lib/hiring";
import TrainingModuleCard from "@/components/app/teach/TrainingModuleCard";
import RegisterSessionButton from "@/components/app/teach/RegisterSessionButton";
import AvailabilityEditor from "@/components/app/hiring/AvailabilityEditor";
import { formatDateTimeInZone } from "@/lib/timezone";
import SubmitWorkControls from "@/components/app/tasks/SubmitWorkControls";

const STAGE_LABEL: Record<string, string> = {
  accepted: "Accepted",
  onboarding: "Onboarding",
  training: "Training",
  practice_evaluation: "Practice Evaluation",
  eligible: "Eligible",
  active: "Active",
  inactive: "Inactive",
};

const cardStyle = { background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 22 } as const;
const labelStyle = { fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "var(--bow-slate)" };
const valueStyle = { fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-ink)" };

function upcomingSorted<T extends { scheduledAt: number }>(sessions: T[], now: number): T[] {
  return sessions.filter((s) => s.scheduledAt >= now).sort((a, b) => a.scheduledAt - b.scheduledAt);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function TeachHomePage() {
  const { user, instructor } = await requireInstructorSelf();
  const detail = (await getInstructorDetail(instructor.id))!;
  const completedModuleIds = new Set(detail.completions.map((c) => c.moduleId));
  const db = getDb();
  const now = Number(((await db.prepare("SELECT unixepoch('now') * 1000 AS now").get()) as { now: number }).now);

  const modules = (await listTrainingModules());
  const moduleViews = new Map(
    ((await db.prepare("SELECT module_id, first_viewed_at FROM training_module_views WHERE instructor_id = ?").all(instructor.id)) as { module_id: string; first_viewed_at: number }[])
      .map((view) => [view.module_id, view.first_viewed_at]),
  );
  const onboardingModules = modules.filter((m) => m.category === "onboarding");
  const trainingModules = modules.filter((m) => m.category === "training");

  const sessions = (await listTrainingSessions());
  const upcomingSessions = upcomingSorted(sessions, now);

  const registeredSessionIds = new Set(
    ((await db.prepare("SELECT session_id FROM training_session_registrations WHERE instructor_id = ?").all(instructor.id)) as { session_id: string }[]).map(
      (r) => r.session_id,
    ),
  );

  const openTasks = ((await db.prepare("SELECT * FROM tasks WHERE (owner_user_id = ? OR doer_user_id = ?) AND status = 'open' ORDER BY due_at").all(user.id, user.id)) as any[]).map(
    (r) => ({
      id: r.id,
      title: r.title,
      kind: r.kind ?? "task",
      ownerUserId: r.owner_user_id ?? null,
      dueAt: r.due_at ?? null,
      dueOn: r.due_on ?? null,
      status: r.status,
      entityType: r.entity_type ?? null,
      entityId: r.entity_id ?? null,
      handoffToFounder: r.handoff_to_founder === 1,
      completedAt: r.completed_at ?? null,
      completionNote: r.completion_note ?? null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      workflowState: r.workflow_state ?? "assigned",
      expectedResult: r.expected_result ?? null,
      definitionOfDone: r.definition_of_done ?? null,
      evidenceRequirement: r.evidence_requirement ?? null,
    }),
  );

  const latestEval = detail.evaluations[0] ?? null;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px clamp(16px,4vw,32px) 96px", display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionHeader kicker="My BOW" title="Onboarding &amp; Training" level={1} />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <Badge status="info">{STAGE_LABEL[instructor.stage] ?? instructor.stage}</Badge>
        <Badge status={instructor.onboardingStatus === "complete" ? "positive" : "neutral"}>Onboarding: {instructor.onboardingStatus}</Badge>
        <Badge status={instructor.trainingStatus === "complete" ? "positive" : instructor.trainingStatus === "behind" ? "negative" : "neutral"}>
          Training: {instructor.trainingStatus}
        </Badge>
        {latestEval && <Badge status={latestEval.decision === "pass" ? "positive" : "warning"}>Practice eval: {latestEval.decision}</Badge>}
      </div>

      <section style={cardStyle}>
        <span style={{ ...labelStyle, display: "block", marginBottom: 12 }}>Onboarding checklist</span>
        {onboardingModules.length === 0 && <p style={valueStyle}>Nothing to complete.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(await Promise.all(onboardingModules.map(async (module) => (
                              <TrainingModuleCard key={module.id} instructorId={instructor.id} module={module} completed={completedModuleIds.has(module.id)} initialViewedAt={(await moduleViews.get(module.id)) ?? null} renderedAt={now} />
                            ))))}
        </div>
      </section>

      <section style={cardStyle}>
        <span style={{ ...labelStyle, display: "block", marginBottom: 12 }}>Training modules</span>
        {trainingModules.length === 0 && <p style={valueStyle}>Nothing to complete.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(await Promise.all(trainingModules.map(async (module) => (
                              <TrainingModuleCard key={module.id} instructorId={instructor.id} module={module} completed={completedModuleIds.has(module.id)} initialViewedAt={(await moduleViews.get(module.id)) ?? null} renderedAt={now} />
                            ))))}
        </div>
      </section>

      <section style={cardStyle}>
        <span style={{ ...labelStyle, display: "block", marginBottom: 12 }}>Upcoming training sessions</span>
        {upcomingSessions.length === 0 && <p style={valueStyle}>No upcoming sessions.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {upcomingSessions.map((s) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <span style={valueStyle}>{s.title}</span> {s.required && <Badge status="negative">Required</Badge>}
                <p style={{ ...labelStyle, margin: "4px 0 0" }}>{formatDateTimeInZone(s.scheduledAt, s.timeZone)}</p>
              </div>
              {registeredSessionIds.has(s.id) ? (
                <Badge status="positive">Registered</Badge>
              ) : (
                <RegisterSessionButton sessionId={s.id} instructorId={instructor.id} />
              )}
            </div>
          ))}
        </div>
      </section>

      <section style={cardStyle}>
        <span style={{ ...labelStyle, display: "block", marginBottom: 12 }}>Availability</span>
        <AvailabilityEditor
          instructorId={instructor.id}
          initialSlots={detail.availability.map((a) => ({ dayOfWeek: a.dayOfWeek, startTime: a.startTime, endTime: a.endTime, notes: a.notes ?? "" }))}
        />
      </section>

      {openTasks.length > 0 && (
        <section style={cardStyle}>
          <span style={{ ...labelStyle, display: "block", marginBottom: 12 }}>Your Work</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {openTasks.map((t) => (
              <article key={t.id} style={{ border: "1px solid var(--border-rule)", padding: 14, borderRadius: 4 }}>
                <p style={{ ...valueStyle, fontWeight: 700 }}>{t.title}</p>
                {t.expectedResult && <p style={{ ...valueStyle, marginTop: 6 }}><strong>Expected result:</strong> {t.expectedResult}</p>}
                {t.definitionOfDone && <p style={{ ...valueStyle, marginTop: 6 }}><strong>Done means:</strong> {t.definitionOfDone}</p>}
                {t.evidenceRequirement && <p style={{ ...valueStyle, marginTop: 6 }}><strong>Evidence:</strong> {t.evidenceRequirement}</p>}
                <div style={{ marginTop: 12 }}><SubmitWorkControls taskId={t.id} workflowState={t.workflowState} /></div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
