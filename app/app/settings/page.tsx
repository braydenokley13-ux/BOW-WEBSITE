"use client";

import { useActionState } from "react";
import { useAppState } from "@/components/app/AppState";
import {
  initials,
  roleAccent,
  roleLabel,
} from "@/lib/account";
import { changePassword, type PasswordState } from "@/app/actions/auth";

export default function AccountSettingsPage() {
  const { role, me, data, signOut, showToast, askConfirm, getOrg, getCohort, activeEnrollmentFor, cohortsForInstructor, requestAccountDeletion } = useAppState();
  const [pwState, pwAction, pwPending] = useActionState<PasswordState, FormData>(changePassword, {});

  const enr = activeEnrollmentFor(me.id);
  const cohort = enr ? getCohort(enr.cohortId) : cohortsForInstructor(me.id)[0] ?? null;
  const org = getOrg(me.orgId);
  const deletionRequested = data.deletionRequests.includes(me.id);

  const setv = {
    role: roleLabel(role),
    cohort: cohort ? cohort.name : role === "admin" ? "All BOW programs" : "—",
    cohortRole: roleLabel(role),
    roleAccent: roleAccent(role),
    org: org ? org.name : "—",
  };

  const supportToast = () => showToast("Support: support@bowsportscapital.org", "positive");

  const requestDeletion = () =>
    askConfirm({
      title: "Request account deletion?",
      body: "BOW administration will review and process the request. You’ll keep access until it’s actioned.",
      confirmLabel: "Request deletion",
      tone: "warning",
      onConfirm: () => requestAccountDeletion(),
    });

  const cardStyle: React.CSSProperties = { background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 24, marginBottom: 16 };
  const lockLabel: React.CSSProperties = { fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block" };
  const lockValue: React.CSSProperties = { fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-ink)" };
  const lockTag: React.CSSProperties = { fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)" };
  const lockRow: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "13px 15px", background: "var(--bow-paper)", border: "1px solid var(--border-rule)", borderRadius: 5 };
  const actionBtn: React.CSSProperties = { textAlign: "left", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, letterSpacing: "0.03em", textTransform: "uppercase", padding: "15px 18px", borderRadius: 5, cursor: "pointer" };
  const pwInput: React.CSSProperties = { width: "100%", background: "var(--bow-paper)", border: "1px solid var(--border-rule)", color: "var(--bow-ink)", padding: 11, borderRadius: 4, fontFamily: "var(--font-interface)", fontSize: 14 };
  const pwLabel: React.CSSProperties = { fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 6 };

  const locked: { label: string; value: string }[] = [
    { label: "Role", value: setv.cohortRole },
    { label: "Organization", value: setv.org },
    { label: "Cohort", value: setv.cohort },
  ];

  return (
    <div style={{ background: "var(--bow-paper)", minHeight: "calc(100vh - 60px)", padding: "clamp(24px,4vw,44px) clamp(16px,4vw,32px) 96px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)" }}>{setv.role}</span>
        <h1 style={{ margin: "8px 0 26px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(30px,4vw,46px)", lineHeight: 0.94, letterSpacing: "-0.02em", textTransform: "uppercase", color: "var(--bow-ink)" }}>Account</h1>

        {/* identity */}
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
            <span style={{ width: 52, height: 52, borderRadius: 999, background: setv.roleAccent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18 }}>{initials(me.name)}</span>
            <div>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 24, textTransform: "uppercase", letterSpacing: "-0.01em", color: "var(--bow-ink)", display: "block", lineHeight: 1 }}>{me.name}</span>
              <span style={{ fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-slate)" }}>{me.email}</span>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "var(--border-rule)", border: "1px solid var(--border-rule)", borderRadius: 6, overflow: "hidden" }}>
            <div style={{ background: "var(--bow-white)", padding: "14px 16px" }}>
              <span style={{ ...lockLabel, marginBottom: 4 }}>Sign-in method</span>
              <span style={lockValue}>{me.signin}</span>
            </div>
            <div style={{ background: "var(--bow-white)", padding: "14px 16px" }}>
              <span style={{ ...lockLabel, marginBottom: 4 }}>Notifications</span>
              <span style={lockValue}>Session reminders · on</span>
            </div>
          </div>
        </div>

        {/* role / org / cohort */}
        <div style={cardStyle}>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 14 }}>Role &amp; program</span>
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
          <p style={{ margin: "14px 0 0", fontFamily: "var(--font-interface)", fontSize: 12.5, color: "var(--bow-slate)", lineHeight: 1.5 }}>
            Your role, organization, and cohort are managed by BOW administration. Contact support if any of these are incorrect.
          </p>
        </div>

        {/* change password */}
        <div style={cardStyle}>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 14 }}>Change password</span>
          <form action={pwAction} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={pwLabel} htmlFor="pw-current">Current password</label>
              <input id="pw-current" name="current" type="password" autoComplete="current-password" style={pwInput} />
            </div>
            <div>
              <label style={pwLabel} htmlFor="pw-new">New password</label>
              <input id="pw-new" name="next" type="password" autoComplete="new-password" style={pwInput} />
            </div>
            <div>
              <label style={pwLabel} htmlFor="pw-confirm">Confirm new password</label>
              <input id="pw-confirm" name="confirm" type="password" autoComplete="new-password" style={pwInput} />
            </div>
            <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
              <button type="submit" disabled={pwPending} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", padding: "12px 20px", border: "none", background: "var(--bow-ink)", color: "#fff", borderRadius: 4, cursor: pwPending ? "wait" : "pointer", opacity: pwPending ? 0.7 : 1 }}>{pwPending ? "Saving…" : "Update password"}</button>
              {pwState.error && <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-negative)" }}>{pwState.error}</span>}
              {pwState.ok && <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-positive)" }}>Password updated.</span>}
            </div>
          </form>
        </div>

        {/* actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={supportToast} style={{ ...actionBtn, border: "1px solid var(--border-rule)", background: "var(--bow-white)", color: "var(--bow-ink)" }}>Contact Support</button>
          {deletionRequested ? (
            <div style={{ ...actionBtn, border: "1px solid var(--border-rule)", background: "var(--bow-paper)", color: "var(--bow-slate)", cursor: "default" }}>Account deletion requested — BOW is reviewing it</div>
          ) : (
            <button onClick={requestDeletion} style={{ ...actionBtn, border: "1px solid var(--border-rule)", background: "var(--bow-white)", color: "var(--bow-slate)" }}>Request Account Deletion</button>
          )}
          <button onClick={signOut} style={{ ...actionBtn, border: "1px solid var(--bow-negative)", background: "transparent", color: "var(--bow-negative)" }}>Sign Out</button>
        </div>
      </div>
    </div>
  );
}
