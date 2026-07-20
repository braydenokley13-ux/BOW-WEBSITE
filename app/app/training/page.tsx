import Link from "next/link";
import { Badge, Button } from "@/components/ds";
import { listTrainingModules, listTrainingSessions, listInstructors, type TrainingStatus } from "@/lib/hiring";
import TrainingModuleActions from "@/components/app/training/TrainingModuleActions";
import NewTrainingModal from "@/components/app/training/NewTrainingModal";
import { formatDateTimeInZone } from "@/lib/timezone";

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

export default async function TrainingPage() {
  const modules = (await listTrainingModules());
  const sessions = (await listTrainingSessions());
  const { upcoming, past } = splitSessions(sessions);

  const instructorsInPipeline = (await listInstructors()).filter((i) =>
    ["onboarding", "training", "practice_evaluation"].includes(i.stage),
  );
  const byTraining = new Map<TrainingStatus, typeof instructorsInPipeline>();
  for (const b of TRAINING_BUCKET_ORDER) byTraining.set(b, []);
  for (const i of instructorsInPipeline) {
    if (!byTraining.has(i.trainingStatus)) byTraining.set(i.trainingStatus, []);
    byTraining.get(i.trainingStatus)!.push(i);
  }

  return (
    <main className="ops-page">
      <header className="ops-hero">
        <div className="ops-hero__copy">
          <span className="ops-eyebrow">BOW HQ · Training</span>
          <h1 className="ops-title">Training</h1>
          <p className="ops-summary">
            Modules, sessions, and where each instructor in the pipeline stands.
          </p>
        </div>
      </header>

      <section className="ops-panel ops-panel--flat" aria-labelledby="training-modules-title">
        <div className="ops-section-head">
          <div><span className="ops-label">Onboarding &amp; ongoing</span><h2 id="training-modules-title" className="ops-section-title">Modules</h2></div>
          <NewTrainingModal kind="module" />
        </div>
        {modules.length === 0 ? (
          <div className="ops-empty">
            <h3 className="ops-empty__title">No training modules yet.</h3>
            <p className="ops-empty__body">Create the first module to start building the onboarding curriculum.</p>
          </div>
        ) : (
          <div className="ops-list">
            {modules.map((m) => (
              <article className="ops-list-row ops-list-row--compact" key={m.id}>
                <div>
                  <span className="ops-record-name" style={{ fontSize: 15 }}>{m.title}</span>
                  <span className="ops-record-meta">{m.contentType}</span>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <Badge status="neutral">{m.category}</Badge>
                  {m.required && <Badge status="warning">Required</Badge>}
                </div>
                <TrainingModuleActions key={`${m.id}:${m.updatedAt}`} module={m} />
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="ops-panel ops-panel--flat" aria-labelledby="training-sessions-title">
        <div className="ops-section-head">
          <div><span className="ops-label">Live &amp; recorded</span><h2 id="training-sessions-title" className="ops-section-title">Sessions</h2></div>
          <NewTrainingModal kind="session" />
        </div>

        <div className="ops-stack" style={{ gap: 20 }}>
          <div>
            <span className="ops-label">Upcoming</span>
            {upcoming.length === 0 ? (
              <p className="ops-body" style={{ marginTop: 8 }}>No upcoming sessions.</p>
            ) : (
              <div className="ops-list">
                {upcoming.map((s) => (
                  <article className="ops-list-row ops-list-row--compact" key={s.id}>
                    <div>
                      <Link className="ops-record-name" style={{ fontSize: 15 }} href={`/app/training/sessions/${s.id}`}>{s.title}</Link>
                      <span className="ops-record-meta">{formatDateTimeInZone(s.scheduledAt, s.timeZone)}</span>
                    </div>
                    <div>{s.required && <Badge status="warning">Required</Badge>}</div>
                    <Button href={`/app/training/sessions/${s.id}`} variant="secondary" size="sm">View</Button>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div>
            <span className="ops-label">Past</span>
            {past.length === 0 ? (
              <p className="ops-body" style={{ marginTop: 8 }}>No past sessions.</p>
            ) : (
              <div className="ops-list">
                {past.map((s) => (
                  <article className="ops-list-row ops-list-row--compact" key={s.id}>
                    <div>
                      <Link className="ops-record-name" style={{ fontSize: 15 }} href={`/app/training/sessions/${s.id}`}>{s.title}</Link>
                      <span className="ops-record-meta">{formatDateTimeInZone(s.scheduledAt, s.timeZone)}</span>
                    </div>
                    <div />
                    <Button href={`/app/training/sessions/${s.id}`} variant="secondary" size="sm">View</Button>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="ops-panel ops-panel--flat" aria-labelledby="training-overview-title">
        <div className="ops-section-head">
          <div><span className="ops-label">Pipeline status</span><h2 id="training-overview-title" className="ops-section-title">Training overview</h2></div>
        </div>
        <div className="ops-meta-grid">
          {TRAINING_BUCKET_ORDER.map((bucket) => {
            const rows = byTraining.get(bucket) ?? [];
            return (
              <div className="ops-meta" key={bucket}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span className="ops-label">{TRAINING_BUCKET_LABEL[bucket]}</span>
                  <Badge status={bucket === "behind" ? "negative" : bucket === "complete" ? "positive" : "neutral"}>{rows.length}</Badge>
                </div>
                {rows.length === 0 ? (
                  <span className="ops-value">None</span>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 5 }}>
                    {rows.map((i) => (
                      <Link key={i.id} className="ops-inline-link" href={`/app/instructors/${i.id}`}>
                        {i.person?.name ?? i.id}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
