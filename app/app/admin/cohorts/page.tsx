"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { Badge, Modal } from "@/components/ds";
import { useAppState } from "@/components/app/AppState";
import { trackLessons, nextLessonInTrack, type Cohort } from "@/lib/account";
import { getLessonById, moduleLabel } from "@/lib/lessons";

type BadgeStatus = "positive" | "warning" | "negative" | "info" | "neutral" | "locked";

const statusLabel: Record<Cohort["status"], string> = {
  active: "Active",
  enrolling: "Enrollment Open",
  completed: "Completed",
  draft: "Draft",
};

const statusBadge: Record<Cohort["status"], BadgeStatus> = {
  active: "positive",
  enrolling: "info",
  completed: "neutral",
  draft: "warning",
};

const th: CSSProperties = { textAlign: "left", padding: "12px 8px", fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)", fontWeight: 600 };
const label: CSSProperties = { fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 6 };
const input: CSSProperties = { width: "100%", background: "var(--bow-paper)", border: "1px solid var(--border-rule)", color: "var(--bow-ink)", padding: 12, borderRadius: 4, fontFamily: "var(--font-interface)", fontSize: 14 };
const miniSelect: CSSProperties = { background: "var(--bow-white)", border: "1px solid var(--border-rule)", color: "var(--bow-ink)", padding: "6px 8px", borderRadius: 4, fontFamily: "var(--font-interface)", fontSize: 12 };

export default function AdminCohortsPage() {
  const {
    data, getOrg, getUser, getCohort, cohortRoster, cohortCurrentLessonId, userStatusOf,
    advanceCohortLesson, createCohort, assignInstructor, assignStudent, removeStudent, transferStudent, askConfirm,
  } = useAppState();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [ccName, setCcName] = useState("");
  const [ccOrg, setCcOrg] = useState("");
  const [ccTrack, setCcTrack] = useState("");
  const [addStudentId, setAddStudentId] = useState("");

  const cohorts = data.cohorts;
  const instructors = data.users.filter((u) => u.role === "instructor");

  const rows = cohorts.map((c) => {
    const roster = cohortRoster(c.id);
    const enrolled = roster.filter((e) => e.enroll === "active" || e.enroll === "suspended").length;
    return {
      ...c,
      orgName: getOrg(c.orgId)?.name ?? "—",
      instructorLabel: c.instructorId ? getUser(c.instructorId)?.name ?? "Unassigned" : "Unassigned",
      enrolled,
      dates: c.start === "—" ? "—" : `${c.start} – ${c.end}`,
    };
  });

  const selected = selectedId ? getCohort(selectedId) : null;
  const selRoster = selected ? cohortRoster(selected.id).filter((e) => e.enroll !== "invited") : [];
  const selRosterIds = new Set(selRoster.map((e) => e.userId));
  const selLessonId = selected ? cohortCurrentLessonId(selected) : null;
  const selLesson = selLessonId ? getLessonById(selLessonId) ?? null : null;
  const selTrackLessons = selected ? trackLessons(selected.track) : [];
  const selCurIdx = selLessonId ? selTrackLessons.findIndex((l) => l.id === selLessonId) : -1;
  const selNextLesson = selected ? (selCurIdx >= 0 ? nextLessonInTrack(selected.track, selLessonId) : selTrackLessons[0] ?? null) : null;
  const orgOptions = data.organizations.filter((o) => o.type !== "BOW");
  // Students who could be added to the selected cohort (not already enrolled here).
  const addableStudents = selected ? data.users.filter((u) => u.role === "student" && !selRosterIds.has(u.id)) : [];
  const transferTargets = selected ? cohorts.filter((c) => c.id !== selected.id && c.status !== "completed") : [];

  async function submitCreate() {
    if (!ccName || !ccOrg || !ccTrack) return;
    (await createCohort({ name: ccName.trim(), orgId: ccOrg, track: ccTrack }));
    setCreateOpen(false);
    setCcName("");
    setCcOrg("");
    setCcTrack("");
  }

  return (
    <div style={{ background: "var(--bow-paper)", minHeight: "calc(100vh - 60px)", padding: "clamp(24px,4vw,44px) clamp(16px,4vw,32px) 96px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 26 }}>
          <div>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Every program, one view</span>
            <h1 style={{ margin: "8px 0 0", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(30px,4vw,46px)", lineHeight: 0.94, letterSpacing: "-0.02em", textTransform: "uppercase", color: "var(--bow-ink)" }}>Cohorts</h1>
          </div>
          <button type="button" onClick={() => setCreateOpen(true)} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", padding: "12px 22px", border: "none", background: "var(--bow-ink)", color: "#fff", borderRadius: 4, cursor: "pointer" }}>Create Cohort</button>
        </div>

        <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-rule)" }}>
                <th scope="col" style={{ ...th, padding: "12px 16px" }}>Cohort</th>
                <th scope="col" style={th}>Track</th>
                <th scope="col" style={th}>Instructor</th>
                <th scope="col" style={th}>Enrolled</th>
                <th scope="col" style={{ ...th, padding: "12px 16px" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid var(--border-rule)" }}>
                  <td style={{ padding: "14px 16px" }}>
                    <button
                      type="button"
                      onClick={() => { setSelectedId(c.id); setAddStudentId(""); }}
                      aria-label={`Open ${c.name} cohort details`}
                      style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 14.5, color: "var(--bow-blue)", background: "transparent", border: 0, padding: 0, cursor: "pointer", textAlign: "left" }}
                    >
                      {c.name}
                    </button>
                    <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)", display: "block", marginTop: 2 }}>{c.orgName} · {c.dates}</span>
                  </td>
                  <td style={{ padding: "14px 8px", fontFamily: "var(--font-data)", fontSize: 12.5, color: "var(--bow-ink)" }}>{`Track ${c.track}`}</td>
                  <td style={{ padding: "14px 8px", fontFamily: "var(--font-interface)", fontSize: 13, color: c.instructorId ? "var(--bow-ink)" : "var(--bow-slate)" }}>{c.instructorLabel}</td>
                  <td style={{ padding: "14px 8px", fontFamily: "var(--font-data)", fontSize: 13, color: "var(--bow-ink)" }}>{c.enrolled}/{c.cap}</td>
                  <td style={{ padding: "14px 16px" }}><Badge status={statusBadge[c.status]}>{statusLabel[c.status]}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* cohort detail + management */}
      <Modal open={Boolean(selected)} onClose={() => setSelectedId(null)} title={selected?.name ?? "Cohort details"} maxWidth={640}>
        {selected && (
          <>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)" }}>{getOrg(selected.orgId)?.name} · Track {selected.track} · {selected.start === "—" ? "Dates TBD" : `${selected.start} – ${selected.end}`}</span>

            {/* instructor */}
            <label htmlFor="cohort-instructor" style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", margin: "22px 0 8px" }}>Instructor</label>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <select
                id="cohort-instructor"
                value={selected.instructorId ?? ""}
                onChange={async (e) => (await assignInstructor(selected.id, e.target.value || null))}
                style={{ ...input, width: "auto", flex: 1, minWidth: 200 }}
              >
                <option value="">Unassigned</option>
                {instructors.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
              {selected.instructorId && (
                <button type="button" onClick={async () => (await assignInstructor(selected.id, null))} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase", padding: "9px 14px", border: "1px solid var(--border-rule)", background: "transparent", color: "var(--bow-slate)", borderRadius: 4, cursor: "pointer" }}>Remove</button>
              )}
            </div>

            {/* current lesson */}
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", margin: "22px 0 8px" }}>Current lesson</span>
            <div style={{ background: "var(--bow-paper)", border: "1px solid var(--border-rule)", borderRadius: 5, padding: "14px 16px" }}>
              {selLesson ? (
                <>
                  <span style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 14.5, color: "var(--bow-ink)" }}>{selLesson.title}</span>
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)", display: "block", marginTop: 2 }}>{moduleLabel(selLesson)}</span>
                </>
              ) : (
                <span style={{ fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-slate)" }}>No lesson selected yet.</span>
              )}
            </div>

            {/* roster management */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, margin: "22px 0 10px" }}>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Roster · {selRoster.length} students</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
              {selRoster.length === 0 && <span style={{ fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-slate)" }}>No students enrolled yet.</span>}
              {selRoster.map((e) => {
                const st = userStatusOf(e.user);
                const badge: BadgeStatus = st === "suspended" ? "negative" : "positive";
                const lbl = st === "suspended" ? "Suspended" : "Active";
                return (
                  <div key={e.userId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 14px", border: "1px solid var(--border-rule)", borderRadius: 5, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 14, color: "var(--bow-ink)", flex: 1, minWidth: 120 }}>{e.user.name}</span>
                    <Badge status={badge}>{lbl}</Badge>
                    {transferTargets.length > 0 && (
                      <select
                        value=""
                        onChange={async (ev) => { if (ev.target.value) (await transferStudent(e.userId, selected.id, ev.target.value)); }}
                        style={miniSelect}
                        aria-label={`Transfer ${e.user.name}`}
                      >
                        <option value="">Transfer to…</option>
                        {transferTargets.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      onClick={() => askConfirm({ title: `Remove ${e.user.name}?`, body: "They’ll be removed from this cohort’s roster. Their account and history stay intact.", confirmLabel: "Remove", tone: "negative", onConfirm: async () => (await removeStudent(selected.id, e.userId)) })}
                      style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 10.5, letterSpacing: "0.05em", textTransform: "uppercase", padding: "7px 11px", border: "1px solid var(--bow-negative)", background: "transparent", color: "var(--bow-negative)", borderRadius: 4, cursor: "pointer" }}
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>

            {/* add student */}
            <label htmlFor="cohort-add-student" style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 8 }}>Add student</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 22, flexWrap: "wrap" }}>
              <select id="cohort-add-student" value={addStudentId} onChange={(e) => setAddStudentId(e.target.value)} style={{ ...input, width: "auto", flex: 1, minWidth: 200 }}>
                <option value="">Add a student…</option>
                {addableStudents.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} — {getOrg(s.orgId)?.name ?? "—"}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={async () => { if (addStudentId) { (await assignStudent(selected.id, addStudentId)); setAddStudentId(""); } }}
                disabled={!addStudentId}
                style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.05em", textTransform: "uppercase", padding: "11px 18px", border: "none", background: "var(--bow-ink)", color: "#fff", borderRadius: 4, cursor: addStudentId ? "pointer" : "not-allowed", opacity: addStudentId ? 1 : 0.5 }}
              >
                Add
              </button>
            </div>

            <button
              type="button"
              onClick={async () => (await advanceCohortLesson(selected.id, selNextLesson ? selNextLesson.id : null))}
              style={{ width: "100%", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, letterSpacing: "0.05em", textTransform: "uppercase", padding: 13, border: "none", background: "var(--bow-blue)", color: "#fff", borderRadius: 4, cursor: "pointer" }}
            >
              {selNextLesson ? `Advance to “${selNextLesson.title}”` : "Advance Lesson"}
            </button>
          </>
        )}
      </Modal>

      {/* create cohort */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Cohort" maxWidth={620}>
            <label htmlFor="new-cohort-name" style={label}>Cohort name</label>
            <input id="new-cohort-name" value={ccName} onChange={(e) => setCcName(e.target.value)} placeholder="e.g. Lincoln Fall — Track 101" style={{ ...input, marginBottom: 16 }} />

            <fieldset style={{ border: 0, padding: 0, margin: "0 0 16px" }}>
              <legend style={label}>Organization</legend>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {orgOptions.map((o) => {
                const sel = ccOrg === o.id;
                return (
                  <button type="button" aria-pressed={sel} key={o.id} onClick={() => setCcOrg(o.id)} style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 13, padding: "9px 14px", borderRadius: 4, cursor: "pointer", background: sel ? "var(--bow-blue)" : "var(--bow-white)", color: sel ? "#fff" : "var(--bow-ink)", border: `1px solid ${sel ? "var(--bow-blue)" : "var(--border-rule)"}` }}>{o.name}</button>
                );
              })}
              </div>
            </fieldset>

            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={label}>Track</legend>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[{ id: "101", label: "Track 101 · Foundations" }, { id: "201", label: "Track 201 · Advanced" }].map((t) => {
                const sel = ccTrack === t.id;
                return (
                  <button type="button" aria-pressed={sel} key={t.id} onClick={() => setCcTrack(t.id)} style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 13, padding: "9px 14px", borderRadius: 4, cursor: "pointer", background: sel ? "var(--bow-blue)" : "var(--bow-white)", color: sel ? "#fff" : "var(--bow-ink)", border: `1px solid ${sel ? "var(--bow-blue)" : "var(--border-rule)"}` }}>{t.label}</button>
                );
              })}
              </div>
            </fieldset>

            <p style={{ margin: "18px 0 0", fontFamily: "var(--font-interface)", fontSize: 12, color: "var(--bow-slate)", lineHeight: 1.5 }}>Creates a draft cohort. Assign an instructor and students from the cohort’s detail panel.</p>
            <button type="button" onClick={submitCreate} disabled={!ccName || !ccOrg || !ccTrack} style={{ width: "100%", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, letterSpacing: "0.05em", textTransform: "uppercase", padding: 14, border: "none", background: "var(--bow-positive)", color: "#fff", borderRadius: 4, cursor: ccName && ccOrg && ccTrack ? "pointer" : "not-allowed", opacity: ccName && ccOrg && ccTrack ? 1 : 0.55, marginTop: 16 }}>Create Cohort</button>
      </Modal>
    </div>
  );
}
