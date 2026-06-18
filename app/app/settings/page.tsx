"use client";

import { useRouter } from "next/navigation";
import { useAppState } from "@/components/app/AppState";
import {
  getCohort,
  getOrg,
  getUser,
  initials,
  roleAccent,
  roleLabel,
  cohortsForInstructor,
  enrollments,
  type Role,
} from "@/lib/account";

export default function AccountSettingsPage() {
  const { role, me, signOut, showToast, askConfirm } = useAppState();
  const router = useRouter();

  // The prototype always renders a user; fall back to u-s1 so the screen
  // always has something to show even before a role is chosen.
  const u = me ?? getUser("u-s1");
  if (!u) return null;
  const effectiveRole: Role = role ?? u.role;

  const enr = enrollments.find((e) => e.userId === u.id);
  const cohort = enr ? getCohort(enr.cohortId) : cohortsForInstructor(u.id)[0] ?? null;
  const org = getOrg(u.orgId);

  const setv = {
    role: roleLabel(effectiveRole),
    name: u.name,
    email: u.email,
    signin: u.signin,
    org: org ? org.name : "—",
    cohort: cohort ? cohort.name : effectiveRole === "admin" ? "All BOW programs" : "—",
    cohortRole:
      effectiveRole === "instructor" ? "Instructor" : effectiveRole === "admin" ? "Administrator" : "Student",
    roleAccent: roleAccent(effectiveRole),
  };
  const userInitial = initials(u.name);

  const supportToast = () => showToast("Support: support@bowsportscapital.org", "positive");

  const deleteToast = () =>
    askConfirm({
      title: "Request account deletion?",
      body: "Account-deletion requests are reviewed and handled by BOW administration. This is a prototype — no account will be removed.",
      confirmLabel: "Request deletion",
      tone: "warning",
      onConfirm: () => {
        // TODO: wire to backend
        showToast("Account-deletion requests are handled by BOW (prototype)", "warning");
      },
    });

  const shellSignOut = () => {
    signOut();
    router.push("/");
  };

  const cardStyle: React.CSSProperties = {
    background: "var(--bow-white)",
    border: "1px solid var(--border-rule)",
    borderRadius: 6,
    padding: 24,
    marginBottom: 16,
  };
  const lockLabel: React.CSSProperties = {
    fontFamily: "var(--font-data)",
    fontSize: 10,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "var(--bow-slate)",
    display: "block",
  };
  const lockValue: React.CSSProperties = {
    fontFamily: "var(--font-interface)",
    fontSize: 14,
    color: "var(--bow-ink)",
  };
  const lockTag: React.CSSProperties = {
    fontFamily: "var(--font-data)",
    fontSize: 10,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--bow-slate)",
  };
  const lockRow: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "13px 15px",
    background: "var(--bow-paper)",
    border: "1px solid var(--border-rule)",
    borderRadius: 5,
  };
  const actionBtn: React.CSSProperties = {
    textAlign: "left",
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: 14,
    letterSpacing: "0.03em",
    textTransform: "uppercase",
    padding: "15px 18px",
    borderRadius: 5,
    cursor: "pointer",
  };

  const locked: { label: string; value: string }[] = [
    { label: "Role", value: setv.cohortRole },
    { label: "Organization", value: setv.org },
    { label: "Cohort", value: setv.cohort },
  ];

  return (
    <div
      style={{
        background: "var(--bow-paper)",
        minHeight: "calc(100vh - 60px)",
        padding: "clamp(24px,4vw,44px) clamp(16px,4vw,32px) 96px",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--bow-slate)",
          }}
        >
          {setv.role}
        </span>
        <h1
          style={{
            margin: "8px 0 26px",
            fontFamily: "var(--font-display)",
            fontWeight: 900,
            fontSize: "clamp(30px,4vw,46px)",
            lineHeight: 0.94,
            letterSpacing: "-0.02em",
            textTransform: "uppercase",
            color: "var(--bow-ink)",
          }}
        >
          Account
        </h1>

        {/* identity */}
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
            <span
              style={{
                width: 52,
                height: 52,
                borderRadius: 999,
                background: setv.roleAccent,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 18,
              }}
            >
              {userInitial}
            </span>
            <div>
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 900,
                  fontSize: 24,
                  textTransform: "uppercase",
                  letterSpacing: "-0.01em",
                  color: "var(--bow-ink)",
                  display: "block",
                  lineHeight: 1,
                }}
              >
                {setv.name}
              </span>
              <span style={{ fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-slate)" }}>
                {setv.email}
              </span>
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 1,
              background: "var(--border-rule)",
              border: "1px solid var(--border-rule)",
              borderRadius: 6,
              overflow: "hidden",
            }}
          >
            <div style={{ background: "var(--bow-white)", padding: "14px 16px" }}>
              <span style={{ ...lockLabel, marginBottom: 4 }}>Sign-in method</span>
              <span style={lockValue}>{setv.signin}</span>
            </div>
            <div style={{ background: "var(--bow-white)", padding: "14px 16px" }}>
              <span style={{ ...lockLabel, marginBottom: 4 }}>Notifications</span>
              <span style={lockValue}>Session reminders · on</span>
            </div>
          </div>
        </div>

        {/* locked: role / org / cohort */}
        <div style={cardStyle}>
          <span
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--bow-slate)",
              display: "block",
              marginBottom: 14,
            }}
          >
            Role &amp; program
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {locked.map((row) => (
              <div key={row.label} style={lockRow}>
                <div>
                  <span style={lockLabel}>{row.label}</span>
                  <span style={lockValue}>{row.value}</span>
                </div>
                <span style={lockTag}>🔒 Set by BOW</span>
              </div>
            ))}
          </div>
          <p
            style={{
              margin: "14px 0 0",
              fontFamily: "var(--font-interface)",
              fontSize: 12.5,
              color: "var(--bow-slate)",
              lineHeight: 1.5,
            }}
          >
            Your role, organization, and cohort are managed by BOW administration. Contact support if any of these are
            incorrect.
          </p>
        </div>

        {/* actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={supportToast}
            style={{
              ...actionBtn,
              border: "1px solid var(--border-rule)",
              background: "var(--bow-white)",
              color: "var(--bow-ink)",
            }}
          >
            Contact Support
          </button>
          <button
            onClick={deleteToast}
            style={{
              ...actionBtn,
              border: "1px solid var(--border-rule)",
              background: "var(--bow-white)",
              color: "var(--bow-slate)",
            }}
          >
            Request Account Deletion
          </button>
          <button
            onClick={shellSignOut}
            style={{
              ...actionBtn,
              border: "1px solid var(--bow-negative)",
              background: "transparent",
              color: "var(--bow-negative)",
            }}
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
