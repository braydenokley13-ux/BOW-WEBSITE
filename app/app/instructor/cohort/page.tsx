"use client";

import { useState } from "react";
import Link from "next/link";
import { useAppState } from "@/components/app/AppState";
import { Badge } from "@/components/ds";
import {
  lessonProgressLabel,
  initials,
  nextLessonInTrack,
  trackLessons,
  unlockChecklist,
  isInactive,
  INACTIVE_FLAG_DAYS,
  type LessonProgress,
} from "@/lib/account";
import { getLessonById } from "@/lib/lessons";
import styles from "../../portal-accessibility.module.css";

type BadgeStatus = "positive" | "warning" | "negative";

const lessonDotFor = (s: LessonProgress): string =>
  s === "completed" ? "var(--bow-positive)" : s === "in-progress" ? "var(--bow-blue)" : "var(--bow-inactive)";

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 16px",
  fontFamily: "var(--font-data)",
  fontSize: 10,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--bow-slate)",
  fontWeight: 600,
  whiteSpace: "nowrap",
};

/** A small SIM/POD/REF condition pip, filled when the condition is met. */
function ConditionPip({ label, on }: { label: string; on: boolean }) {
  return (
    <span
      title={on ? `${label} complete` : `${label} not yet`}
      style={{
        fontFamily: "var(--font-data)",
        fontSize: 9.5,
        letterSpacing: "0.04em",
        padding: "3px 6px",
        borderRadius: 3,
        background: on ? "var(--bow-positive-tint)" : "var(--bow-paper)",
        color: on ? "var(--bow-positive)" : "var(--bow-inactive)",
        border: `1px solid ${on ? "var(--bow-positive)" : "var(--border-rule)"}`,
      }}
    >
      {label}
    </span>
  );
}

/** Compact relative "last active" label from a real timestamp. */
function fmtLastActive(ts?: number | null): string {
  if (ts == null) return "Never";
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} day${d > 1 ? "s" : ""} ago`;
  const w = Math.floor(d / 7);
  return `${w} wk${w > 1 ? "s" : ""} ago`;
}

export default function InstructorCohortPage() {
  const {
    me,
    selectedCohortId,
    getCohort,
    getOrg,
    cohortRoster,
    cohortsForInstructor,
    cohortCurrentLessonId,
    userStatusOf,
    advanceCohortLesson,
    lessonProgressFor,
    notesForCohort,
    addSessionNote,
    askConfirm,
  } = useAppState();

  const [noteDraft, setNoteDraft] = useState("");

  // Fall back to one of THIS instructor's own cohorts, not a hardcoded id —
  // "coh-1" isn't guaranteed to be (or even visible to) the signed-in instructor.
  const c = getCohort(selectedCohortId) ?? cohortsForInstructor(me.id)[0] ?? null;
  if (!c) {
    return (
      <div style={{ background: "var(--bow-paper)", minHeight: "calc(100vh - 60px)", padding: "clamp(24px,4vw,44px) clamp(16px,4vw,32px)" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 28 }}>
          <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 16, lineHeight: 1.6, color: "var(--bow-slate)" }}>
            You&apos;re not assigned to a cohort yet. A BOW administrator will place you with one soon.
          </p>
        </div>
      </div>
    );
  }

  const org = getOrg(c.orgId);
  const curId = cohortCurrentLessonId(c);
  const L = curId ? getLessonById(curId) ?? null : null;
  const trackAll = trackLessons(c.track);

  const roster = cohortRoster(c.id);
  const rosterVM = roster.map((e) => {
    const status = userStatusOf(e.user);
    const st = status === "suspended" ? "suspended" : e.enroll;
    const enrollLabel = st === "invited" ? "Invited" : st === "suspended" ? "Suspended" : "Active";
    const enrollBadge: BadgeStatus = st === "invited" ? "warning" : st === "suspended" ? "negative" : "positive";
    // Monitoring: completion across the track + the three self-paced conditions
    // on the student's current lesson.
    const completed = trackAll.filter((l) => lessonProgressFor(e.userId, l.id)?.status === "completed").length;
    const curDetail = curId ? lessonProgressFor(e.userId, curId) : null;
    const check = unlockChecklist(curDetail);
    const inactive = e.enroll !== "invited" && isInactive(e.user.lastActiveAt);
    return {
      id: e.userId,
      name: e.user.name,
      initial: initials(e.user.name),
      enrollLabel,
      enrollBadge,
      lessonStatus: lessonProgressLabel(e.lessonStatus),
      lessonDot: lessonDotFor(e.lessonStatus),
      completed,
      total: trackAll.length,
      sim: check.simulationDone,
      podcast: check.podcastMet,
      reflection: check.reflectionMet,
      invited: e.enroll === "invited",
      lastActive: e.enroll === "invited" ? "—" : fmtLastActive(e.user.lastActiveAt),
      inactive,
    };
  });

  const activeRoster = roster.filter((e) => e.enroll !== "invited");
  const invited = roster.filter((e) => e.enroll === "invited").length;
  const flagged = rosterVM.filter((r) => r.inactive).length;
  const nextLesson = nextLessonInTrack(c.track, curId);
  const notes = notesForCohort(c.id);

  const onAdvance = () =>
    askConfirm({
      title: "Manually unlock the next lesson?",
      body: nextLesson
        ? `Students unlock “${nextLesson.title}” on their own once they finish the simulation, a 75-word reflection, and 80% of the podcast. You can override and open it for the whole cohort now.`
        : "This is the final lesson.",
      confirmLabel: "Unlock for cohort",
      tone: "info",
      onConfirm: () => advanceCohortLesson(c.id, nextLesson ? nextLesson.id : null),
    });

  const addNote = () => {
    const text = noteDraft.trim();
    if (!text) return;
    addSessionNote(c.id, "Cohort · " + c.name, text);
    setNoteDraft("");
  };

  return (
    <div style={{ background: "var(--bow-paper)", minHeight: "calc(100vh - 60px)", padding: "clamp(24px,4vw,44px) clamp(16px,4vw,32px) 96px" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        <Link className={styles.focusTarget} href="/app/instructor" style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)", cursor: "pointer", display: "inline-block", marginBottom: 14 }}>← Today</Link>
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
          <div style={{ background: "var(--bow-white)", padding: "14px 16px" }}><span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 4 }}>Cohort schedule note</span><span style={{ fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-ink)" }}>{c.nextSession}</span></div>
        </div>

        {/* actions */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 26 }}>
          <Link className={styles.focusTarget} href={`/app/teach/classes/${c.id}`} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", padding: "12px 22px", border: "none", background: "var(--bow-positive)", color: "#fff", borderRadius: 4, cursor: "pointer" }}>Open Delivery Class</Link>
        </div>

        {L && (
          <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: "18px 20px", marginBottom: 26 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 6 }}>Current lesson · students auto-advance</span>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, textTransform: "uppercase", letterSpacing: "-0.01em", color: "var(--bow-ink)" }}>{L.title}</span>
                <p style={{ margin: "4px 0 0", fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-slate)" }}>{"Module " + String(L.moduleNumber).padStart(2, "0") + " · " + L.moduleTitle}</p>
              </div>
              <button className={styles.focusTarget} onClick={onAdvance} type="button" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 11.5, letterSpacing: "0.05em", textTransform: "uppercase", padding: "9px 14px", border: "1px solid var(--border-rule)", background: "transparent", color: "var(--bow-slate)", borderRadius: 4, cursor: "pointer", flexShrink: 0 }}>Manually unlock next ↦</button>
            </div>
          </div>
        )}

        {/* monitoring view — replaces the old "advance cohort" control */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Student monitor</span>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.04em", color: flagged ? "var(--bow-negative)" : "var(--bow-slate)" }}>
            {flagged > 0 ? `⚑ ${flagged} inactive ${INACTIVE_FLAG_DAYS}+ days` : "Everyone active in the last week"}
          </span>
        </div>
        <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-rule)" }}>
                <th style={thStyle}>Student</th>
                <th style={thStyle}>Track progress</th>
                <th style={thStyle}>Current lesson</th>
                <th style={thStyle}>Last active</th>
              </tr>
            </thead>
            <tbody>
              {rosterVM.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--border-rule)", background: r.inactive ? "var(--bow-negative-tint)" : undefined }}>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 28, height: 28, borderRadius: 999, background: "var(--bow-paper)", border: "1px solid var(--border-rule)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 11, color: "var(--bow-ink)", flexShrink: 0 }}>{r.initial}</span>
                      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                        <span style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 14, color: "var(--bow-ink)" }}>{r.name}</span>
                        <Badge status={r.enrollBadge} style={{ height: 18, alignSelf: "flex-start" }}>{r.enrollLabel}</Badge>
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: "13px 8px" }}>
                    {r.invited ? (
                      <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)" }}>—</span>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-ink)", minWidth: 34 }}>{r.completed}/{r.total}</span>
                        <span style={{ flex: 1, minWidth: 56, height: 5, background: "var(--bow-paper)", borderRadius: 999, overflow: "hidden", display: "inline-block" }}>
                          <span style={{ display: "block", height: "100%", width: `${r.total ? (r.completed / r.total) * 100 : 0}%`, background: "var(--bow-positive)" }} />
                        </span>
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "13px 8px" }}>
                    {r.invited ? (
                      <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)" }}>Waiting on invite</span>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <ConditionPip label="SIM" on={r.sim} />
                        <ConditionPip label="POD" on={r.podcast} />
                        <ConditionPip label="REF" on={r.reflection} />
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "13px 16px", fontFamily: "var(--font-data)", fontSize: 12, color: r.inactive ? "var(--bow-negative)" : "var(--bow-slate)", whiteSpace: "nowrap" }}>
                    {r.inactive && <span aria-label={`Inactive ${INACTIVE_FLAG_DAYS}+ days`} title={`Inactive ${INACTIVE_FLAG_DAYS}+ days`} style={{ marginRight: 6 }}>⚑</span>}
                    {r.lastActive}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* condition legend */}
        <p style={{ margin: "10px 2px 0", fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.04em", color: "var(--bow-slate)" }}>
          SIM simulation · POD podcast 80%+ · REF reflection 75+ words — the three conditions that auto-unlock the next lesson.
        </p>

        {/* notes */}
        <div style={{ marginTop: 28 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Notes</span>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Instructor &amp; BOW administration only</span>
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <input aria-label="Cohort note" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addNote(); }} placeholder="Add a note about this cohort…" style={{ flex: 1, minWidth: 0, background: "var(--bow-white)", border: "1px solid var(--border-rule)", color: "var(--bow-ink)", padding: "12px 14px", borderRadius: 4, fontFamily: "var(--font-interface)", fontSize: 14 }} />
            <button className={styles.focusTarget} onClick={addNote} type="button" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", padding: "0 20px", border: "none", background: "var(--bow-ink)", color: "#fff", borderRadius: 4, cursor: "pointer" }}>Add</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {notes.length === 0 && <span style={{ fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-slate)" }}>No notes yet.</span>}
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
