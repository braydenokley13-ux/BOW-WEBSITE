import { notFound } from "next/navigation";
import { Badge, SectionHeader } from "@/components/ds";
import { getCurrentUser } from "@/lib/dal";
import { getInstructorDetail, listActivity, listOpenTasksForEntity } from "@/lib/hiring";
import InstructorDetailActions from "@/components/app/hiring/InstructorDetailActions";

const STAGE_LABEL: Record<string, string> = {
  applied: "Applied",
  reviewing: "Reviewing",
  interview_scheduled: "Interview Scheduled",
  interviewed: "Interviewed",
  founder_review: "Founder Review",
  accepted: "Accepted",
  onboarding: "Onboarding",
  training: "Training",
  practice_evaluation: "Practice Evaluation",
  eligible: "Eligible",
  active: "Active",
  rejected: "Rejected",
  inactive: "Inactive",
};

const cardStyle = { background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 22 } as const;
const labelStyle = { fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "var(--bow-slate)", display: "block", marginBottom: 4 };
const valueStyle = { fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-ink)" };

export default async function InstructorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentUser();
  const detail = getInstructorDetail(id);
  if (!detail) notFound();

  const { instructor, person, availability, completions, evaluations } = detail;
  const activity = listActivity("instructor", id);
  const openTasks = listOpenTasksForEntity("instructor", id);
  let answers: Record<string, string> = {};
  try {
    answers = JSON.parse(instructor.answers || "{}");
  } catch {
    answers = {};
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px clamp(16px,4vw,32px) 96px", display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionHeader kicker="Instructors" title={person?.name ?? "Instructor"} />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <Badge status="info">{STAGE_LABEL[instructor.stage] ?? instructor.stage}</Badge>
        <Badge status={instructor.onboardingStatus === "complete" ? "positive" : "neutral"}>Onboarding: {instructor.onboardingStatus}</Badge>
        <Badge status={instructor.trainingStatus === "complete" ? "positive" : instructor.trainingStatus === "behind" ? "negative" : "neutral"}>
          Training: {instructor.trainingStatus}
        </Badge>
        <Badge status={instructor.eligibilityStatus === "eligible" ? "positive" : "neutral"}>{instructor.eligibilityStatus}</Badge>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px,1fr))", gap: 16 }}>
        <div style={cardStyle}>
          <span style={labelStyle}>Email</span>
          <span style={valueStyle}>{person?.email ?? "—"}</span>
        </div>
        <div style={cardStyle}>
          <span style={labelStyle}>Phone</span>
          <span style={valueStyle}>{person?.phone || "—"}</span>
        </div>
        <div style={cardStyle}>
          <span style={labelStyle}>Source</span>
          <span style={valueStyle}>{instructor.source ?? "—"}</span>
        </div>
        <div style={cardStyle}>
          <span style={labelStyle}>Owner</span>
          <span style={valueStyle}>{instructor.ownerUserId ?? "Unassigned"}</span>
        </div>
      </div>

      {Object.keys(answers).length > 0 && (
        <div style={cardStyle}>
          <span style={{ ...labelStyle, marginBottom: 12 }}>Application answers</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {Object.entries(answers).map(([k, v]) => (
              <div key={k}>
                <span style={{ ...labelStyle, textTransform: "capitalize" as const }}>{k.replace(/([A-Z])/g, " $1")}</span>
                <span style={valueStyle}>{v || "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(instructor.interviewAt || instructor.interviewNotes) && (
        <div style={cardStyle}>
          <span style={{ ...labelStyle, marginBottom: 8 }}>Interview</span>
          {instructor.interviewAt && <p style={valueStyle}>{new Date(instructor.interviewAt).toLocaleString()}</p>}
          {instructor.interviewNotes && (
            <p style={{ ...valueStyle, whiteSpace: "pre-wrap", color: "var(--bow-slate)" }}>{instructor.interviewNotes}</p>
          )}
        </div>
      )}

      {instructor.founderDecision && (
        <div style={cardStyle}>
          <span style={labelStyle}>Founder decision</span>
          <span style={valueStyle}>
            {instructor.founderDecision} {instructor.decidedAt ? `on ${new Date(instructor.decidedAt).toLocaleDateString()}` : ""}
          </span>
        </div>
      )}

      {availability.length > 0 && (
        <div style={cardStyle}>
          <span style={{ ...labelStyle, marginBottom: 8 }}>Availability</span>
          {availability.map((a) => (
            <p key={a.id} style={valueStyle}>
              Day {a.dayOfWeek}: {a.startTime}–{a.endTime}
            </p>
          ))}
        </div>
      )}

      {completions.length > 0 && (
        <div style={cardStyle}>
          <span style={{ ...labelStyle, marginBottom: 8 }}>Completed modules</span>
          <span style={valueStyle}>{completions.length} module(s) completed</span>
        </div>
      )}

      {evaluations.length > 0 && (
        <div style={cardStyle}>
          <span style={{ ...labelStyle, marginBottom: 8 }}>Practice evaluations</span>
          {evaluations.map((e) => (
            <p key={e.id} style={valueStyle}>
              {new Date(e.evaluatedAt).toLocaleDateString()} — {e.decision}
            </p>
          ))}
        </div>
      )}

      <InstructorDetailActions instructorId={id} stage={instructor.stage} isAdmin={me?.role === "admin"} />

      {openTasks.length > 0 && (
        <div style={cardStyle}>
          <span style={{ ...labelStyle, marginBottom: 8 }}>Open tasks</span>
          {openTasks.map((t) => (
            <p key={t.id} style={valueStyle}>
              {t.title} {t.handoffToFounder ? "(founder handoff)" : ""}
            </p>
          ))}
        </div>
      )}

      <div style={cardStyle}>
        <span style={{ ...labelStyle, marginBottom: 12 }}>Activity</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {activity.length === 0 && <span style={valueStyle}>No activity yet.</span>}
          {activity.map((a) => (
            <div key={a.id} style={{ borderBottom: "1px solid var(--border-rule)", paddingBottom: 8 }}>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)" }}>
                {new Date(a.createdAt).toLocaleString()} · {a.kind}
              </span>
              <p style={{ ...valueStyle, margin: "2px 0 0" }}>{a.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
