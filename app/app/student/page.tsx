"use client";

import { useRouter } from "next/navigation";
import { useAppState } from "@/components/app/AppState";
import {
  enrollments,
  getCohort,
  getOrg,
  getUser,
  trackLessons,
  lessonProgressLabel,
  type LessonProgress,
} from "@/lib/account";
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
  duration: string;
  st: LessonState;
  stLabel: string;
  dot: string;
  lockReason: string;
  accessible: boolean;
  cursor: string;
  action: string | null;
}

export default function StudentHomePage() {
  const { me, cohortCurrentLessonId, setSelectedLessonId } = useAppState();
  const router = useRouter();

  // The current student (the prototype always reads u-s1; here we use the
  // signed-in student, falling back to u-s1 so the screen always renders).
  const student = me ?? getUser("u-s1");
  if (!student) return null;

  const enr = enrollments.find((e) => e.userId === student.id) ?? enrollments.find((e) => e.userId === "u-s1");
  if (!enr) return null;

  const cohort = getCohort(enr.cohortId);
  if (!cohort) return null;
  const org = getOrg(cohort.orgId);
  const instr = getUser(cohort.instructorId);
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
      duration: l.duration,
      st,
      stLabel,
      dot,
      lockReason,
      accessible,
      cursor: accessible ? "pointer" : "default",
      action: st === "completed" ? "Review Lesson" : st === "current" ? (myStatus === "in-progress" ? "Continue Lesson" : "Start Lesson") : null,
    };
  });

  const cur = lessons[curIdx];
  const completedCount = progress.filter((p) => p.st === "completed").length;
  const continueAction = myStatus === "in-progress" ? "Continue Lesson" : myStatus === "completed" ? "Review Lesson" : "Start Lesson";

  const sv = {
    first: student.first,
    cohort: cohort.name,
    org: org ? org.name : "—",
    instructor: instr ? instr.name : "TBD",
    schedule: cohort.schedule,
    format: cohort.format,
    nextSession: cohort.nextSession,
    trackLabel: "Track " + cohort.track,
    completedCount,
    total: lessons.length,
    cur: cur
      ? {
          module: "Module " + String(cur.moduleNumber).padStart(2, "0") + " · " + cur.moduleTitle,
          title: cur.title,
          centralQuestion: cur.centralQuestion,
          duration: cur.duration,
          concepts: (cur.concepts || []).join(" · "),
          statusLabel: lessonProgressLabel(myStatus),
          action: continueAction,
        }
      : null,
    recent: [
      { text: "Your instructor opened “" + (cur ? cur.title : "") + "”", when: "2 h ago" },
      { text: "You completed “" + (lessons[curIdx - 1] ? lessons[curIdx - 1].title : "") + "”", when: "Last Thursday" },
      { text: "You started “" + (lessons[curIdx - 2] ? lessons[curIdx - 2].title : "") + "”", when: "Sep 16" },
      { text: "You joined " + cohort.name, when: "Sep 9" },
    ],
  };

  return (
    <div style={{ background: "var(--bow-paper)", minHeight: "calc(100vh - 60px)", padding: "clamp(24px,4vw,44px) clamp(16px,4vw,32px) 96px" }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
          {sv.trackLabel} · {sv.cohort}
        </span>
        <h1 style={{ margin: "8px 0 28px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(32px,4.5vw,52px)", lineHeight: 0.94, letterSpacing: "-0.02em", textTransform: "uppercase", color: "var(--bow-ink)" }}>
          Good to see you, {sv.first}.
        </h1>

        {/* DOMINANT CONTINUE CARD */}
        {sv.cur && (
          <div style={{ background: "var(--bow-ink)", color: "#fff", borderRadius: 6, borderTop: "4px solid var(--bow-blue)", padding: "clamp(24px,3.5vw,40px)", marginBottom: 28, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(49,87,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(49,87,255,0.06) 1px, transparent 1px)", backgroundSize: "40px 40px", opacity: 0.5 }} />
            <div style={{ position: "relative" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6f8bff" }}>Continue where you left off</span>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "#fff", background: "rgba(49,87,255,0.18)", padding: "4px 10px", borderRadius: 3 }}>{sv.cur.statusLabel}</span>
              </div>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9a9da6" }}>{sv.cur.module}</span>
              <h2 style={{ margin: "6px 0 14px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(28px,4vw,46px)", lineHeight: 0.98, letterSpacing: "-0.01em", textTransform: "uppercase" }}>{sv.cur.title}</h2>
              <p style={{ margin: "0 0 24px", fontFamily: "var(--font-editorial)", fontSize: "clamp(16px,1.6vw,20px)", lineHeight: 1.5, color: "#d4d6db", maxWidth: 560 }}>{sv.cur.centralQuestion}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
                <button onClick={() => openStudentLesson(cur.id)} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, letterSpacing: "0.05em", textTransform: "uppercase", padding: "14px 28px", border: "none", background: "var(--bow-blue)", color: "#fff", borderRadius: 4, cursor: "pointer" }}>{sv.cur.action}</button>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9a9da6" }}>{sv.cur.duration} · {sv.cur.concepts}</span>
              </div>
            </div>
          </div>
        )}

        {/* COHORT + NEXT SESSION */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginBottom: 28 }}>
          <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 22 }}>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 12 }}>Your cohort</span>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 20, textTransform: "uppercase", letterSpacing: "-0.01em", color: "var(--bow-ink)", display: "block", lineHeight: 1.05 }}>{sv.cohort}</span>
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-slate)" }}>{sv.org}</span>
              <span style={{ fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-slate)" }}>Instructor · {sv.instructor}</span>
              <span style={{ fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-slate)" }}>{sv.schedule}</span>
              <span style={{ fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-slate)" }}>{sv.format}</span>
            </div>
          </div>
          <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 22 }}>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 12 }}>Next session</span>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 20, textTransform: "uppercase", letterSpacing: "-0.01em", color: "var(--bow-ink)", display: "block", lineHeight: 1.05 }}>{sv.nextSession}</span>
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-slate)" }}>Lesson · {sv.cur ? sv.cur.title : "—"}</span>
              <span style={{ fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-slate)" }}>With {sv.instructor}</span>
              <span style={{ fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-slate)" }}>{sv.format}</span>
            </div>
          </div>
        </div>

        {/* PROGRESS */}
        <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 24, marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 18, gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Your progress</span>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 13, color: "var(--bow-ink)" }}>{sv.completedCount} of {sv.total} lessons complete</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {progress.map((p) => (
              <div
                key={p.id}
                onClick={p.accessible ? () => openStudentLesson(p.id) : undefined}
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 0", borderBottom: "1px solid var(--border-rule)", cursor: p.cursor }}
              >
                <span style={{ width: 10, height: 10, borderRadius: 999, background: p.dot, flexShrink: 0 }} />
                <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)", width: 30, flexShrink: 0 }}>{p.n}</span>
                <span style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 14.5, color: "var(--bow-ink)", flex: 1, minWidth: 0 }}>{p.title}</span>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: p.dot, flexShrink: 0 }}>{p.stLabel}</span>
              </div>
            ))}
          </div>
        </div>

        {/* RECENT ACTIVITY */}
        <div>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 12 }}>Recent activity</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {sv.recent.map((r, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border-rule)" }}>
                <span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--bow-blue)", flexShrink: 0 }} />
                <span style={{ fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-ink)", flex: 1 }}>{r.text}</span>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)", flexShrink: 0 }}>{r.when}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
