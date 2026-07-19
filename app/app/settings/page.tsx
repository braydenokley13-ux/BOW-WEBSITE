"use client";

import { useActionState } from "react";
import { useAppState } from "@/components/app/AppState";
import { Button } from "@/components/ds";
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
      onConfirm: async () => (await requestAccountDeletion()),
    });

  const locked: { label: string; value: string }[] = [
    { label: "Role", value: setv.cohortRole },
    { label: "Organization", value: setv.org },
    { label: "Cohort", value: setv.cohort },
  ];

  return (
    <main className="ops-page">
      <header className="ops-hero">
        <div className="ops-hero__copy">
          <span className="ops-eyebrow">{setv.role}</span>
          <h1 className="ops-title">Account</h1>
        </div>
      </header>

      <section className="ops-panel ops-panel--flat" aria-labelledby="settings-identity-title">
        <div className="ops-section-head">
          <div><h2 id="settings-identity-title" className="ops-section-title">Identity</h2></div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <span style={{ width: 52, height: 52, borderRadius: 999, background: setv.roleAccent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18 }}>{initials(me.name)}</span>
          <div>
            <span className="ops-record-name" style={{ display: "block" }}>{me.name}</span>
            <span className="ops-record-meta" style={{ textTransform: "none", letterSpacing: 0, fontSize: 13.5 }}>{me.email}</span>
          </div>
        </div>
        <div className="ops-meta-grid">
          <div className="ops-meta">
            <span className="ops-label">Sign-in method</span>
            <span className="ops-value">{me.signin}</span>
          </div>
          <div className="ops-meta">
            <span className="ops-label">Notifications</span>
            <span className="ops-value">Session reminders · on</span>
          </div>
        </div>
      </section>

      <section className="ops-panel ops-panel--flat" aria-labelledby="settings-role-title">
        <div className="ops-section-head">
          <div><h2 id="settings-role-title" className="ops-section-title">Role &amp; program</h2></div>
        </div>
        <div className="ops-list">
          {locked.map((row) => (
            <div className="ops-list-row ops-list-row--compact" key={row.label}>
              <span className="ops-label">{row.label}</span>
              <span className="ops-value">{row.value}</span>
              <span className="ops-record-meta">Set by BOW</span>
            </div>
          ))}
        </div>
        <p className="ops-section-note" style={{ marginTop: 14 }}>
          Your role, organization, and cohort are managed by BOW administration. Contact support if any of these are incorrect.
        </p>
      </section>

      <section className="ops-panel ops-panel--flat" aria-labelledby="settings-password-title">
        <div className="ops-section-head">
          <div><h2 id="settings-password-title" className="ops-section-title">Change password</h2></div>
        </div>
        <form action={pwAction} className="ops-form">
          <div className="ops-fields">
            <div className="ops-field ops-field--wide">
              <label htmlFor="pw-current">Current password</label>
              <input id="pw-current" name="current" type="password" autoComplete="current-password" />
            </div>
            <div className="ops-field">
              <label htmlFor="pw-new">New password</label>
              <input id="pw-new" name="next" type="password" autoComplete="new-password" />
            </div>
            <div className="ops-field">
              <label htmlFor="pw-confirm">Confirm new password</label>
              <input id="pw-confirm" name="confirm" type="password" autoComplete="new-password" />
            </div>
          </div>
          <div className="ops-form-footer" style={{ justifyContent: "flex-start" }}>
            <Button type="submit" variant="ink" size="sm" disabled={pwPending}>{pwPending ? "Saving…" : "Update password"}</Button>
            {pwState.error && <span className="ops-error">{pwState.error}</span>}
            {pwState.ok && <span className="ops-success">Password updated.</span>}
          </div>
        </form>
      </section>

      <section className="ops-panel ops-panel--flat" aria-label="Account actions">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Button variant="secondary" size="md" onClick={supportToast} style={{ justifyContent: "flex-start" }}>Contact Support</Button>
          {deletionRequested ? (
            <p className="ops-body">Account deletion requested — BOW is reviewing it.</p>
          ) : (
            <Button variant="secondary" size="md" onClick={requestDeletion} style={{ justifyContent: "flex-start" }}>Request Account Deletion</Button>
          )}
          <Button variant="secondary" size="md" onClick={signOut} style={{ justifyContent: "flex-start", borderColor: "var(--bow-negative)", color: "var(--bow-negative)" }}>Sign Out</Button>
        </div>
      </section>
    </main>
  );
}
