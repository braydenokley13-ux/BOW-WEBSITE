"use client";

import Link from "next/link";
import { useAppState } from "@/components/app/AppState";
import type { Cohort } from "@/lib/account";
import { getLessonById } from "@/lib/lessons";
import styles from "../portal-accessibility.module.css";

interface TodayCohortVM {
  id: string;
  name: string;
  org: string;
  track: string;
  studentCount: number;
  pending: number;
  scheduleNote: string;
  currentLesson: string;
}

interface NeedVM {
  text: string;
  cohort: string;
  action: string;
  color: string;
  cohortId: string;
  go: "cohort" | "delivery";
}

export default function InstructorTodayPage() {
  const { me, setSelectedCohortId, cohortCurrentLessonId, cohortsForInstructor, cohortRoster, getOrg, attendanceOf } = useAppState();

  const myCohorts = cohortsForInstructor(me.id);

  const cohorts: TodayCohortVM[] = myCohorts.map((c: Cohort) => {
    const roster = cohortRoster(c.id);
    const active = roster.filter((e) => e.enroll === "active" || e.enroll === "suspended").length;
    const pending = roster.filter((e) => e.enroll === "invited").length;
    const curId = cohortCurrentLessonId(c);
    const L = curId ? getLessonById(curId) : undefined;
    return {
      id: c.id,
      name: c.name,
      org: getOrg(c.orgId)?.name ?? "—",
      track: "Track " + c.track,
      studentCount: active,
      pending,
      scheduleNote: c.nextSession,
      currentLesson: L ? L.title : "Not selected",
    };
  });

  const today = cohorts.find((c) => c.studentCount > 0) ?? cohorts[0];

  // Real "needs attention" computed from the live roster, attendance and progress.
  const needs: NeedVM[] = [];
  for (const c of myCohorts) {
    const roster = cohortRoster(c.id);
    const pending = roster.filter((e) => e.enroll === "invited");
    const notStarted = roster.filter((e) => e.enroll === "active" && e.lessonStatus === "not-started");
    const absent = roster.filter((e) => e.enroll === "active" && attendanceOf(c.id, e.userId, "none") === "absent");
    if (pending.length) needs.push({ text: `${pending.length} student${pending.length > 1 ? "s haven’t" : " hasn’t"} accepted their invitation`, cohort: c.name, action: "View cohort", color: "var(--bow-warning)", cohortId: c.id, go: "cohort" });
    if (absent.length) needs.push({ text: `${absent.length} marked absent last session`, cohort: c.name, action: "Review class sessions", color: "var(--bow-warning)", cohortId: c.id, go: "delivery" });
    if (notStarted.length) needs.push({ text: `${notStarted.length} haven’t started the current lesson`, cohort: c.name, action: "Open cohort", color: "var(--bow-blue)", cohortId: c.id, go: "cohort" });
  }
  const topNeeds = needs.slice(0, 4);

  const selectCohort = (id: string) => {
    setSelectedCohortId(id);
  };

  return (
    <div style={{ background: "var(--bow-paper)", minHeight: "calc(100vh - 60px)", padding: "clamp(24px,4vw,44px) clamp(16px,4vw,32px) 96px" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
          Today · {me.name}
        </span>
        <h1 style={{ margin: "8px 0 12px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(32px,4.5vw,52px)", lineHeight: 0.94, letterSpacing: "-0.02em", textTransform: "uppercase", color: "var(--bow-ink)" }}>
          Your delivery workspace.
        </h1>
        <Link href="/app/instructor/learn" style={{ display: "inline-block", marginBottom: 24, fontFamily: "var(--font-data)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--bow-blue)", textDecoration: "none" }}>
          Playbook Engine cohort console →
        </Link>

        {!today && (
          <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 28 }}>
            <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 16, lineHeight: 1.6, color: "var(--bow-slate)" }}>You’re not assigned to a cohort yet. A BOW administrator will place you with one soon.</p>
          </div>
        )}

        {today && (
          <div style={{ background: "var(--bow-ink)", color: "#fff", borderRadius: 6, borderTop: "4px solid var(--bow-positive)", padding: "clamp(24px,3.5vw,36px)", marginBottom: 28 }}>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#5fcf99" }}>
              Cohort schedule · {today.scheduleNote}
            </span>
            <h2 style={{ margin: "8px 0 4px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(26px,3.5vw,40px)", lineHeight: 1.0, letterSpacing: "-0.01em", textTransform: "uppercase" }}>
              {today.name}
            </h2>
            <p style={{ margin: "0 0 20px", fontFamily: "var(--font-interface)", fontSize: 15, color: "#b9bcc4" }}>
              {today.org} · {today.track} · {today.studentCount} students
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 22 }}>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9a9da6" }}>Current lesson</span>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, textTransform: "uppercase", letterSpacing: "-0.01em", color: "#fff" }}>{today.currentLesson}</span>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link className={styles.focusTarget} href={`/app/teach/classes/${today.id}`} onClick={() => selectCohort(today.id)} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, letterSpacing: "0.05em", textTransform: "uppercase", padding: "14px 28px", border: "none", background: "var(--bow-positive)", color: "#fff", borderRadius: 4, cursor: "pointer" }}>Open Delivery Class</Link>
              <Link className={styles.focusTarget} href="/app/instructor/cohort" onClick={() => selectCohort(today.id)} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, letterSpacing: "0.05em", textTransform: "uppercase", padding: "14px 24px", border: "1px solid var(--bow-dark-border)", background: "transparent", color: "#fff", borderRadius: 4, cursor: "pointer" }}>View Cohort</Link>
            </div>
          </div>
        )}

        {today && (
          <div className={styles.instructorOverviewGrid}>
            <div>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 12 }}>My cohorts</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {cohorts.map((c) => (
                  <Link aria-label={`Open cohort ${c.name}`} className={styles.focusTarget} href="/app/instructor/cohort" key={c.id} onClick={() => selectCohort(c.id)} style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: "18px 20px", cursor: "pointer", display: "block" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, textTransform: "uppercase", letterSpacing: "-0.01em", color: "var(--bow-ink)" }}>{c.name}</span>
                      <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-positive)" }}>{c.studentCount} students{c.pending ? ` · ${c.pending} pending` : ""}</span>
                    </div>
                    <p style={{ margin: "6px 0 0", fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-slate)" }}>{c.org} · {c.track}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-rule)", flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)" }}>Current ·</span>
                      <span style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 13, color: "var(--bow-ink)", flex: 1 }}>{c.currentLesson}</span>
                      <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)" }}>Schedule · {c.scheduleNote}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 12 }}>Needs attention</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {topNeeds.length === 0 && (
                  <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 5, padding: "14px 16px" }}>
                    <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-slate)" }}>Nothing needs your attention right now. Nice.</p>
                  </div>
                )}
                {topNeeds.map((n, i) => (
                  <div key={i} style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderLeft: `3px solid ${n.color}`, borderRadius: 5, padding: "14px 16px" }}>
                    <p style={{ margin: "0 0 4px", fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 14, color: "var(--bow-ink)", lineHeight: 1.4 }}>{n.text}</p>
                    <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)" }}>{n.cohort}</span>
                    <div style={{ marginTop: 8 }}>
                      <Link className={styles.focusTarget} href={n.go === "delivery" ? `/app/teach/classes/${n.cohortId}` : "/app/instructor/cohort"} onClick={() => selectCohort(n.cohortId)} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 11.5, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--bow-blue)", cursor: "pointer", display: "inline-block" }}>{n.action} →</Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
