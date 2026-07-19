"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, type CSSProperties } from "react";
import {
  requestPasswordReset,
  resetPassword,
  type PasswordResetRequestState,
  type PasswordResetState,
} from "@/app/actions/auth";

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: 7,
  fontFamily: "var(--font-data)",
  fontSize: 11,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "#9a9da6",
};

const inputStyle: CSSProperties = {
  width: "100%",
  background: "var(--bow-dark-surface)",
  border: "1px solid var(--bow-dark-border)",
  color: "#fff",
  padding: "13px 14px",
  fontFamily: "var(--font-interface)",
  fontSize: 15,
  borderRadius: 4,
};

const buttonStyle: CSSProperties = {
  width: "100%",
  background: "var(--bow-blue)",
  color: "#fff",
  border: 0,
  padding: 15,
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: 15,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  borderRadius: 4,
};

const linkStyle: CSSProperties = {
  color: "#fff",
  fontFamily: "var(--font-interface)",
  fontSize: 14,
  textUnderlineOffset: 3,
};

function RecoveryShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="bow-front-office"
      style={{ minHeight: "80vh", display: "grid", placeItems: "center", background: "var(--bow-ink)", color: "#fff", padding: 20 }}
    >
      <section aria-labelledby="recovery-title" style={{ width: "min(100%, 480px)", border: "1px solid var(--bow-dark-border)", borderRadius: 8, background: "var(--bow-dark-surface)", padding: "clamp(26px,6vw,44px)" }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-blue)" }}>
          {eyebrow}
        </span>
        <h1 id="recovery-title" style={{ margin: "9px 0 13px", fontFamily: "var(--font-display)", fontSize: "clamp(34px,9vw,50px)", fontWeight: 900, lineHeight: 0.95, textTransform: "uppercase" }}>
          {title}
        </h1>
        <p style={{ margin: "0 0 26px", fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.65, color: "#b9bcc4" }}>
          {description}
        </p>
        {children}
      </section>
    </div>
  );
}

function Status({ children, error = false }: { children: React.ReactNode; error?: boolean }) {
  return (
    <p
      role={error ? "alert" : "status"}
      aria-live="polite"
      style={{ margin: "0 0 18px", padding: "13px 14px", border: "1px solid var(--bow-dark-border)", borderLeft: `4px solid ${error ? "var(--bow-negative)" : "var(--bow-positive)"}`, borderRadius: 4, color: error ? "#fff" : "#d7f9e3", fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.55 }}
    >
      {children}
    </p>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<PasswordResetRequestState, FormData>(requestPasswordReset, {});

  return (
    <RecoveryShell
      eyebrow="Account recovery"
      title="Reset your password"
      description="Enter the email used for your BOW account. For privacy, we show the same confirmation whether or not an active account exists."
    >
      {state.message && <Status>{state.message}</Status>}
      <form action={action} style={{ display: "grid", gap: 18 }}>
        <div>
          <label htmlFor="recovery-email" style={labelStyle}>Email</label>
          <input id="recovery-email" name="email" type="email" autoComplete="email" maxLength={320} required style={inputStyle} />
        </div>
        <button type="submit" disabled={pending} style={{ ...buttonStyle, cursor: pending ? "wait" : "pointer", opacity: pending ? 0.7 : 1 }}>
          {pending ? "Sending securely…" : "Send reset link"}
        </button>
      </form>
      {state.resetUrl && (
        <p style={{ margin: "18px 0 0", fontFamily: "var(--font-interface)", fontSize: 13, lineHeight: 1.55, color: "#b9bcc4", overflowWrap: "anywhere" }}>
          Development-only link: <Link href={state.resetUrl} style={linkStyle}>open password reset</Link>
        </p>
      )}
      <p style={{ margin: "22px 0 0", textAlign: "center" }}>
        <Link href="/sign-in" style={linkStyle}>Return to sign in</Link>
      </p>
    </RecoveryShell>
  );
}

export function ResetPasswordForm() {
  // `null` means the browser has not inspected its fragment yet. New links put
  // the bearer token after `#`, which keeps it out of the HTTP request and
  // ordinary access logs. Query parsing remains only for already-sent links.
  const [token, setToken] = useState<string | null>(null);
  const [state, action, pending] = useActionState<PasswordResetState, FormData>(resetPassword, {});

  useEffect(() => {
    const fragmentToken = new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
    const legacyQueryToken = new URLSearchParams(window.location.search).get("token") ?? "";
    const suppliedToken = fragmentToken || legacyQueryToken;
    // Functional state keeps React's development Strict Mode effect replay from
    // replacing the captured token after the first pass cleans the URL.
    queueMicrotask(() => setToken((current) => current ?? suppliedToken));
    if (suppliedToken && (window.location.hash || window.location.search)) {
      // Keep the secret in component memory for the form, but remove it from
      // the visible URL and current browser-history entry after hydration.
      window.history.replaceState(window.history.state, "", "/reset-password");
    }
  }, []);

  if (token === null) {
    return (
      <RecoveryShell
        eyebrow="Account recovery"
        title="Checking reset link"
        description="BOW is securely opening the password-reset link from your email."
      >
        <div aria-busy="true"><Status>Checking your private reset link…</Status></div>
      </RecoveryShell>
    );
  }

  if (state.ok) {
    return (
      <RecoveryShell
        eyebrow="Account secured"
        title="Password updated"
        description="Your password has been changed and every existing session has been signed out. Sign in again with your new password."
      >
        <Status>Your new password is ready. BOW did not sign you in automatically.</Status>
        <Link href="/sign-in" style={{ ...buttonStyle, display: "block", textAlign: "center", textDecoration: "none" }}>
          Return to sign in
        </Link>
      </RecoveryShell>
    );
  }

  if (!token) {
    return (
      <RecoveryShell
        eyebrow="Account recovery"
        title="Reset link needed"
        description="This page needs the private token from your password-reset email. Request a new link to continue."
      >
        <Status error>This password-reset link is missing or incomplete.</Status>
        <Link href="/forgot-password" style={{ ...buttonStyle, display: "block", textAlign: "center", textDecoration: "none" }}>
          Request a new link
        </Link>
      </RecoveryShell>
    );
  }

  return (
    <RecoveryShell
      eyebrow="Account recovery"
      title="Choose a new password"
      description="Use at least 12 characters and a password you do not use for another account. This link expires 30 minutes after it was requested."
    >
      {state.error && <Status error>{state.error}</Status>}
      <form action={action} style={{ display: "grid", gap: 18 }}>
        <input type="hidden" name="token" value={token} />
        <div>
          <label htmlFor="reset-password" style={labelStyle}>New password</label>
          <input id="reset-password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={256} required style={inputStyle} />
        </div>
        <div>
          <label htmlFor="reset-confirm" style={labelStyle}>Confirm new password</label>
          <input id="reset-confirm" name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={256} required style={inputStyle} />
        </div>
        <button type="submit" disabled={pending} style={{ ...buttonStyle, cursor: pending ? "wait" : "pointer", opacity: pending ? 0.7 : 1 }}>
          {pending ? "Securing account…" : "Set new password"}
        </button>
      </form>
      <p style={{ margin: "22px 0 0", textAlign: "center" }}>
        <Link href="/forgot-password" style={linkStyle}>Request a different link</Link>
      </p>
    </RecoveryShell>
  );
}
