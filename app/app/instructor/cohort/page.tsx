"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppState } from "@/components/app/AppState";
import { Badge } from "@/components/ds";
import {
  getCohort,
  getOrg,
  cohortRoster,
  trackLessons,
  lessonProgressLabel,
  initials,
  type Cohort,
  type LessonProgress,
  type Enrollment,
  type User,
} from "@/lib/account";
import { getLessonById, type Lesson } from "@/lib/lessons";

type BadgeStatus = "positive" | "warning" | "negative";

interface RosterRowVM {
  id: string;
  name: string;
  initial: string;
  enrollLabel: string;
  enrollBadge: BadgeStatus;
  lessonStatus: string;
  lessonDot: string;
  last: string;
}

interface NoteVM {
  id: string;
  scope: string;
  text: string;
  when: string;
}

const DEFAULT_NOTES: NoteVM[] = [
  { id: "n1", scope: "Cohort · Lincoln Fall", text: "Group is strong on opportunity cost — push them harder on the trade-down logic next session.", when: "Jun 12" },
  { id: "n2", scope: "Student · Tyler Nguyen", text: "Missed last session. Send the recap and check he can access “You’re the GM”.", when: "Jun 10" },
];

/** Sort a track's lessons by module then lesson number, return the one after curId (null if last/none). */
function nextLessonOf(track: string, curId: string | null): Lesson | null {
  const ordered = [...trackLessons(track)].sort(
    (a, b) => a.moduleNumber - b.moduleNumber || a.lessonNumber - b.lessonNumber,
  );
  const idx = ordered.findIndex((l) => l.id === curId);
  if (idx === -1) return null;
  return ordered[idx + 1] ?? null;
}

const lessonDotFor = (s: LessonProgress): string =>
  s === "completed" ? "var(--bow-positive)" : s === "in-progress" ? "var(--bow-blue)" : "var(--bow-inactive)";

export default function InstructorCohortPage() {
  const router = useRouter();
  const {
    selectedCohortId,
    cohortCurrentLessonId,
    advanceCohortLesson,
    askConfirm,
    showToast,
  } = useAppState();

  const [noteDraft, setNoteDraft] = useState("");
  const [notes, setNotes] = useState<NoteVM[]>(DEFAULT_NOTES);

  const c: Cohort = getCohort(selectedCohortId) ?? getCohort("coh-1")!;
  const org = getOrg(c.orgId);
  const curId = cohortCurrentLessonId(c);
  const L = curId ? getLessonById(curId) ?? null : null;

  const roster = cohortRoster(c.id);
  const rosterVM: RosterRowVM[] = roster.map((e: Enrollment & { user: User }) => {
    const st = e.user.status === "suspended" ? "suspended" : e.enroll;
    const enrollLabel = st === "invited" ? "Invited" : st === "suspended" ? "Suspended" : "Active";
    const enrollBadge: BadgeStatus = st === "invited" ? "warning" : st === "suspended" ? "negative" : "positive";
    return {
      id: e.userId,
      name: e.user.name,
      initial: initials(e.user.name),
      enrollLabel,
      enrollBadge,
      lessonStatus: lessonProgressLabel(e.lessonStatus),
      lessonDot: lessonDotFor(e.lessonStatus),
      last: e.last,
    };
  });

  const activeRoster = roster.filter((e) => e.enroll !== "invited");
  const invited = roster.filter((e) => e.enroll === "invited").length;

  const nextLesson = nextLessonOf(c.track, curId);

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

  const openSession = () => router.push("/app/instructor/session");
  const goBack = () => router.push("/app/instructor");

  const addNote = () => {
    const text = noteDraft.trim();
    if (!text) return;
    setNotes((prev) => [{ id: "n" + Date.now(), scope: "Cohort · " + c.name, text, when: "Just now" }, ...prev]);
    setNoteDraft("");
    showToast("Note added — visible to instructors and BOW only");
  };

  return (
    <div style={{ background: "var(--bow-paper)", minHeight: "calc(100vh - 60px)", padding: "clamp(24px,4vw,44px) clamp(16px,4vw,32px) 96px" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        <span onClick={goBack} style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)", cursor: "pointer", display: "inline-block", marginBottom: 14 }}>← Today</span>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 8 }}>
          <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(30px,4vw,46px)", lineHeight: 0.95, letterSpacing: "-0.02em", textTransform: "uppercase", color: "var(--bow-ink)" }}>{c.name}</h1>
          <Badge status="positive" style={{ height: 24 }}>{c.status}</Badge>
        </div>
        <p style={{ margin: "0 0 22px", fontFamily: "var(--font-interface)", fontSize: 15, color: "var(--bow-slate)" }}>
          {org?.name ?? "—"} · {"Track " + c.track} · {activeRoster.length} students · {invited} pending
        </p>

        {/* cohort facts strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 1, background: "var(--border-rule)", border: "1px solid var(--border-rule)", borderRadius: 6, overflow: "hidden", marginBottom: 22 }}>
          <div style={{ background: "var(--bow-white)", padding: "14px 16px" }}><span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 4 }}>Dates</span><span style={{ fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-ink)" }}>{c.start + " – " + c.end}</span></div>
          <div style={{ background: "var(--bow-white)", padding: "14px 16px" }}><span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 4 }}>Schedule</span><span style={{ fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-ink)" }}>{c.schedule}</span></div>
          <div style={{ background: "var(--bow-white)", padding: "14px 16px" }}><span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 4 }}>Format</span><span style={{ fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-ink)" }}>{c.format}</span></div>
          <div style={{ background: "var(--bow-white)", padding: "14px 16px" }}><span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 4 }}>Next session</span><span style={{ fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-ink)" }}>{c.nextSession}</span></div>
        </div>

        {/* actions */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 26 }}>
          <button onClick={openSession} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", padding: "12px 22px", border: "none", background: "var(--bow-positive)", color: "#fff", borderRadius: 4, cursor: "pointer" }}>Open Current Session</button>
          <button onClick={onAdvance} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", padding: "12px 22px", border: "1px solid var(--bow-ink)", background: "transparent", color: "var(--bow-ink)", borderRadius: 4, cursor: "pointer" }}>Advance Lesson</button>
          <button onClick={() => showToast("Track view — student track preview (prototype)")} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", padding: "12px 22px", border: "1px solid var(--border-rule)", background: "transparent", color: "var(--bow-ink)", borderRadius: 4, cursor: "pointer" }}>View Track</button>
        </div>

        {L && (
          <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: "18px 20px", marginBottom: 26 }}>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 6 }}>Current lesson</span>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, textTransform: "uppercase", letterSpacing: "-0.01em", color: "var(--bow-ink)" }}>{L.title}</span>
            <p style={{ margin: "4px 0 0", fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-slate)" }}>{"Module " + String(L.moduleNumber).padStart(2, "0") + " · " + L.moduleTitle}</p>
          </div>
        )}

        {/* roster table */}
        <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 12 }}>Roster</span>
        <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-rule)" }}>
                <th style={{ textAlign: "left", padding: "12px 16px", fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)", fontWeight: 600 }}>Student</th>
                <th style={{ textAlign: "left", padding: "12px 8px", fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)", fontWeight: 600 }}>Enrollment</th>
                <th style={{ textAlign: "left", padding: "12px 8px", fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)", fontWeight: 600 }}>Lesson</th>
                <th style={{ textAlign: "left", padding: "12px 16px", fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)", fontWeight: 600 }}>Last active</th>
              </tr>
            </thead>
            <tbody>
              {rosterVM.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--border-rule)" }}>
                  <td style={{ padding: "13px 16px" }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ width: 28, height: 28, borderRadius: 999, background: "var(--bow-paper)", border: "1px solid var(--border-rule)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 11, color: "var(--bow-ink)", flexShrink: 0 }}>{r.initial}</span><span style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 14, color: "var(--bow-ink)" }}>{r.name}</span></div></td>
                  <td style={{ padding: "13px 8px" }}><Badge status={r.enrollBadge} style={{ height: 22 }}>{r.enrollLabel}</Badge></td>
                  <td style={{ padding: "13px 8px" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: r.lessonDot }} /><span style={{ fontFamily: "var(--font-interface)", fontSize: 13, color: "var(--bow-ink)" }}>{r.lessonStatus}</span></div></td>
                  <td style={{ padding: "13px 16px", fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)" }}>{r.last}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* notes */}
        <div style={{ marginTop: 28 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Notes</span>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Instructor &amp; BOW administration only</span>
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <input value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Add a note about this cohort…" style={{ flex: 1, background: "var(--bow-white)", border: "1px solid var(--border-rule)", color: "var(--bow-ink)", padding: "12px 14px", borderRadius: 4, fontFamily: "var(--font-interface)", fontSize: 14 }} />
            <button onClick={addNote} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", padding: "0 20px", border: "none", background: "var(--bow-ink)", color: "#fff", borderRadius: 4, cursor: "pointer" }}>Add</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {notes.map((n) => (
              <div key={n.id} style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 5, padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 5 }}><span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--bow-blue)" }}>{n.scope}</span><span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)" }}>{n.when}</span></div>
                <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.5, color: "var(--bow-ink)" }}>{n.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
