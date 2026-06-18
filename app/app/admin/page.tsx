"use client";

import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { useAppState } from "@/components/app/AppState";
import { cohorts, users, activity } from "@/lib/account";

type Tone = "warning" | "info" | "negative" | "neutral" | "positive";

const toneColor = (t: Tone): string =>
  ({
    warning: "var(--bow-warning)",
    info: "var(--bow-blue)",
    negative: "var(--bow-negative)",
    neutral: "var(--bow-slate)",
    positive: "var(--bow-positive)",
  })[t];

const eyebrow: CSSProperties = {
  fontFamily: "var(--font-data)",
  fontSize: 11,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--bow-slate)",
};

const colHead: CSSProperties = {
  ...eyebrow,
  display: "block",
  marginBottom: 12,
};

export default function AdminOverviewPage() {
  const router = useRouter();
  const { showToast } = useAppState();

  const stats = {
    active: cohorts.filter((c) => c.status === "active").length,
    enrolling: cohorts.filter((c) => c.status === "enrolling").length,
    upcoming: cohorts.filter((c) => c.status === "enrolling" || c.status === "draft").length,
    completed: cohorts.filter((c) => c.status === "completed").length,
    students: users.filter((u) => u.role === "student").length,
  };

  const statCells: { value: number; label: string; color: string }[] = [
    { value: stats.active, label: "Active cohorts", color: "var(--bow-positive)" },
    { value: stats.enrolling, label: "Enrolling", color: "var(--bow-blue)" },
    { value: stats.upcoming, label: "Upcoming starts", color: "var(--bow-warning)" },
    { value: stats.completed, label: "Completed", color: "var(--bow-ink)" },
    { value: stats.students, label: "Students", color: "var(--bow-ink)" },
  ];

  const needs: { tone: Tone; text: string; action: string; onGo: () => void }[] = [
    { tone: "warning", text: "Summit Spring — Track 101 has no instructor assigned", action: "Assign instructor", onGo: () => router.push("/app/admin/invitations") },
    { tone: "warning", text: "2 pending student invitations to Lincoln Fall", action: "View invitations", onGo: () => router.push("/app/admin/invitations") },
    { tone: "neutral", text: "1 invitation expired (Summit camp instructor)", action: "Resend", onGo: () => router.push("/app/admin/invitations") },
    { tone: "info", text: "New school inquiry from Westview School District", action: "Review", onGo: () => router.push("/app/admin/inquiries") },
    { tone: "negative", text: "Sofia Ramirez account is suspended", action: "Review person", onGo: () => router.push("/app/admin/people") },
  ];

  const quickActions: { label: string; onGo: () => void }[] = [
    { label: "Create Organization", onGo: () => router.push("/app/admin/organizations") },
    { label: "Create Cohort", onGo: () => router.push("/app/admin/cohorts") },
    { label: "Invite Instructor", onGo: () => router.push("/app/admin/invitations") },
    { label: "Invite Students", onGo: () => router.push("/app/admin/invitations") },
    { label: "Review Inquiries", onGo: () => router.push("/app/admin/inquiries") },
  ];

  return (
    <div style={{ background: "var(--bow-paper)", minHeight: "calc(100vh - 60px)", padding: "clamp(24px,4vw,44px) clamp(16px,4vw,32px) 96px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <span style={eyebrow}>BOW Administration</span>
        <h1 style={{ margin: "8px 0 26px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(32px,4.5vw,52px)", lineHeight: 0.94, letterSpacing: "-0.02em", textTransform: "uppercase", color: "var(--bow-ink)" }}>Keep every program moving.</h1>

        {/* program stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 1, background: "var(--border-rule)", border: "1px solid var(--border-rule)", borderRadius: 6, overflow: "hidden", marginBottom: 28 }}>
          {statCells.map((s) => (
            <div key={s.label} style={{ background: "var(--bow-white)", padding: "18px 16px" }}>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 30, fontWeight: 500, color: s.color, display: "block", lineHeight: 1 }}>{s.value}</span>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)" }}>{s.label}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 24 }}>
          {/* needs attention */}
          <div>
            <span style={colHead}>Needs attention</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {needs.map((n, i) => (
                <div key={i} style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderLeft: `3px solid ${toneColor(n.tone)}`, borderRadius: 5, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 14, color: "var(--bow-ink)", flex: 1, minWidth: 160 }}>{n.text}</span>
                  <span onClick={n.onGo} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 11.5, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--bow-blue)", cursor: "pointer", whiteSpace: "nowrap" }}>{n.action} →</span>
                </div>
              ))}
            </div>

            <span style={{ ...eyebrow, display: "block", margin: "26px 0 12px" }}>Recent activity</span>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {activity.map((a) => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border-rule)" }}>
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--bow-blue)", flexShrink: 0 }} />
                  <span style={{ fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-ink)", flex: 1 }}>{a.text}</span>
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)", flexShrink: 0 }}>{a.when}</span>
                </div>
              ))}
            </div>
          </div>

          {/* quick actions */}
          <div>
            <span style={colHead}>Quick actions</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {quickActions.map((q) => (
                <button
                  key={q.label}
                  onClick={() => {
                    if (q.label === "Create Organization") {
                      showToast("Create Organization — wizard is a later prototype step", "warning");
                    }
                    q.onGo();
                  }}
                  style={{ textAlign: "left", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, letterSpacing: "0.03em", textTransform: "uppercase", padding: "15px 18px", border: "1px solid var(--border-rule)", background: "var(--bow-white)", color: "var(--bow-ink)", borderRadius: 5, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}
                >
                  <span>{q.label}</span>
                  <span style={{ color: "var(--bow-blue)" }}>→</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
