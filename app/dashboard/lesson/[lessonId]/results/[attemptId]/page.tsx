import { redirect } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { sqlLearn } from "@/lib/db-sql";
import { migrateLessonDoc } from "@/lib/learn/compat";
import Button from "@/components/ds/Button";
import DataStrip, { type DataItem } from "@/components/ds/DataStrip";

interface AttemptRow {
  id: string;
  user_id: string;
  lesson_id: string;
  version_id: string;
  status: string;
  score: number | null;
  stars: number | null;
  xp_awarded: number | null;
  variables: Record<string, number>;
}

export default async function LessonResultsPage({
  params,
}: {
  params: Promise<{ lessonId: string; attemptId: string }>;
}) {
  const { lessonId, attemptId } = await params;
  const user = await requireRole("student", "admin");

  const attemptRows = await sqlLearn<AttemptRow[]>`
    SELECT id, user_id, lesson_id, version_id, status, score, stars, xp_awarded, variables
    FROM learn_attempts WHERE id = ${attemptId}
  `;
  const attempt = attemptRows[0];
  if (!attempt || attempt.user_id !== user.id || attempt.lesson_id !== lessonId || attempt.status !== "completed") {
    redirect(`/dashboard/lesson/${lessonId}`);
  }

  const lessonRows = await sqlLearn<{ title: string }[]>`SELECT title FROM learn_lessons WHERE id = ${lessonId}`;
  const versionRows = await sqlLearn<{ doc: unknown }[]>`SELECT doc FROM learn_lesson_versions WHERE id = ${attempt.version_id}`;
  const doc = migrateLessonDoc(versionRows[0].doc);

  let nextLesson: { id: string; title: string } | null = null;
  if (doc.results.ctaNextLessonId) {
    const nextRows = await sqlLearn<{ id: string; title: string }[]>`
      SELECT id, title FROM learn_lessons WHERE id = ${doc.results.ctaNextLessonId} AND lifecycle = 'active'
    `;
    nextLesson = nextRows[0] ?? null;
  }

  const skillRows = await sqlLearn<{ skill_id: string; points: number; label: string }[]>`
    SELECT se.skill_id, se.points, ls.label
    FROM learn_skill_events se
    JOIN learn_skills ls ON ls.id = se.skill_id
    WHERE se.attempt_id = ${attemptId}
  `;

  // Manual-review feedback (Stage 8 follow-up): if this attempt had any
  // long_text manual_review blocks, show their review status here — pending
  // ones read "awaiting instructor review", approved ones show the points +
  // feedback note the instructor left.
  const reviewRows = await sqlLearn<{
    status: string; points_awarded: number | null; points_possible: number; feedback: string | null; prompt: string | null;
  }[]>`
    SELECT status, points_awarded, points_possible, feedback, prompt
    FROM learn_manual_reviews WHERE attempt_id = ${attemptId} ORDER BY created_at ASC
  `;

  const score = attempt.score ?? 0;
  const stars = attempt.stars ?? 0;
  const xp = attempt.xp_awarded ?? 0;

  const variableItems: DataItem[] = doc.results.showVariables
    ? doc.variables.map((v) => {
        const value = attempt.variables[v.key] ?? v.initial;
        const display =
          v.unit === "currency"
            ? `$${Math.round(value).toLocaleString()}`
            : v.unit === "percent"
              ? `${Math.round(value)}%`
              : String(Math.round(value));
        return { label: v.label, value: display };
      })
    : [];

  return (
    <div className="bow-front-office" style={{ minHeight: "100vh", background: "var(--bow-ink)", color: "#fff", padding: "clamp(24px,4vw,48px) clamp(16px,4vw,24px) 96px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 28 }}>
        <div>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9a9da6" }}>
            {lessonRows[0]?.title ?? "Lesson"} · Results
          </span>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 40, margin: "8px 0 0" }}>{score}<span style={{ fontSize: 20, color: "#9a9da6" }}> / 100</span></h1>
        </div>

        <div style={{ display: "flex", gap: 10 }} aria-label={`${stars} of 3 stars`}>
          {[1, 2, 3].map((n) => (
            <span key={n} style={{ fontSize: 32, color: n <= stars ? "var(--bow-orange-solid)" : "#3a3d46" }} aria-hidden="true">
              ★
            </span>
          ))}
        </div>

        <div
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 18,
            color: "var(--bow-positive)",
          }}
        >
          +{xp} XP
        </div>

        {variableItems.length > 0 && (
          <div>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 14, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9a9da6", marginBottom: 10 }}>
              How your decisions played out
            </h2>
            <DataStrip items={variableItems} dark />
          </div>
        )}

        {doc.results.showSkillDeltas && skillRows.length > 0 && (
          <div>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 14, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9a9da6", marginBottom: 10 }}>
              Skill growth
            </h2>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              {skillRows.map((s) => (
                <li key={s.skill_id} style={{ fontSize: 15 }}>
                  {s.label}: <strong>+{s.points}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}

        {reviewRows.length > 0 && (
          <div>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 14, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9a9da6", marginBottom: 10 }}>
              Instructor review
            </h2>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {reviewRows.map((r, i) => (
                <li key={i} style={{ background: "rgba(255,255,255,0.06)", borderRadius: 6, padding: 14 }}>
                  {r.status === "pending" ? (
                    <p style={{ margin: 0, fontSize: 14, color: "#c7c9cf" }}>Awaiting instructor review.</p>
                  ) : (
                    <>
                      <p style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700 }}>
                        {r.points_awarded ?? 0} / {r.points_possible} points
                      </p>
                      {r.feedback && <p style={{ margin: 0, fontSize: 14, color: "#c7c9cf" }}>{r.feedback}</p>}
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {doc.results.celebrationCopy && (
          <p style={{ fontSize: 16, color: "#c7c9cf" }}>{doc.results.celebrationCopy}</p>
        )}

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {nextLesson && (
            <Button variant="emphasis" href={`/dashboard/lesson/${nextLesson.id}`} aria-label={`Continue to ${nextLesson.title}`}>
              Next: {nextLesson.title}
            </Button>
          )}
          <Button variant={nextLesson ? "secondary" : "emphasis"} href={`/dashboard/lesson/${lessonId}`} aria-label="Replay lesson">
            Replay
          </Button>
          <Button variant="secondary" href="/dashboard" aria-label="Continue to dashboard">
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
