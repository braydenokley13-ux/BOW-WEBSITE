"use client";

import { useRouter } from "next/navigation";
import { useAppState } from "@/components/app/AppState";
import { enrollments, getCohort, getUser, trackLessons, type LessonProgress } from "@/lib/account";
import type { Lesson } from "@/lib/lessons";

type LessonState = "completed" | "current" | "in-development" | "locked";

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

export default function StudentTrackPage() {
  const { me, cohortCurrentLessonId, setSelectedLessonId } = useAppState();
  const router = useRouter();

  const student = me ?? getUser("u-s1");
  if (!student) return null;

  const enr = enrollments.find((e) => e.userId === student.id) ?? enrollments.find((e) => e.userId === "u-s1");
  if (!enr) return null;

  const cohort = getCohort(enr.cohortId);
  if (!cohort) return null;
  const lessons = trackLessons(cohort.track);
  const curId = cohortCurrentLessonId(cohort);
  const curIdx = lessons.findIndex((l) => l.id === curId);
  const myStatus: LessonProgress = enr.lessonStatus;

  const openStudentLesson = (id: string) => {
    setSelectedLessonId(id);
    router.push("/app/student/lesson");
  };

  const progress: ProgressRow[] = lessons.map((l: Lesson, i: number) => {
    let st: LessonState;
    let lockReason = "";
    if (i < curIdx) st = "completed";
    else if (i === curIdx) st = myStatus === "completed" ? "completed" : "current";
    else if (l.status === "in-development" || l.status === "coming-soon") {
      st = "in-development";
      lockReason = "This lesson is still in development.";
    } else {
      st = "locked";
      lockReason = i === curIdx + 1 ? "Your instructor will open this lesson next." : "Complete the current lesson first.";
    }
    const dot =
      st === "completed"
        ? "var(--bow-positive)"
        : st === "current"
        ? "var(--bow-blue)"
        : st === "in-development"
        ? "var(--bow-warning)"
        : "var(--bow-inactive)";
    const stLabel =
      st === "completed" ? "Completed" : st === "current" ? "Current" : st === "in-development" ? "In Development" : "Locked";
    const accessible = st === "completed" || st === "current";
    return {
      id: l.id,
      n: "L" + l.lessonNumber,
      mod: l.moduleNumber,
      moduleTitle: l.moduleTitle,
      title: l.title,
      centralQuestion: l.centralQuestion || l.summary,
      concepts: (l.concepts || []).join(" · "),
      st,
      stLabel,
      dot,
      lockReason,
      accessible,
      action: st === "completed" ? "Review Lesson" : st === "current" ? (myStatus === "in-progress" ? "Continue Lesson" : "Start Lesson") : null,
    };
  });

  const completedCount = progress.filter((p) => p.st === "completed").length;

  // group into modules for the track view
  const modMap: Record<number, ModuleGroup> = {};
  progress.forEach((p) => {
    if (!modMap[p.mod]) modMap[p.mod] = { n: "Module " + String(p.mod).padStart(2, "0"), title: p.moduleTitle, lessons: [] };
    modMap[p.mod].lessons.push(p);
  });
  const modules: ModuleGroup[] = Object.keys(modMap)
    .sort()
    .map((k) => modMap[Number(k)]);

  const sv = {
    cohort: cohort.name,
    grade: student.grade ?? "",
    trackName: cohort.track === "101" ? "Track 101 · Foundations" : "Track 201 · Advanced",
    completedCount,
    total: lessons.length,
    currentN: curIdx + 1,
  };

  return (
    <div style={{ background: "var(--bow-paper)", minHeight: "calc(100vh - 60px)", padding: "clamp(24px,4vw,44px) clamp(16px,4vw,32px) 96px" }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
          {sv.cohort} · {sv.grade}
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
