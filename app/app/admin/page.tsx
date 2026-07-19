"use client";

import { useRouter } from "next/navigation";
import { useAppState } from "@/components/app/AppState";

type Tone = "warning" | "info" | "negative" | "neutral" | "positive";

const toneColor = (t: Tone): string =>
  ({
    warning: "var(--bow-warning)",
    info: "var(--bow-blue)",
    negative: "var(--bow-negative)",
    neutral: "var(--bow-slate)",
    positive: "var(--bow-positive)",
  })[t];

export default function AdminOverviewPage() {
  const router = useRouter();
  const { data } = useAppState();

  const { cohorts, users, invitations, inquiries, activity, deletionRequests } = data;

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

  // Real "needs attention", derived from the live snapshot.
  const needs: { tone: Tone; text: string; action: string; onGo: () => void }[] = [];
  cohorts
    .filter((c) => (c.status === "active" || c.status === "enrolling") && !c.instructorId)
    .forEach((c) => needs.push({ tone: "warning", text: `${c.name} has no instructor assigned`, action: "Assign", onGo: () => router.push("/app/admin/cohorts") }));
  const pendingInv = invitations.filter((i) => i.status === "pending").length;
  if (pendingInv) needs.push({ tone: "info", text: `${pendingInv} pending invitation${pendingInv > 1 ? "s" : ""} awaiting acceptance`, action: "View", onGo: () => router.push("/app/admin/invitations") });
  const expiredInv = invitations.filter((i) => i.status === "expired").length;
  if (expiredInv) needs.push({ tone: "neutral", text: `${expiredInv} invitation${expiredInv > 1 ? "s" : ""} expired`, action: "Resend", onGo: () => router.push("/app/admin/invitations") });
  const newInq = inquiries.filter((i) => i.status === "new").length;
  if (newInq) needs.push({ tone: "info", text: `${newInq} new inquir${newInq > 1 ? "ies" : "y"} to review`, action: "Review", onGo: () => router.push("/app/admin/inquiries") });
  const suspended = users.filter((u) => u.status === "suspended").length;
  if (suspended) needs.push({ tone: "negative", text: `${suspended} suspended account${suspended > 1 ? "s" : ""}`, action: "Review", onGo: () => router.push("/app/admin/people") });
  if (deletionRequests.length) needs.push({ tone: "negative", text: `${deletionRequests.length} account-deletion request${deletionRequests.length > 1 ? "s" : ""}`, action: "Review", onGo: () => router.push("/app/admin/people") });
  const topNeeds = needs.slice(0, 6);

  const quickActions: { label: string; onGo: () => void }[] = [
    { label: "Create Organization", onGo: () => router.push("/app/admin/organizations") },
    { label: "Create Cohort", onGo: () => router.push("/app/admin/cohorts") },
    { label: "Invite Instructor", onGo: () => router.push("/app/admin/invitations") },
    { label: "Invite Students", onGo: () => router.push("/app/admin/invitations") },
    { label: "Review Inquiries", onGo: () => router.push("/app/admin/inquiries") },
  ];

  return (
    <main className="ops-page">
      <header className="ops-hero">
        <div className="ops-hero__copy">
          <span className="ops-eyebrow">BOW Administration</span>
          <h1 className="ops-title">Keep every program moving.</h1>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 1, background: "var(--border-rule)", border: "1px solid var(--border-rule)", borderRadius: 6, overflow: "hidden" }}>
        {statCells.map((s) => (
          <div key={s.label} style={{ background: "var(--bow-white)", padding: "18px 16px" }}>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 30, fontWeight: 500, color: s.color, display: "block", lineHeight: 1 }}>{s.value}</span>
            <span className="ops-label">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="ops-grid">
        <div className="ops-stack">
          <section>
            <div className="ops-section-head">
              <span className="ops-section-title" style={{ fontSize: 20 }}>Needs attention</span>
            </div>
            {topNeeds.length === 0 ? (
              <div className="ops-empty">
                <p className="ops-empty__body" style={{ margin: 0 }}>Everything&apos;s in order. Nothing needs your attention.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {topNeeds.map((n) => (
                  <div key={`${n.action}-${n.text}`} className="ops-panel" style={{ borderLeft: `3px solid ${toneColor(n.tone)}`, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 14, color: "var(--bow-ink)", flex: 1, minWidth: 160 }}>{n.text}</span>
                    <button type="button" onClick={n.onGo} className="ops-inline-link" style={{ cursor: "pointer", whiteSpace: "nowrap", background: "transparent", border: 0, padding: "6px 0 6px 10px" }}>
                      {n.action} →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="ops-section-head">
              <span className="ops-section-title" style={{ fontSize: 20 }}>Recent activity</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {activity.map((a) => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border-rule)" }}>
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--bow-blue)", flexShrink: 0 }} />
                  <span style={{ fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-ink)", flex: 1 }}>{a.text}</span>
                  <span className="ops-record-meta">{a.when}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div>
          <span className="ops-label" style={{ display: "block", marginBottom: 12 }}>Quick actions</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {quickActions.map((q) => (
              <button
                type="button"
                key={q.label}
                onClick={q.onGo}
                className="ops-panel"
                style={{ textAlign: "left", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, letterSpacing: "0.03em", textTransform: "uppercase", padding: "15px 18px", color: "var(--bow-ink)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}
              >
                <span>{q.label}</span>
                <span style={{ color: "var(--bow-blue)" }}>→</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
