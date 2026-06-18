"use client";

import { useRouter } from "next/navigation";
import { useAppState } from "@/components/app/AppState";
import {
  cohortsForInstructor,
  cohortRoster,
  getOrg,
  type Cohort,
} from "@/lib/account";
import { getLessonById } from "@/lib/lessons";

interface TodayCohortVM {
  id: string;
  name: string;
  org: string;
  track: string;
  studentCount: number;
  pending: number;
  nextSession: string;
  currentLesson: string;
}

interface NeedVM {
  text: string;
  cohort: string;
  action: string;
  color: string;
  cohortId: string;
  go: "cohort" | "session";
}

export default function InstructorTodayPage() {
  const router = useRouter();
  const { me, setSelectedCohortId, cohortCurrentLessonId } = useAppState();

  const instructorId = me?.id ?? "u-coach";

  const cohorts: TodayCohortVM[] = cohortsForInstructor(instructorId).map((c: Cohort) => {
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
      nextSession: c.nextSession,
      currentLesson: L ? L.title : "Not selected",
    };
  });

  const today = cohorts.find((c) => c.id === "coh-1") ?? cohorts[0];

  const tc = (tone: "warning" | "info"): string =>
    tone === "warning" ? "var(--bow-warning)" : "var(--bow-blue)";

  const needs: NeedVM[] = [
    { text: "2 students haven’t accepted their invitation", cohort: "Lincoln Fall — Track 101", action: "View invitations", color: tc("warning"), cohortId: "coh-1", go: "cohort" },
    { text: "Attendance not recorded for last session", cohort: "Eastside — Track 201", action: "Open session", color: tc("warning"), cohortId: "coh-2", go: "session" },
    { text: "Tyler Nguyen is waiting for access to the current lesson", cohort: "Lincoln Fall — Track 101", action: "Open cohort", color: tc("info"), cohortId: "coh-1", go: "cohort" },
  ];

  const openCohort = (id: string) => {
    setSelectedCohortId(id);
    router.push("/app/instructor/cohort");
  };
  const openSession = (id: string) => {
    setSelectedCohortId(id);
    router.push("/app/instructor/session");
  };

  return (
    <div style={{ background: "var(--bow-paper)", minHeight: "calc(100vh - 60px)", padding: "clamp(24px,4vw,44px) clamp(16px,4vw,32px) 96px" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
          Today · {me?.name ?? "Guest"}
        </span>
        <h1 style={{ margin: "8px 0 28px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(32px,4.5vw,52px)", lineHeight: 0.94, letterSpacing: "-0.02em", textTransform: "uppercase", color: "var(--bow-ink)" }}>
          What you’re teaching next.
        </h1>

        {/* dominant session card */}
        {today && (
          <div style={{ background: "var(--bow-ink)", color: "#fff", borderRadius: 6, borderTop: "4px solid var(--bow-positive)", padding: "clamp(24px,3.5vw,36px)", marginBottom: 28 }}>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#5fcf99" }}>
              Next session · {today.nextSession}
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
              <button onClick={() => openSession(today.id)} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, letterSpacing: "0.05em", textTransform: "uppercase", padding: "14px 28px", border: "none", background: "var(--bow-positive)", color: "#fff", borderRadius: 4, cursor: "pointer" }}>Open Session</button>
              <button onClick={() => openCohort(today.id)} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, letterSpacing: "0.05em", textTransform: "uppercase", padding: "14px 24px", border: "1px solid var(--bow-dark-border)", background: "transparent", color: "#fff", borderRadius: 4, cursor: "pointer" }}>View Cohort</button>
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24 }}>
          {/* my cohorts */}
          <div>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 12 }}>My cohorts</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {cohorts.map((c) => (
                <div key={c.id} onClick={() => openCohort(c.id)} style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: "18px 20px", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, textTransform: "uppercase", letterSpacing: "-0.01em", color: "var(--bow-ink)" }}>{c.name}</span>
                    <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-positive)" }}>{c.studentCount} students</span>
                  </div>
                  <p style={{ margin: "6px 0 0", fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-slate)" }}>{c.org} · {c.track}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-rule)", flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)" }}>Current ·</span>
                    <span style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 13, color: "var(--bow-ink)", flex: 1 }}>{c.currentLesson}</span>
                    <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)" }}>{c.nextSession}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* needs attention */}
          <div>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 12 }}>Needs attention</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {needs.map((n, i) => (
                <div key={i} style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderLeft: `3px solid ${n.color}`, borderRadius: 5, padding: "14px 16px" }}>
                  <p style={{ margin: "0 0 4px", fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 14, color: "var(--bow-ink)", lineHeight: 1.4 }}>{n.text}</p>
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)" }}>{n.cohort}</span>
                  <div style={{ marginTop: 8 }}>
                    <span onClick={() => (n.go === "session" ? openSession(n.cohortId) : openCohort(n.cohortId))} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 11.5, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--bow-blue)", cursor: "pointer" }}>{n.action} →</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
