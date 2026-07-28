"use client";

import { useActionState } from "react";
import { activateParentAccount, type ActivateState } from "@/app/actions/parent-activation";

/**
 * Password entry is deliberately preserved on a recoverable error (validation
 * or a temporary sign-in failure) — only the password field is cleared,
 * matching browser autofill expectations, while the name field survives so
 * the parent never has to retype everything after a rate limit or typo.
 */
export default function ActivationForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<ActivateState, FormData>(activateParentAccount, {});

  return (
    <form action={action} noValidate>
      <input type="hidden" name="token" value={token} />
      <div style={fieldWrap}>
        <label htmlFor="name" style={labelStyle}>Your name</label>
        <input id="name" name="name" type="text" autoComplete="name" maxLength={160} style={inputStyle} />
      </div>
      <div style={fieldWrap}>
        <label htmlFor="password" style={labelStyle}>Choose a password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={256}
          aria-describedby="password-help"
          style={inputStyle}
        />
        <p id="password-help" style={{ margin: "6px 0 0", fontSize: 12, color: "var(--bow-slate, #6b6e75)" }}>
          At least 8 characters.
        </p>
      </div>

      {state.error && (
        <div role="alert" style={errorStyle}>
          {state.error}
          {(state.error.includes("expired") || state.error.includes("no longer")) && (
            <div style={{ marginTop: 8 }}>
              <a href="mailto:support@bowsportscapital.com" style={{ fontSize: 13, fontWeight: 600, color: "var(--bow-orange, #d4531f)" }}>
                Contact support for a fresh link
              </a>
            </div>
          )}
        </div>
      )}

      <button type="submit" disabled={pending} style={submitStyle}>
        {pending ? "Activating…" : "Activate my account"}
      </button>
    </form>
  );
}

const fieldWrap: React.CSSProperties = { marginBottom: 16 };
const labelStyle: React.CSSProperties = { display: "block", fontFamily: "var(--font-interface)", fontSize: 13, fontWeight: 600, marginBottom: 6 };
const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 14px",
  fontSize: 16,
  border: "1px solid #cfd1d6",
  borderRadius: 6,
  fontFamily: "var(--font-interface)",
};
const errorStyle: React.CSSProperties = {
  margin: "0 0 16px",
  padding: "12px 14px",
  background: "#fbf1ee",
  border: "1px solid #e2b4a5",
  borderRadius: 6,
  fontSize: 14,
  color: "#8a3820",
};
const submitStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px 18px",
  fontSize: 16,
  fontWeight: 700,
  border: "none",
  borderRadius: 6,
  background: "var(--bow-orange, #d4531f)",
  color: "#fff",
  cursor: "pointer",
  minHeight: 48,
};
