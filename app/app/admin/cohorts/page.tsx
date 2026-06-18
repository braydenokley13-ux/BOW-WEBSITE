"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { Badge } from "@/components/ds";
import { useAppState } from "@/components/app/AppState";
import {
  cohorts,
  organizations,
  cohortRoster,
  getOrg,
  getUser,
  trackLessons,
  type Cohort,
} from "@/lib/account";
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

const th: CSSProperties = {
  textAlign: "left",
  padding: "12px 8px",
  fontFamily: "var(--font-data)",
  fontSize: 10,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--bow-slate)",
  fontWeight: 600,
};

const label: CSSProperties = {
  fontFamily: "var(--font-data)",
  fontSize: 10,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--bow-slate)",
  display: "block",
  marginBottom: 6,
};

const input: CSSProperties = {
  width: "100%",
  background: "var(--bow-paper)",
  border: "1px solid var(--border-rule)",
  color: "var(--bow-ink)",
  padding: 12,
  borderRadius: 4,
  fontFamily: "var(--font-interface)",
  fontSize: 14,
};

export default function AdminCohortsPage() {
  const { advanceCohortLesson, cohortCurrentLessonId, userStatusOf, showToast } = useAppState();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [ccName, setCcName] = useState("");
  const [ccOrg, setCcOrg] = useState("");
  const [ccTrack, setCcTrack] = useState("");

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

  const selected = selectedId ? cohorts.find((c) => c.id === selectedId) ?? null : null;
  const selRoster = selected ? cohortRoster(selected.id).filter((e) => e.enroll !== "invited") : [];
  const selLessonId = selected ? cohortCurrentLessonId(selected) : null;
  const selLesson = selLessonId ? getLessonById(selLessonId) ?? null : null;
  const selTrackLessons = selected ? trackLessons(selected.track) : [];
  const selCurIdx = selLessonId ? selTrackLessons.findIndex((l) => l.id === selLessonId) : -1;
  const selNextLesson = selCurIdx >= 0 ? selTrackLessons[selCurIdx + 1] ?? null : selTrackLessons[0] ?? null;
  const orgOptions = organizations.filter((o) => o.type !== "BOW");

  function submitCreate() {
    // TODO: wire to backend
    setCreateOpen(false);
    setCcName("");
    setCcOrg("");
    setCcTrack("");
    showToast("Cohort created as a draft (prototype)");
  }

  return (
    <div style={{ background: "var(--bow-paper)", minHeight: "calc(100vh - 60px)", padding: "clamp(24px,4vw,44px) clamp(16px,4vw,32px) 96px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 26 }}>
          <div>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Every program, one view</span>
            <h1 style={{ margin: "8px 0 0", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(30px,4vw,46px)", lineHeight: 0.94, letterSpacing: "-0.02em", textTransform: "uppercase", color: "var(--bow-ink)" }}>Cohorts</h1>
          </div>
          <button onClick={() => setCreateOpen(true)} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", padding: "12px 22px", border: "none", background: "var(--bow-ink)", color: "#fff", borderRadius: 4, cursor: "pointer" }}>Create Cohort</button>
        </div>

        <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-rule)" }}>
                <th style={{ ...th, padding: "12px 16px" }}>Cohort</th>
                <th style={th}>Track</th>
                <th style={th}>Instructor</th>
                <th style={th}>Enrolled</th>
                <th style={{ ...th, padding: "12px 16px" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} onClick={() => setSelectedId(c.id)} style={{ borderBottom: "1px solid var(--border-rule)", cursor: "pointer" }}>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 14.5, color: "var(--bow-ink)" }}>{c.name}</span>
                    <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)", display: "block", marginTop: 2 }}>{c.orgName} · {c.dates}</span>
                  </td>
                  <td style={{ padding: "14px 8px", fontFamily: "var(--font-data)", fontSize: 12.5, color: "var(--bow-ink)" }}>{`Track ${c.track}`}</td>
                  <td style={{ padding: "14px 8px", fontFamily: "var(--font-interface)", fontSize: 13, color: "var(--bow-ink)" }}>{c.instructorLabel}</td>
                  <td style={{ padding: "14px 8px", fontFamily: "var(--font-data)", fontSize: 13, color: "var(--bow-ink)" }}>{c.enrolled}/{c.cap}</td>
                  <td style={{ padding: "14px 16px" }}><Badge status={statusBadge[c.status]}>{statusLabel[c.status]}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* cohort detail + roster */}
      {selected && (
        <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 4500, background: "rgba(10,10,11,0.6)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 20px", overflowY: "auto" }} onClick={() => setSelectedId(null)}>
          <div style={{ background: "var(--bow-white)", maxWidth: 620, width: "100%", borderRadius: 6, borderTop: "4px solid var(--bow-blue)", padding: "clamp(22px,3vw,32px)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
              <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 26, textTransform: "uppercase", letterSpacing: "-0.01em", color: "var(--bow-ink)", lineHeight: 1 }}>{selected.name}</h2>
              <span onClick={() => setSelectedId(null)} style={{ fontFamily: "var(--font-data)", fontSize: 13, color: "var(--bow-slate)", cursor: "pointer" }}>Close ✕</span>
            </div>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)" }}>{getOrg(selected.orgId)?.name} · Track {selected.track} · {selected.start === "—" ? "Dates TBD" : `${selected.start} – ${selected.end}`}</span>

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

            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", margin: "22px 0 10px" }}>Roster · {selRoster.length} students</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
              {selRoster.length === 0 && <span style={{ fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-slate)" }}>No students enrolled yet.</span>}
              {selRoster.map((e) => {
                const st = userStatusOf(e.user);
                const enrollStatus = st === "suspended" ? "suspended" : e.enroll;
                const badge: BadgeStatus = enrollStatus === "suspended" ? "negative" : "positive";
                const lbl = enrollStatus === "suspended" ? "Suspended" : "Active";
                return (
                  <div key={e.userId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 14px", border: "1px solid var(--border-rule)", borderRadius: 5 }}>
                    <span style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 14, color: "var(--bow-ink)" }}>{e.user.name}</span>
                    <Badge status={badge}>{lbl}</Badge>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => advanceCohortLesson(selected.id, selNextLesson ? selNextLesson.id : null)}
              style={{ width: "100%", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, letterSpacing: "0.05em", textTransform: "uppercase", padding: 13, border: "none", background: "var(--bow-blue)", color: "#fff", borderRadius: 4, cursor: "pointer" }}
            >
              {selNextLesson ? `Advance to “${selNextLesson.title}”` : "Advance Lesson"}
            </button>
          </div>
        </div>
      )}

      {/* simplified create cohort */}
      {createOpen && (
        <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 4500, background: "rgba(10,10,11,0.62)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "32px 18px", overflowY: "auto" }} onClick={() => setCreateOpen(false)}>
          <div style={{ background: "var(--bow-white)", maxWidth: 620, width: "100%", borderRadius: 6, borderTop: "4px solid var(--bow-blue)", padding: "clamp(22px,3vw,32px)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 22, textTransform: "uppercase", letterSpacing: "-0.01em", color: "var(--bow-ink)" }}>Create Cohort</span>
              <span onClick={() => setCreateOpen(false)} style={{ fontFamily: "var(--font-data)", fontSize: 13, color: "var(--bow-slate)", cursor: "pointer" }}>Cancel ✕</span>
            </div>

            <label style={label}>Cohort name</label>
            <input value={ccName} onChange={(e) => setCcName(e.target.value)} placeholder="e.g. Lincoln Fall — Track 101" style={{ ...input, marginBottom: 16 }} />

            <label style={label}>Organization</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              {orgOptions.map((o) => {
                const sel = ccOrg === o.id;
                return (
                  <button key={o.id} onClick={() => setCcOrg(o.id)} style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 13, padding: "9px 14px", borderRadius: 4, cursor: "pointer", background: sel ? "var(--bow-blue)" : "var(--bow-white)", color: sel ? "#fff" : "var(--bow-ink)", border: `1px solid ${sel ? "var(--bow-blue)" : "var(--border-rule)"}` }}>{o.name}</button>
                );
              })}
            </div>

            <label style={label}>Track</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[{ id: "101", label: "Track 101 · Foundations" }, { id: "201", label: "Track 201 · Advanced" }].map((t) => {
                const sel = ccTrack === t.id;
                return (
                  <button key={t.id} onClick={() => setCcTrack(t.id)} style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 13, padding: "9px 14px", borderRadius: 4, cursor: "pointer", background: sel ? "var(--bow-blue)" : "var(--bow-white)", color: sel ? "#fff" : "var(--bow-ink)", border: `1px solid ${sel ? "var(--bow-blue)" : "var(--border-rule)"}` }}>{t.label}</button>
                );
              })}
            </div>

            <p style={{ margin: "18px 0 0", fontFamily: "var(--font-interface)", fontSize: 12, color: "var(--bow-slate)", lineHeight: 1.5 }}>Prototype: creates a draft cohort. Nothing is persisted to a server.</p>
            <button onClick={submitCreate} disabled={!ccName || !ccOrg || !ccTrack} style={{ width: "100%", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, letterSpacing: "0.05em", textTransform: "uppercase", padding: 14, border: "none", background: "var(--bow-positive)", color: "#fff", borderRadius: 4, cursor: ccName && ccOrg && ccTrack ? "pointer" : "not-allowed", opacity: ccName && ccOrg && ccTrack ? 1 : 0.55, marginTop: 16 }}>Create Cohort</button>
          </div>
        </div>
      )}
    </div>
  );
}
