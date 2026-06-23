"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SelfModule, SelfModuleView, SelfRosterEntry } from "@/lib/account";
import type { CohortAnalytics } from "@/lib/analytics";
import type { StudentScore } from "@/lib/scoring";
import {
  instructorUnlockModule,
  instructorRelockModule,
  saveStudentNote,
  setSessionAttendance,
} from "@/app/actions/lms";
import ClassAnalytics from "@/components/selfpaced/ClassAnalytics";
import LeaderboardTable from "@/components/leaderboard/LeaderboardTable";

type Tab = "roster" | "analytics" | "leaderboard";

interface Props {
  instructorName: string;
  cohortName: string;
  roster: SelfRosterEntry[];
  modules: SelfModule[];
  sessions: number;
  analytics: CohortAnalytics;
  leaderboard: StudentScore[];
}

const EMAIL_SUBJECT = "A note from your BOW Sports Capital instructor";

export default function InstructorDashboard({ instructorName, cohortName, roster, modules, sessions, analytics, leaderboard }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<Tab>("roster");

  const refresh = () => startTransition(() => router.refresh());

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allSelected = roster.length > 0 && selected.size === roster.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(roster.map((r) => r.studentId)));

  const selectedEmails = useMemo(
    () => roster.filter((r) => selected.has(r.studentId)).map((r) => r.email),
    [roster, selected],
  );

  const draftEmail = () => {
    if (selectedEmails.length === 0) return;
    // Pre-fill the user's mail client — addresses in TO, generic subject. No send.
    const mailto = `mailto:${selectedEmails.join(",")}?subject=${encodeURIComponent(EMAIL_SUBJECT)}`;
    window.location.href = mailto;
  };

  return (
    <div style={{ background: "var(--bow-paper)", minHeight: "100vh", padding: "clamp(24px,4vw,44px) clamp(16px,4vw,32px) 96px" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
          Instructor · {instructorName}
        </span>
        <h1 style={{ margin: "8px 0 6px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(32px,4.5vw,52px)", lineHeight: 0.94, letterSpacing: "-0.02em", textTransform: "uppercase", color: "var(--bow-ink)" }}>
          {cohortName} roster.
        </h1>
        <p style={{ margin: "0 0 18px", fontFamily: "var(--font-interface)", fontSize: 16, lineHeight: 1.6, color: "var(--bow-slate)" }}>
          {roster.length} student{roster.length === 1 ? "" : "s"} · manage modules, notes, and attendance without touching the database.
        </p>

        {/* TABS */}
        <div role="tablist" aria-label="Instructor views" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24, borderBottom: "1px solid var(--border-rule)", paddingBottom: 0 }}>
          {([
            { key: "roster", label: "Roster" },
            { key: "analytics", label: "Class Analytics" },
            { key: "leaderboard", label: "Cohort Leaderboard" },
          ] as { key: Tab; label: string }[]).map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                style={{ fontFamily: "var(--font-data)", fontSize: 11.5, letterSpacing: "0.06em", textTransform: "uppercase", padding: "10px 16px", border: "none", borderBottom: `2px solid ${active ? "var(--bow-blue)" : "transparent"}`, background: "transparent", color: active ? "var(--bow-ink)" : "var(--bow-slate)", cursor: "pointer", marginBottom: -1 }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "analytics" && <ClassAnalytics analytics={analytics} instructorName={instructorName} />}

        {tab === "leaderboard" && (
          <div className="bow-front-office" style={{ background: "var(--bow-ink)", color: "#fff", borderRadius: 6, padding: "clamp(20px,3vw,28px)" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)" }}>Cohort Leaderboard</span>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "#6d7078" }}>Full names — your cohort only</span>
            </div>
            <LeaderboardTable rows={leaderboard.slice(0, 25)} fullName />
          </div>
        )}

        {tab === "roster" && (
        <>
        {/* BULK EMAIL BAR */}
        <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderLeft: "4px solid var(--bow-blue)", borderRadius: 6, padding: "14px 18px", marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-ink)" }}>
            <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ width: 16, height: 16, accentColor: "var(--bow-blue)" }} />
            {selected.size > 0 ? `${selected.size} selected` : "Select students to email"}
          </label>
          <button
            onClick={draftEmail}
            disabled={selected.size === 0}
            style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13.5, letterSpacing: "0.05em", textTransform: "uppercase", padding: "11px 22px", border: "none", background: selected.size === 0 ? "var(--bow-inactive)" : "var(--bow-blue)", color: "#fff", borderRadius: 4, cursor: selected.size === 0 ? "not-allowed" : "pointer" }}
          >
            Draft Email{selected.size > 0 ? ` (${selected.size})` : ""}
          </button>
        </div>

        {isPending && (
          <p style={{ margin: "0 0 14px", fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-blue)" }}>
            Saving…
          </p>
        )}

        {roster.length === 0 ? (
          <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 28 }}>
            <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 16, lineHeight: 1.6, color: "var(--bow-slate)" }}>
              No self-paced students yet. As people sign up at <strong style={{ color: "var(--bow-ink)" }}>/join</strong>, they’ll appear here.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {roster.map((s) => (
              <StudentCard
                key={s.studentId}
                student={s}
                modules={modules}
                sessions={sessions}
                selected={selected.has(s.studentId)}
                onToggleSelect={() => toggleSelect(s.studentId)}
                refresh={refresh}
              />
            ))}
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
}

/* ---------------- student card ---------------- */

function StudentCard({
  student,
  modules,
  sessions,
  selected,
  onToggleSelect,
  refresh,
}: {
  student: SelfRosterEntry;
  modules: SelfModule[];
  sessions: number;
  selected: boolean;
  onToggleSelect: () => void;
  refresh: () => void;
}) {
  const [noteDraft, setNoteDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    await fn();
    setBusy(false);
    refresh();
  };

  const onSaveNote = () =>
    run(async () => {
      await saveStudentNote(student.studentId, noteDraft);
      setNoteDraft("");
    });

  const moduleView = (ordinal: number): SelfModuleView | undefined =>
    student.modules.find((m) => m.module.ordinal === ordinal);

  return (
    <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderLeft: selected ? "4px solid var(--bow-blue)" : "4px solid var(--border-rule)", borderRadius: 6, padding: "clamp(18px,2.4vw,24px)" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer", minWidth: 0 }}>
          <input type="checkbox" checked={selected} onChange={onToggleSelect} style={{ width: 16, height: 16, marginTop: 4, accentColor: "var(--bow-blue)" }} />
          <span style={{ minWidth: 0 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, textTransform: "uppercase", letterSpacing: "-0.01em", color: "var(--bow-ink)", display: "block", lineHeight: 1.05 }}>
              {student.name}
            </span>
            <span style={{ fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-slate)" }}>{student.email}</span>
          </span>
        </label>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)", textAlign: "right" }}>
          Last active · {student.lastActiveLabel}
        </span>
      </div>

      {/* stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 1, background: "var(--border-rule)", border: "1px solid var(--border-rule)", borderRadius: 5, overflow: "hidden", marginTop: 16 }}>
        <Stat label="Current module" value={`M${String(student.currentModuleOrdinal).padStart(2, "0")} · ${student.currentModuleTitle}`} />
        <Stat label="Completed" value={`${student.completedCount} / ${student.totalModules}`} />
        <Stat label="Reflections" value={`${student.reflectionCount}`} />
        <Stat label="Attendance" value={`${student.attendancePresent} / ${student.attendanceTotal} sessions`} />
      </div>

      {/* module override */}
      <div style={{ marginTop: 18 }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 10 }}>
          Modules · manual unlock
        </span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
          {modules.map((m) => {
            const v = moduleView(m.ordinal);
            const completed = !!v?.completed;
            const unlocked = !!v?.unlocked;
            const overridden = !!v?.instructorUnlocked;
            const dot = completed ? "var(--bow-positive)" : unlocked ? "var(--bow-blue)" : "var(--bow-inactive)";
            return (
              <div key={m.id} style={{ border: "1px solid var(--border-rule)", borderRadius: 5, padding: "10px 12px", background: "var(--bow-paper)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: dot, flexShrink: 0 }} />
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)" }}>M{String(m.ordinal).padStart(2, "0")}</span>
                  <span style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 12.5, color: "var(--bow-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.title}</span>
                </div>
                <div style={{ marginTop: 8 }}>
                  {completed ? (
                    <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--bow-positive)" }}>Done</span>
                  ) : unlocked ? (
                    overridden ? (
                      <button
                        onClick={() => run(() => instructorRelockModule(student.studentId, m.id))}
                        disabled={busy}
                        style={overrideBtn("undo")}
                      >
                        Override on · undo
                      </button>
                    ) : (
                      <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--bow-blue)" }}>Open</span>
                    )
                  ) : (
                    <button
                      onClick={() => run(() => instructorUnlockModule(student.studentId, m.id))}
                      disabled={busy}
                      style={overrideBtn("unlock")}
                    >
                      Unlock
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* attendance */}
      <div style={{ marginTop: 18 }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 10 }}>
          Attendance · tap to toggle
        </span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {Array.from({ length: sessions }).map((_, i) => {
            const present = student.attendance[i];
            return (
              <button
                key={i}
                onClick={() => run(() => setSessionAttendance(student.studentId, i + 1, !present))}
                disabled={busy}
                aria-pressed={present}
                style={{
                  width: 64,
                  padding: "8px 0",
                  borderRadius: 4,
                  border: `1px solid ${present ? "var(--bow-positive)" : "var(--border-rule)"}`,
                  background: present ? "var(--bow-positive-tint)" : "var(--bow-white)",
                  color: present ? "var(--bow-positive)" : "var(--bow-slate)",
                  fontFamily: "var(--font-data)",
                  fontSize: 11,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  cursor: busy ? "wait" : "pointer",
                }}
              >
                S{i + 1}
                <br />
                {present ? "Present" : "Absent"}
              </button>
            );
          })}
        </div>
      </div>

      {/* notes */}
      <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid var(--border-rule)" }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 10 }}>
          Session notes · last {student.notes.length > 0 ? Math.min(3, student.notes.length) : 3}
        </span>
        {student.notes.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {student.notes.map((n) => (
              <div key={n.id} style={{ border: "1px solid var(--border-rule)", borderRadius: 5, padding: "10px 12px", background: "var(--bow-paper)" }}>
                <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 13.5, lineHeight: 1.5, color: "var(--bow-ink)" }}>{n.note}</p>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, color: "var(--bow-slate)" }}>{n.authorName} · {n.createdLabel}</span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ margin: "0 0 14px", fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-slate)" }}>No notes yet.</p>
        )}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            rows={2}
            placeholder={`Add a note about ${student.first}…`}
            style={{ flex: 1, minWidth: 220, background: "var(--bow-paper)", border: "1px solid var(--border-rule)", color: "var(--bow-ink)", padding: "10px 12px", borderRadius: 4, fontFamily: "var(--font-interface)", fontSize: 13.5, lineHeight: 1.5, resize: "vertical", outline: "none" }}
          />
          <button
            onClick={onSaveNote}
            disabled={busy || noteDraft.trim() === ""}
            style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", padding: "11px 20px", border: "none", background: busy || noteDraft.trim() === "" ? "var(--bow-inactive)" : "var(--bow-ink)", color: "#fff", borderRadius: 4, cursor: busy || noteDraft.trim() === "" ? "not-allowed" : "pointer" }}
          >
            Save Note
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "var(--bow-white)", padding: "12px 14px" }}>
      <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 4 }}>{label}</span>
      <span style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 13.5, color: "var(--bow-ink)" }}>{value}</span>
    </div>
  );
}

function overrideBtn(kind: "unlock" | "undo"): React.CSSProperties {
  return {
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    padding: "6px 12px",
    border: kind === "unlock" ? "none" : "1px solid var(--border-rule)",
    background: kind === "unlock" ? "var(--bow-orange)" : "transparent",
    color: kind === "unlock" ? "#fff" : "var(--bow-slate)",
    borderRadius: 4,
    cursor: "pointer",
  };
}
