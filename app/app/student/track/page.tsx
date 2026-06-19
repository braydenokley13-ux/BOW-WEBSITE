"use client";

import { useRouter } from "next/navigation";
import { useAppState } from "@/components/app/AppState";
import { trackLessons } from "@/lib/account";
import type { Lesson } from "@/lib/lessons";

type LessonState = "completed" | "current" | "available" | "in-development" | "locked";

interface ProgressRow {
  id: string;
  n: string;
  mod: number;
  moduleTitle: string;
  title: string;
  centralQuestion: string;
  concepts: string;
  st: LessonState;
  stLabel: string;
  dot: string;
  lockReason: string;
  accessible: boolean;
  action: string | null;
}

interface ModuleGroup {
  n: string;
  title: string;
  lessons: ProgressRow[];
}

const DOT: Record<LessonState, string> = {
  completed: "var(--bow-positive)",
  current: "var(--bow-blue)",
  available: "var(--bow-blue)",
  "in-development": "var(--bow-warning)",
  locked: "var(--bow-inactive)",
};
const LABEL: Record<LessonState, string> = {
  completed: "Completed",
  current: "Current",
  available: "Available",
  "in-development": "In Development",
  locked: "Locked",
};

export default function StudentTrackPage() {
  const { me, getCohort, activeEnrollmentFor, cohortCurrentLessonId, lessonProgressFor, setSelectedLessonId } = useAppState();
  const router = useRouter();

  const enr = activeEnrollmentFor(me.id);
  const cohort = enr ? getCohort(enr.cohortId) : null;

  if (!enr || !cohort) {
    return (
      <div style={{ background: "var(--bow-paper)", minHeight: "calc(100vh - 60px)", padding: "clamp(24px,4vw,44px) clamp(16px,4vw,32px) 96px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <h1 style={{ margin: "8px 0 14px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(30px,4vw,46px)", lineHeight: 0.94, letterSpacing: "-0.02em", textTransform: "uppercase", color: "var(--bow-ink)" }}>Your track</h1>
          <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 28 }}>
            <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 16, lineHeight: 1.6, color: "var(--bow-slate)" }}>Your track appears once you’re enrolled in a cohort.</p>
          </div>
        </div>
      </div>
    );
  }

  const lessons = trackLessons(cohort.track);
  const curId = cohortCurrentLessonId(cohort);
  const curIdx = lessons.findIndex((l) => l.id === curId);

  const openStudentLesson = (id: string) => {
    setSelectedLessonId(id);
    router.push("/app/student/lesson");
  };

  const progress: ProgressRow[] = lessons.map((l: Lesson, i: number) => {
    const prog = lessonProgressFor(me.id, l.id);
    let st: LessonState;
    let lockReason = "";
    if (prog?.status === "completed") st = "completed";
    else if (l.status === "in-development" || l.status === "coming-soon") {
      st = "in-development";
      lockReason = "This lesson is still in development.";
    } else if (i > curIdx) {
      st = "locked";
      lockReason = i === curIdx + 1 ? "Your instructor will open this lesson next." : "Complete the current lesson first.";
    } else if (i === curIdx) st = "current";
    else st = "available";
    const accessible = st === "completed" || st === "current" || st === "available";
    const action =
      st === "completed" ? "Review Lesson" : prog?.status === "in-progress" ? "Continue Lesson" : accessible ? "Start Lesson" : null;
    return {
      id: l.id,
      n: "L" + l.lessonNumber,
      mod: l.moduleNumber,
      moduleTitle: l.moduleTitle,
      title: l.title,
      centralQuestion: l.centralQuestion || l.summary,
      concepts: (l.concepts || []).join(" · "),
      st,
      stLabel: LABEL[st],
      dot: DOT[st],
      lockReason,
      accessible,
      action,
    };
  });

  const completedCount = progress.filter((p) => p.st === "completed").length;

  const modMap: Record<number, ModuleGroup> = {};
  progress.forEach((p) => {
    if (!modMap[p.mod]) modMap[p.mod] = { n: "Module " + String(p.mod).padStart(2, "0"), title: p.moduleTitle, lessons: [] };
    modMap[p.mod].lessons.push(p);
  });
  const modules: ModuleGroup[] = Object.keys(modMap).sort().map((k) => modMap[Number(k)]);

  const sv = {
    cohort: cohort.name,
    grade: me.grade ?? "",
    trackName: cohort.track === "101" ? "Track 101 · Foundations" : "Track 201 · Advanced",
    completedCount,
    total: lessons.length,
    currentN: curIdx + 1,
  };

  return (
    <div style={{ background: "var(--bow-paper)", minHeight: "calc(100vh - 60px)", padding: "clamp(24px,4vw,44px) clamp(16px,4vw,32px) 96px" }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
          {sv.cohort}{sv.grade ? ` · ${sv.grade}` : ""}
        </span>
        <h1 style={{ margin: "8px 0 6px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(32px,4.5vw,52px)", lineHeight: 0.94, letterSpacing: "-0.02em", textTransform: "uppercase", color: "var(--bow-ink)" }}>
          {sv.trackName}
        </h1>
        <p style={{ margin: "0 0 30px", fontFamily: "var(--font-interface)", fontSize: 15, color: "var(--bow-slate)" }}>
          {sv.completedCount} of {sv.total} lessons complete · You’re on lesson {sv.currentN}.
        </p>

        {modules.map((m) => (
          <div key={m.n} style={{ marginBottom: 26 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 12 }}>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-blue)" }}>{m.n}</span>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 17, textTransform: "uppercase", letterSpacing: "-0.01em", color: "var(--bow-ink)" }}>{m.title}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {m.lessons.map((p) => (
                <div key={p.id} style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderLeft: `3px solid ${p.dot}`, borderRadius: 5, padding: "16px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)", flexShrink: 0 }}>{p.n}</span>
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 17, textTransform: "uppercase", letterSpacing: "-0.01em", color: "var(--bow-ink)", flex: 1, minWidth: 0 }}>{p.title}</span>
                    <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: p.dot, flexShrink: 0 }}>{p.stLabel}</span>
                  </div>
                  <p style={{ margin: "8px 0 0", fontFamily: "var(--font-interface)", fontSize: 13.5, lineHeight: 1.5, color: "var(--bow-slate)" }}>{p.centralQuestion}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 12, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.04em", color: "var(--bow-slate)" }}>{p.concepts}</span>
                    {p.accessible && (
                      <button onClick={() => openStudentLesson(p.id)} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.05em", textTransform: "uppercase", padding: "8px 16px", border: "none", background: "var(--bow-ink)", color: "#fff", borderRadius: 4, cursor: "pointer" }}>{p.action}</button>
                    )}
                    {!!p.lockReason && (
                      <span style={{ fontFamily: "var(--font-interface)", fontSize: 12.5, fontStyle: "italic", color: "var(--bow-slate)" }}>{p.lockReason}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
