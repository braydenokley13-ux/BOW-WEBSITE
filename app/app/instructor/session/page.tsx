"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppState } from "@/components/app/AppState";
import { nextLessonInTrack, type AttendanceState } from "@/lib/account";
import { getLessonById } from "@/lib/lessons";

const STAGE_DEFS = [
  "Open the case",
  "Introduce the situation",
  "Review the evidence",
  "Launch the sports decision",
  "Discuss the consequence",
  "Reveal the economics",
  "Connect beyond sports",
  "Close the session",
];

interface AttRow {
  id: string;
  name: string;
  state: AttendanceState;
}

export default function InstructorSessionPage() {
  const router = useRouter();
  const {
    selectedCohortId,
    getCohort,
    getOrg,
    cohortRoster,
    cohortCurrentLessonId,
    attendanceOf,
    setAttendance,
    advanceCohortLesson,
    addSessionNote,
    askConfirm,
    showToast,
  } = useAppState();

  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionStage, setSessionStage] = useState(0);
  const [noteDraft, setNoteDraft] = useState("");

  const c = getCohort(selectedCohortId) ?? getCohort("coh-1");
  if (!c) return null;

  const org = getOrg(c.orgId);
  const curId = cohortCurrentLessonId(c);
  const L = curId ? getLessonById(curId) ?? null : null;

  const roster = cohortRoster(c.id);
  const activeRoster = roster.filter((e) => e.enroll === "active" || e.enroll === "suspended");

  const attRows: AttRow[] = activeRoster.map((e) => ({
    id: e.userId,
    name: e.user.name,
    state: attendanceOf(c.id, e.userId, "none"),
  }));

  const snap = {
    notStarted: roster.filter((r) => r.lessonStatus === "not-started" && r.enroll !== "invited").length,
    inProgress: roster.filter((r) => r.lessonStatus === "in-progress" && r.enroll !== "invited").length,
    complete: roster.filter((r) => r.lessonStatus === "completed").length,
    invited: roster.filter((r) => r.enroll === "invited").length,
  };

  const noStudents = activeRoster.length === 0;
  const nextLesson = nextLessonInTrack(c.track, curId);

  const stages = STAGE_DEFS.map((s, i) => ({
    n: String(i + 1).padStart(2, "0"),
    label: s,
    dot: i < sessionStage ? "var(--bow-positive)" : i === sessionStage ? "var(--bow-blue)" : "var(--bow-inactive)",
  }));

  const mark = (uid: string, state: AttendanceState) => setAttendance(c.id, uid, state);
  const markAllPresent = () => activeRoster.forEach((e) => setAttendance(c.id, e.userId, "present"));

  const onComplete = () =>
    askConfirm({
      title: "Complete this session?",
      body: "This wraps the session for the cohort. Attendance is already saved; you can still edit it afterward.",
      confirmLabel: "Complete Session",
      tone: "info",
      onConfirm: () => {
        setSessionStarted(false);
        showToast("Session completed");
      },
    });

  const onAdvance = () =>
    askConfirm({
      title: "Advance the cohort?",
      body: nextLesson
        ? `Students will get access to “${nextLesson.title}”. The current lesson stays available for review.`
        : "This is the final lesson.",
      confirmLabel: "Advance Lesson",
      tone: "info",
      onConfirm: () => advanceCohortLesson(c.id, nextLesson ? nextLesson.id : null),
    });

  const addNote = () => {
    const text = noteDraft.trim();
    if (!text) return;
    addSessionNote(c.id, "Session · " + c.name, text);
    setNoteDraft("");
  };

  const goBack = () => router.push("/app/instructor");

  const attBtn = (active: boolean, accent: string) => ({
    bg: active ? accent : "transparent",
    color: active ? "#fff" : "var(--bow-slate)",
    border: active ? accent : "var(--border-rule)",
  });

  return (
    <div style={{ background: "var(--bow-paper)", minHeight: "calc(100vh - 60px)", padding: "clamp(20px,3vw,36px) clamp(16px,4vw,32px) 96px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <span onClick={goBack} style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)", cursor: "pointer", display: "inline-block", marginBottom: 14 }}>← Today</span>

        {/* session header */}
        <div style={{ background: "var(--bow-ink)", color: "#fff", borderRadius: 6, borderTop: "4px solid var(--bow-positive)", padding: "clamp(22px,3vw,32px)", marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#5fcf99" }}>Live session · {c.nextSession}</span>
              <h1 style={{ margin: "8px 0 4px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(26px,3.6vw,42px)", lineHeight: 0.98, letterSpacing: "-0.01em", textTransform: "uppercase" }}>{c.name}</h1>
              <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, color: "#b9bcc4" }}>{(org?.name ?? "—") + " · " + activeRoster.length + " students"}</p>
            </div>
            {sessionStarted ? (
              <button onClick={onComplete} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, letterSpacing: "0.05em", textTransform: "uppercase", padding: "13px 24px", border: "none", background: "var(--bow-positive)", color: "#fff", borderRadius: 4, cursor: "pointer" }}>Complete Session</button>
            ) : (
              <button onClick={() => { setSessionStarted(true); setSessionStage(0); }} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, letterSpacing: "0.05em", textTransform: "uppercase", padding: "13px 24px", border: "none", background: "var(--bow-blue)", color: "#fff", borderRadius: 4, cursor: "pointer" }}>Start Session</button>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.15fr", gap: 22, alignItems: "start" }}>
          {/* LEFT: lesson brief + stages */}
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {L && (
              <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 22 }}>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 10 }}>Lesson brief</span>
                <h2 style={{ margin: "0 0 8px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 22, textTransform: "uppercase", letterSpacing: "-0.01em", color: "var(--bow-ink)", lineHeight: 1.0 }}>{L.title}</h2>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)" }}>{"Module " + String(L.moduleNumber).padStart(2, "0") + " · " + L.moduleTitle}</span>
                <p style={{ margin: "14px 0 16px", fontFamily: "var(--font-editorial)", fontSize: 17, lineHeight: 1.5, color: "var(--bow-ink)" }}>{L.centralQuestion}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 14, borderTop: "1px solid var(--border-rule)" }}>
                  <div style={{ display: "flex", gap: 10 }}><span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)", width: 80 }}>Role</span><span style={{ fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-ink)" }}>{L.role}</span></div>
                  <div style={{ display: "flex", gap: 10 }}><span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)", width: 80 }}>Duration</span><span style={{ fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-ink)" }}>{L.duration}</span></div>
                  <div style={{ display: "flex", gap: 10 }}><span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)", width: 80 }}>Concepts</span><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{L.concepts.map((cn) => (<span key={cn} style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-ink)", background: "var(--bow-paper)", border: "1px solid var(--border-rule)", padding: "3px 8px", borderRadius: 999 }}>{cn}</span>))}</div></div>
                </div>
              </div>
            )}

            <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 22 }}>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 4 }}>Session plan</span>
              <span style={{ fontFamily: "var(--font-interface)", fontSize: 12, fontStyle: "italic", color: "var(--bow-slate)", display: "block", marginBottom: 12 }}>Your delivery plan — tap a step as you lead the room.</span>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {stages.map((s, i) => (
                  <div key={s.n} onClick={() => setSessionStage(i)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: "1px solid var(--border-rule)", cursor: "pointer" }}>
                    <span style={{ width: 10, height: 10, borderRadius: 999, background: s.dot, flexShrink: 0 }} />
                    <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)", width: 24 }}>{s.n}</span>
                    <span style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 14, color: "var(--bow-ink)", flex: 1 }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: snapshot + attendance + notes + actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {/* progress snapshot */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: "var(--border-rule)", border: "1px solid var(--border-rule)", borderRadius: 6, overflow: "hidden" }}>
              <div style={{ background: "var(--bow-white)", padding: "16px 12px", textAlign: "center" }}><span style={{ fontFamily: "var(--font-data)", fontSize: 26, fontWeight: 500, color: "var(--bow-inactive)", display: "block" }}>{snap.notStarted}</span><span style={{ fontFamily: "var(--font-data)", fontSize: 9.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Not started</span></div>
              <div style={{ background: "var(--bow-white)", padding: "16px 12px", textAlign: "center" }}><span style={{ fontFamily: "var(--font-data)", fontSize: 26, fontWeight: 500, color: "var(--bow-blue)", display: "block" }}>{snap.inProgress}</span><span style={{ fontFamily: "var(--font-data)", fontSize: 9.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)" }}>In progress</span></div>
              <div style={{ background: "var(--bow-white)", padding: "16px 12px", textAlign: "center" }}><span style={{ fontFamily: "var(--font-data)", fontSize: 26, fontWeight: 500, color: "var(--bow-positive)", display: "block" }}>{snap.complete}</span><span style={{ fontFamily: "var(--font-data)", fontSize: 9.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Complete</span></div>
              <div style={{ background: "var(--bow-white)", padding: "16px 12px", textAlign: "center" }}><span style={{ fontFamily: "var(--font-data)", fontSize: 26, fontWeight: 500, color: "var(--bow-warning)", display: "block" }}>{snap.invited}</span><span style={{ fontFamily: "var(--font-data)", fontSize: 9.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Waiting</span></div>
            </div>

            {/* attendance */}
            <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 22 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Attendance · saves automatically</span>
                <button onClick={markAllPresent} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase", padding: "7px 14px", border: "1px solid var(--bow-positive)", background: "transparent", color: "var(--bow-positive)", borderRadius: 4, cursor: "pointer" }}>Mark All Present</button>
              </div>
              {noStudents && (
                <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-slate)", lineHeight: 1.5 }}>No students are enrolled yet. Invite students before recording attendance.</p>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {attRows.map((r) => {
                  const p = attBtn(r.state === "present", "var(--bow-positive)");
                  const l = attBtn(r.state === "late", "var(--bow-warning)");
                  const a = attBtn(r.state === "absent", "var(--bow-negative)");
                  const x = attBtn(r.state === "excused", "var(--bow-slate)");
                  return (
                    <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 13.5, color: "var(--bow-ink)", flex: 1, minWidth: 110 }}>{r.name}</span>
                      <div style={{ display: "flex", gap: 5 }}>
                        <button onClick={() => mark(r.id, "present")} style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.04em", textTransform: "uppercase", padding: "6px 10px", borderRadius: 3, cursor: "pointer", background: p.bg, color: p.color, border: `1px solid ${p.border}` }}>Present</button>
                        <button onClick={() => mark(r.id, "late")} style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.04em", textTransform: "uppercase", padding: "6px 10px", borderRadius: 3, cursor: "pointer", background: l.bg, color: l.color, border: `1px solid ${l.border}` }}>Late</button>
                        <button onClick={() => mark(r.id, "absent")} style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.04em", textTransform: "uppercase", padding: "6px 10px", borderRadius: 3, cursor: "pointer", background: a.bg, color: a.color, border: `1px solid ${a.border}` }}>Absent</button>
                        <button onClick={() => mark(r.id, "excused")} style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.04em", textTransform: "uppercase", padding: "6px 10px", borderRadius: 3, cursor: "pointer", background: x.bg, color: x.color, border: `1px solid ${x.border}` }}>Excused</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* notes */}
            <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 22 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Session notes</span>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Instructor &amp; BOW only</span>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <input value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addNote(); }} placeholder="Note from this session…" style={{ flex: 1, background: "var(--bow-paper)", border: "1px solid var(--border-rule)", color: "var(--bow-ink)", padding: "11px 13px", borderRadius: 4, fontFamily: "var(--font-interface)", fontSize: 14 }} />
                <button onClick={addNote} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.05em", textTransform: "uppercase", padding: "0 18px", border: "none", background: "var(--bow-ink)", color: "#fff", borderRadius: 4, cursor: "pointer" }}>Add</button>
              </div>
            </div>

            {/* session actions */}
            <button onClick={onAdvance} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, letterSpacing: "0.05em", textTransform: "uppercase", padding: 15, border: "1px solid var(--bow-ink)", background: "transparent", color: "var(--bow-ink)", borderRadius: 4, cursor: "pointer" }}>Advance to Next Lesson</button>
          </div>
        </div>
      </div>
    </div>
  );
}
