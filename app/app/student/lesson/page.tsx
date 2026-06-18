"use client";

import { useRouter } from "next/navigation";
import { useAppState } from "@/components/app/AppState";
import { enrollments, getCohort, getUser, trackLessons, lessonProgressLabel } from "@/lib/account";
import { getLessonById } from "@/lib/lessons";

type LessonStatus = "completed" | "in-progress" | "locked";
type JourneyState = "complete" | "active" | "locked";

interface JourneyRow {
  n: string;
  label: string;
  desc: string;
  st: JourneyState;
  dot: string;
  stLabel: string;
}

const JOURNEY_DEFS: [string, string][] = [
  ["Case Setup", "Meet the situation and your role."],
  ["Learn the Situation", "Read the front-office brief and the evidence."],
  ["Sports Decision", "Make the call the GM has to make."],
  ["Economic Reveal", "See the economics behind your choice."],
  ["Real-World Challenge", "Connect it to how sports actually works."],
  ["Completion", "Lock it in and debrief with your cohort."],
];

export default function StudentLessonPage() {
  const { me, selectedLessonId, cohortCurrentLessonId } = useAppState();
  const router = useRouter();

  const student = me ?? getUser("u-s1");
  if (!student) return null;

  const enr = enrollments.find((e) => e.userId === student.id) ?? enrollments.find((e) => e.userId === "u-s1");
  if (!enr) return null;

  const cohort = getCohort(enr.cohortId);
  if (!cohort) return null;

  const curId = cohortCurrentLessonId(cohort);
  // Read the selected lesson; fall back to the cohort's current lesson.
  const lid = selectedLessonId ?? curId ?? "t101-m2-l1";
  const L = getLessonById(lid);

  const lessons = trackLessons(cohort.track);
  const isCurrent = lid === curId;
  const isPast = lessons.findIndex((l) => l.id === lid) < lessons.findIndex((l) => l.id === curId);
  const lessonStatus: LessonStatus = isPast
    ? "completed"
    : isCurrent
    ? enr.lessonStatus === "completed"
      ? "completed"
      : "in-progress"
    : "locked";

  // demo progression: in-progress lesson sits at stage 2
  const atStage = lessonStatus === "completed" ? 6 : lessonStatus === "in-progress" ? 2 : 0;
  const journey: JourneyRow[] = JOURNEY_DEFS.map((d, i) => {
    let st: JourneyState = i < atStage ? "complete" : i === atStage ? (lessonStatus === "locked" ? "locked" : "active") : "locked";
    if (lessonStatus === "completed") st = "complete";
    return {
      n: String(i + 1).padStart(2, "0"),
      label: d[0],
      desc: d[1],
      st,
      dot: st === "complete" ? "var(--bow-positive)" : st === "active" ? "var(--bow-blue)" : "var(--bow-inactive)",
      stLabel: st === "complete" ? "Complete" : st === "active" ? "In Progress" : i >= 2 ? "Designed — not yet interactive" : "Locked",
    };
  });

  const slv = {
    title: L ? L.title : "",
    module: L ? "Module " + String(L.moduleNumber).padStart(2, "0") + " · " + L.moduleTitle : "",
    caseNumber: L ? L.caseNumber : "",
    centralQuestion: L ? L.centralQuestion : "",
    role: L ? L.role : "",
    duration: L ? L.duration : "",
    cohort: cohort.name,
    statusLabel: lessonStatus === "locked" ? "Locked" : lessonProgressLabel(lessonStatus),
    action: lessonStatus === "completed" ? "Review Lesson" : lessonStatus === "in-progress" ? "Continue Lesson" : "Start Lesson",
    sessionState: isCurrent
      ? "This lesson is live with your cohort."
      : isPast
      ? "Completed with your cohort."
      : "Opens when your instructor advances the cohort.",
    journey,
  };

  return (
    <div style={{ background: "var(--bow-paper)", minHeight: "calc(100vh - 60px)", padding: "clamp(20px,3vw,36px) clamp(16px,4vw,32px) 96px" }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <span
          onClick={() => router.push("/app/student/track")}
          style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)", cursor: "pointer", display: "inline-block", marginBottom: 18 }}
        >
          ← My Track
        </span>

        {/* case-file header */}
        <div style={{ background: "var(--bow-ink)", color: "#fff", borderRadius: 6, padding: "clamp(24px,3.5vw,40px)", marginBottom: 22, position: "relative", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6f8bff" }}>{slv.caseNumber} · {slv.module}</span>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "#fff", background: "rgba(49,87,255,0.2)", padding: "4px 11px", borderRadius: 3 }}>{slv.statusLabel}</span>
          </div>
          <h1 style={{ margin: "0 0 16px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(30px,4.5vw,52px)", lineHeight: 0.95, letterSpacing: "-0.02em", textTransform: "uppercase" }}>{slv.title}</h1>
          <p style={{ margin: "0 0 22px", fontFamily: "var(--font-editorial)", fontSize: "clamp(17px,1.8vw,22px)", lineHeight: 1.45, color: "#d4d6db", maxWidth: 600 }}>{slv.centralQuestion}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <button onClick={(e) => e.stopPropagation()} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, letterSpacing: "0.05em", textTransform: "uppercase", padding: "14px 28px", border: "none", background: "var(--bow-blue)", color: "#fff", borderRadius: 4, cursor: "pointer" }}>{slv.action}</button>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9a9da6" }}>Role · {slv.role} · {slv.duration}</span>
          </div>
        </div>

        {/* account context strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 1, background: "var(--border-rule)", border: "1px solid var(--border-rule)", borderRadius: 6, overflow: "hidden", marginBottom: 26 }}>
          <div style={{ background: "var(--bow-white)", padding: "14px 16px" }}>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 4 }}>Cohort</span>
            <span style={{ fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-ink)" }}>{slv.cohort}</span>
          </div>
          <div style={{ background: "var(--bow-white)", padding: "14px 16px" }}>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 4 }}>Status</span>
            <span style={{ fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-ink)" }}>{slv.statusLabel}</span>
          </div>
          <div style={{ background: "var(--bow-white)", padding: "14px 16px" }}>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 4 }}>Session</span>
            <span style={{ fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-ink)" }}>{slv.sessionState}</span>
          </div>
        </div>

        {/* lesson journey (designed states) */}
        <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 24 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Lesson journey</span>
            <span style={{ fontFamily: "var(--font-interface)", fontSize: 12, fontStyle: "italic", color: "var(--bow-slate)" }}>Designed flow — interactive stages arrive in a later phase.</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 12 }}>
            {slv.journey.map((j) => (
              <div key={j.n} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 0", borderBottom: "1px solid var(--border-rule)" }}>
                <span style={{ width: 11, height: 11, borderRadius: 999, background: j.dot, flexShrink: 0, marginTop: 4 }} />
                <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)", flexShrink: 0, width: 26 }}>{j.n}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, textTransform: "uppercase", letterSpacing: "-0.01em", color: "var(--bow-ink)" }}>{j.label}</span>
                  <p style={{ margin: "3px 0 0", fontFamily: "var(--font-interface)", fontSize: 13.5, lineHeight: 1.5, color: "var(--bow-slate)" }}>{j.desc}</p>
                </div>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.05em", textTransform: "uppercase", color: j.dot, flexShrink: 0, textAlign: "right", maxWidth: 130 }}>{j.stLabel}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
