import { Badge, SectionHeader } from "@/components/ds";
import { requireInstructorSelf } from "@/lib/dal";
import { getDb } from "@/lib/db";
import { getInstructorDetail, listTrainingModules, listTrainingSessions, type Task } from "@/lib/hiring";
import CompleteModuleButton from "@/components/app/teach/CompleteModuleButton";
import RegisterSessionButton from "@/components/app/teach/RegisterSessionButton";

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

function upcomingSorted<T extends { scheduledAt: number }>(sessions: T[]): T[] {
  const now = Date.now();
  return sessions.filter((s) => s.scheduledAt >= now).sort((a, b) => a.scheduledAt - b.scheduledAt);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function TeachHomePage() {
  const { user, instructor } = await requireInstructorSelf();
  const detail = getInstructorDetail(instructor.id)!;
  const completedModuleIds = new Set(detail.completions.map((c) => c.moduleId));

  const modules = listTrainingModules();
  const onboardingModules = modules.filter((m) => m.category === "onboarding");
  const trainingModules = modules.filter((m) => m.category === "training");

  const sessions = listTrainingSessions();
  const upcomingSessions = upcomingSorted(sessions);

  const db = getDb();
  const registeredSessionIds = new Set(
    (db.prepare("SELECT session_id FROM training_session_registrations WHERE instructor_id = ?").all(instructor.id) as { session_id: string }[]).map(
      (r) => r.session_id,
    ),
  );

  const openTasks = (db.prepare("SELECT * FROM tasks WHERE owner_user_id = ? AND status = 'open' ORDER BY due_at").all(user.id) as any[]).map(
    (r): Task => ({
      id: r.id,
      title: r.title,
      ownerUserId: r.owner_user_id ?? null,
      dueAt: r.due_at ?? null,
      status: r.status,
      entityType: r.entity_type ?? null,
      entityId: r.entity_id ?? null,
      handoffToFounder: r.handoff_to_founder === 1,
      completedAt: r.completed_at ?? null,
      completionNote: r.completion_note ?? null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }),
  );

  const latestEval = detail.evaluations[0] ?? null;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px clamp(16px,4vw,32px) 96px", display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionHeader kicker="My BOW" title="Onboarding &amp; Training" />

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
          {onboardingModules.map((m) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <span style={valueStyle}>{m.title}</span> {m.required && <Badge status="negative">Required</Badge>}
              </div>
              {completedModuleIds.has(m.id) ? (
                <Badge status="positive">Completed</Badge>
              ) : (
                <CompleteModuleButton instructorId={instructor.id} moduleId={m.id} />
              )}
            </div>
          ))}
        </div>
      </section>

      <section style={cardStyle}>
        <span style={{ ...labelStyle, display: "block", marginBottom: 12 }}>Training modules</span>
        {trainingModules.length === 0 && <p style={valueStyle}>Nothing to complete.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {trainingModules.map((m) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <span style={valueStyle}>{m.title}</span> {m.required && <Badge status="negative">Required</Badge>}
              </div>
              {completedModuleIds.has(m.id) ? (
                <Badge status="positive">Completed</Badge>
              ) : (
                <CompleteModuleButton instructorId={instructor.id} moduleId={m.id} />
              )}
            </div>
          ))}
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
                <p style={{ ...labelStyle, margin: "4px 0 0" }}>{new Date(s.scheduledAt).toLocaleString()}</p>
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

      {openTasks.length > 0 && (
        <section style={cardStyle}>
          <span style={{ ...labelStyle, display: "block", marginBottom: 12 }}>Your open tasks</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {openTasks.map((t) => (
              <p key={t.id} style={valueStyle}>
                {t.title}
              </p>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
