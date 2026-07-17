import Link from "next/link";
import { Badge, Button, SectionHeader } from "@/components/ds";
import { listTrainingModules, listTrainingSessions, listInstructors, type TrainingStatus } from "@/lib/hiring";
import TrainingModuleActions from "@/components/app/training/TrainingModuleActions";
import NewTrainingModal from "@/components/app/training/NewTrainingModal";

const cardStyle = { background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 20 } as const;
const labelStyle = { fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "var(--bow-slate)" };
const valueStyle = { fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-ink)" };

const TRAINING_BUCKET_LABEL: Record<TrainingStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  behind: "Missed required session",
  complete: "Completed",
};

const TRAINING_BUCKET_ORDER: TrainingStatus[] = ["behind", "not_started", "in_progress", "complete"];

function splitSessions<T extends { scheduledAt: number }>(sessions: T[]): { upcoming: T[]; past: T[] } {
  const now = Date.now();
  return {
    upcoming: sessions.filter((s) => s.scheduledAt >= now).sort((a, b) => a.scheduledAt - b.scheduledAt),
    past: sessions.filter((s) => s.scheduledAt < now),
  };
}

export default function TrainingPage() {
  const modules = listTrainingModules();
  const sessions = listTrainingSessions();
  const { upcoming, past } = splitSessions(sessions);

  const instructorsInPipeline = listInstructors().filter((i) =>
    ["onboarding", "training", "practice_evaluation"].includes(i.stage),
  );
  const byTraining = new Map<TrainingStatus, typeof instructorsInPipeline>();
  for (const b of TRAINING_BUCKET_ORDER) byTraining.set(b, []);
  for (const i of instructorsInPipeline) {
    if (!byTraining.has(i.trainingStatus)) byTraining.set(i.trainingStatus, []);
    byTraining.get(i.trainingStatus)!.push(i);
  }

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px clamp(16px,4vw,32px) 96px", display: "flex", flexDirection: "column", gap: 32 }}>
      <SectionHeader kicker="BOW HQ" title="Training" />

      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, textTransform: "uppercase", color: "var(--bow-ink)" }}>
            Modules
          </h3>
          <NewTrainingModal kind="module" />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {modules.length === 0 && <p style={valueStyle}>No modules yet.</p>}
          {modules.map((m) => (
            <div key={m.id} style={{ ...cardStyle, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ ...valueStyle, fontWeight: 600 }}>{m.title}</span>
                  <Badge status={m.category === "onboarding" ? "info" : "warning"}>{m.category}</Badge>
                  {m.required && <Badge status="negative">Required</Badge>}
                </div>
                <span style={{ ...labelStyle }}>{m.contentType}</span>
              </div>
              <TrainingModuleActions module={m} />
            </div>
          ))}
        </div>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, textTransform: "uppercase", color: "var(--bow-ink)" }}>
            Sessions
          </h3>
          <NewTrainingModal kind="session" />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={labelStyle}>Upcoming</span>
          {upcoming.length === 0 && <p style={valueStyle}>No upcoming sessions.</p>}
          {upcoming.map((s) => (
            <Link key={s.id} href={`/app/training/sessions/${s.id}`} style={{ textDecoration: "none" }}>
              <div style={{ ...cardStyle, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <span style={{ ...valueStyle, fontWeight: 600 }}>{s.title}</span>{" "}
                  {s.required && <Badge status="negative">Required</Badge>}
                  <p style={{ ...labelStyle, margin: "4px 0 0" }}>{new Date(s.scheduledAt).toLocaleString()}</p>
                </div>
                <Button size="sm" variant="secondary">
                  View
                </Button>
              </div>
            </Link>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={labelStyle}>Past</span>
          {past.length === 0 && <p style={valueStyle}>No past sessions.</p>}
          {past.map((s) => (
            <Link key={s.id} href={`/app/training/sessions/${s.id}`} style={{ textDecoration: "none" }}>
              <div style={{ ...cardStyle, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <span style={{ ...valueStyle, fontWeight: 600 }}>{s.title}</span>
                  <p style={{ ...labelStyle, margin: "4px 0 0" }}>{new Date(s.scheduledAt).toLocaleString()}</p>
                </div>
                <Button size="sm" variant="secondary">
                  View
                </Button>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, textTransform: "uppercase", color: "var(--bow-ink)" }}>
          Training overview
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px,1fr))", gap: 16 }}>
          {TRAINING_BUCKET_ORDER.map((bucket) => {
            const rows = byTraining.get(bucket) ?? [];
            return (
              <div key={bucket} style={cardStyle}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={labelStyle}>{TRAINING_BUCKET_LABEL[bucket]}</span>
                  <Badge status={bucket === "behind" ? "negative" : bucket === "complete" ? "positive" : "neutral"}>{rows.length}</Badge>
                </div>
                {rows.length === 0 && <span style={{ ...valueStyle, color: "var(--bow-slate)" }}>None</span>}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {rows.map((i) => (
                    <Link key={i.id} href={`/app/instructors/${i.id}`} style={{ ...valueStyle, color: "var(--bow-blue)", textDecoration: "none" }}>
                      {i.person?.name ?? i.id}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
