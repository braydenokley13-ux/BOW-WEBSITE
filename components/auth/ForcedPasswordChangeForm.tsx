"use client";

import { useActionState } from "react";
import { changePassword, signOut, type PasswordState } from "@/app/actions/auth";

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "var(--bow-white)",
  border: "1px solid var(--border-rule)",
  color: "var(--bow-ink)",
  padding: 12,
  borderRadius: 4,
  fontFamily: "var(--font-interface)",
  fontSize: 15,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 6,
  fontFamily: "var(--font-data)",
  fontSize: 10.5,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--bow-slate)",
};

export default function ForcedPasswordChangeForm() {
  const [state, action, pending] = useActionState<PasswordState, FormData>(changePassword, {});

  return (
    <>
      <form action={action} style={{ display: "grid", gap: 16 }}>
        <input type="hidden" name="forced" value="1" />
        <div>
          <label htmlFor="forced-current" style={labelStyle}>Temporary password</label>
          <input id="forced-current" name="current" type="password" autoComplete="current-password" required style={inputStyle} />
        </div>
        <div>
          <label htmlFor="forced-next" style={labelStyle}>New password</label>
          <input id="forced-next" name="next" type="password" autoComplete="new-password" minLength={12} required style={inputStyle} />
        </div>
        <div>
          <label htmlFor="forced-confirm" style={labelStyle}>Confirm new password</label>
          <input id="forced-confirm" name="confirm" type="password" autoComplete="new-password" minLength={12} required style={inputStyle} />
        </div>
        {state.error && (
          <p role="alert" style={{ margin: 0, color: "var(--bow-negative)", fontFamily: "var(--font-interface)", fontSize: 14 }}>
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          style={{ border: 0, borderRadius: 4, padding: "14px 20px", background: "var(--bow-blue)", color: "#fff", fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", cursor: pending ? "wait" : "pointer", opacity: pending ? 0.7 : 1 }}
        >
          {pending ? "Securing account…" : "Set new password"}
        </button>
      </form>
      <form action={signOut} style={{ marginTop: 12 }}>
        <button type="submit" style={{ width: "100%", border: 0, background: "transparent", padding: 10, color: "var(--bow-slate)", fontFamily: "var(--font-interface)", cursor: "pointer" }}>
          Sign out instead
        </button>
      </form>
    </>
  );
}
