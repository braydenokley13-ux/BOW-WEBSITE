"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppState } from "@/components/app/AppState";
import { trackLessons, lessonProgressLabel } from "@/lib/account";
import { getLessonById } from "@/lib/lessons";

export default function StudentLessonPage() {
  const {
    me,
    selectedLessonId,
    getCohort,
    activeEnrollmentFor,
    cohortCurrentLessonId,
    lessonProgressFor,
    startLesson,
    setSimulationDone,
    saveReflection,
    setChallengeDone,
    completeLesson,
  } = useAppState();
  const router = useRouter();

  const enr = activeEnrollmentFor(me.id);
  const cohort = enr ? getCohort(enr.cohortId) : null;

  const lessons = cohort ? trackLessons(cohort.track) : [];
  const curId = cohort ? cohortCurrentLessonId(cohort) : null;
  const lid = selectedLessonId ?? curId ?? lessons[0]?.id ?? "t101-m2-l1";
  const L = getLessonById(lid);

  const prog = lessonProgressFor(me.id, lid);
  const [reflection, setReflection] = useState(prog?.reflection ?? "");

  if (!cohort || !L) {
    return (
      <div style={{ background: "var(--bow-paper)", minHeight: "calc(100vh - 60px)", padding: "clamp(24px,4vw,44px) clamp(16px,4vw,32px) 96px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <p style={{ fontFamily: "var(--font-interface)", fontSize: 16, color: "var(--bow-slate)" }}>This lesson isn’t available yet.</p>
        </div>
      </div>
    );
  }

  const lessonIdx = lessons.findIndex((l) => l.id === lid);
  const curIdx = lessons.findIndex((l) => l.id === curId);
  const inDev = L.status === "in-development" || L.status === "coming-soon";
  const locked = inDev || lessonIdx > curIdx;
  const status = prog?.status ?? "not-started";
  const completed = status === "completed";

  const primaryLabel = completed ? "Review Lesson" : status === "in-progress" ? "Continue Lesson" : "Start Lesson";

  const steps: { key: string; label: string; desc: string; done: boolean; render: () => React.ReactNode }[] = [
    {
      key: "start",
      label: "Open the case",
      desc: "Read the front-office brief and your role in it.",
      done: status !== "not-started",
      render: () =>
        status === "not-started" ? (
          <button onClick={() => startLesson(lid)} style={primaryBtn}>Start Lesson</button>
        ) : (
          <span style={doneTag}>Started{prog?.startedAt ? ` · ${prog.startedAt}` : ""}</span>
        ),
    },
    {
      key: "sim",
      label: "Make the call (simulation)",
      desc: "Run the decision and see the consequence play out.",
      done: !!prog?.simulationDone,
      render: () =>
        prog?.simulationDone ? (
          <button onClick={() => setSimulationDone(lid, false)} style={ghostBtn}>Undo</button>
        ) : (
          <button onClick={() => setSimulationDone(lid, true)} style={primaryBtn}>Mark simulation complete</button>
        ),
    },
    {
      key: "reflect",
      label: "Name the economics",
      desc: "In a sentence or two, explain the trade-off you just made.",
      done: !!prog?.reflection?.trim(),
      render: () => (
        <div style={{ width: "100%" }}>
          <textarea
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            rows={3}
            placeholder="The cost wasn't the salary — it was the win we passed up…"
            style={{ width: "100%", background: "var(--bow-paper)", border: "1px solid var(--border-rule)", color: "var(--bow-ink)", padding: "11px 13px", borderRadius: 4, fontFamily: "var(--font-interface)", fontSize: 14, resize: "vertical" }}
          />
          <button onClick={() => saveReflection(lid, reflection)} style={{ ...primaryBtn, marginTop: 10 }}>Save reflection</button>
        </div>
      ),
    },
    {
      key: "challenge",
      label: "Real-world challenge",
      desc: "Connect the principle to how sports actually works.",
      done: !!prog?.challengeDone,
      render: () =>
        prog?.challengeDone ? (
          <button onClick={() => setChallengeDone(lid, false)} style={ghostBtn}>Undo</button>
        ) : (
          <button onClick={() => setChallengeDone(lid, true)} style={primaryBtn}>Mark challenge complete</button>
        ),
    },
  ];

  const allDone = status !== "not-started" && !!prog?.simulationDone && !!prog?.reflection?.trim() && !!prog?.challengeDone;

  return (
    <div style={{ background: "var(--bow-paper)", minHeight: "calc(100vh - 60px)", padding: "clamp(20px,3vw,36px) clamp(16px,4vw,32px) 96px" }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <span onClick={() => router.push("/app/student/track")} style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)", cursor: "pointer", display: "inline-block", marginBottom: 18 }}>
          ← My Track
        </span>

        {/* case-file header */}
        <div style={{ background: "var(--bow-ink)", color: "#fff", borderRadius: 6, padding: "clamp(24px,3.5vw,40px)", marginBottom: 22, position: "relative", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6f8bff" }}>{L.caseNumber} · Module {String(L.moduleNumber).padStart(2, "0")} · {L.moduleTitle}</span>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "#fff", background: "rgba(49,87,255,0.2)", padding: "4px 11px", borderRadius: 3 }}>{locked ? "Locked" : lessonProgressLabel(status)}</span>
          </div>
          <h1 style={{ margin: "0 0 16px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(30px,4.5vw,52px)", lineHeight: 0.95, letterSpacing: "-0.02em", textTransform: "uppercase" }}>{L.title}</h1>
          <p style={{ margin: "0 0 22px", fontFamily: "var(--font-editorial)", fontSize: "clamp(17px,1.8vw,22px)", lineHeight: 1.45, color: "#d4d6db", maxWidth: 600 }}>{L.centralQuestion}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            {!locked && (
              <button onClick={() => (status === "not-started" ? startLesson(lid) : undefined)} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, letterSpacing: "0.05em", textTransform: "uppercase", padding: "14px 28px", border: "none", background: "var(--bow-blue)", color: "#fff", borderRadius: 4, cursor: status === "not-started" ? "pointer" : "default" }}>{primaryLabel}</button>
            )}
            <span style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9a9da6" }}>Role · {L.role} · {L.duration}</span>
          </div>
        </div>

        {locked ? (
          <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 24 }}>
            <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.6, color: "var(--bow-slate)" }}>
              {inDev ? "This lesson is still in development." : "This lesson opens when your instructor advances the cohort. Finish your current lesson in the meantime."}
            </p>
          </div>
        ) : (
          <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Work through this lesson</span>
              {completed && <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-positive)" }}>Completed{prog?.completedAt ? ` · ${prog.completedAt}` : ""}</span>}
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              {steps.map((s) => (
                <div key={s.key} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "16px 0", borderBottom: "1px solid var(--border-rule)" }}>
                  <span style={{ width: 11, height: 11, borderRadius: 999, background: s.done ? "var(--bow-positive)" : "var(--bow-inactive)", flexShrink: 0, marginTop: 5 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, textTransform: "uppercase", letterSpacing: "-0.01em", color: "var(--bow-ink)" }}>{s.label}</span>
                    <p style={{ margin: "3px 0 12px", fontFamily: "var(--font-interface)", fontSize: 13.5, lineHeight: 1.5, color: "var(--bow-slate)" }}>{s.desc}</p>
                    {s.render()}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
              <span style={{ fontFamily: "var(--font-interface)", fontSize: 13, color: "var(--bow-slate)" }}>
                {completed ? "You’ve completed this lesson." : allDone ? "All steps done — lock it in." : "Finish the steps above to complete the lesson."}
              </span>
              {!completed && (
                <button onClick={() => completeLesson(lid)} disabled={!allDone} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, letterSpacing: "0.05em", textTransform: "uppercase", padding: "13px 24px", border: "none", background: allDone ? "var(--bow-positive)" : "var(--bow-inactive)", color: "#fff", borderRadius: 4, cursor: allDone ? "pointer" : "not-allowed" }}>Complete Lesson</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: 12.5,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  padding: "9px 16px",
  border: "none",
  background: "var(--bow-ink)",
  color: "#fff",
  borderRadius: 4,
  cursor: "pointer",
};
const ghostBtn: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: 12,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  padding: "8px 14px",
  border: "1px solid var(--border-rule)",
  background: "transparent",
  color: "var(--bow-slate)",
  borderRadius: 4,
  cursor: "pointer",
};
const doneTag: React.CSSProperties = {
  fontFamily: "var(--font-data)",
  fontSize: 11,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--bow-positive)",
};
