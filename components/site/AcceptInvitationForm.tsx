"use client";

import { useActionState } from "react";
import { acceptInvitation, type AcceptState } from "@/app/actions/auth";

export interface InviteView {
  token: string;
  email: string;
  role: "student" | "instructor";
  roleLabel: string;
  org: string;
  cohort: string;
  track: string;
  expires: string;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bow-ink)",
  border: "1px solid var(--bow-dark-border)",
  color: "#fff",
  padding: 12,
  borderRadius: 4,
  fontFamily: "var(--font-interface)",
  fontSize: 14,
};
const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-data)",
  fontSize: 10,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "#9a9da6",
  display: "block",
  marginBottom: 6,
};
const eyebrowBlue: React.CSSProperties = {
  fontFamily: "var(--font-data)",
  fontSize: 11,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--bow-blue)",
};

export default function AcceptInvitationForm({ invite }: { invite: InviteView }) {
  const [state, action, pending] = useActionState<AcceptState, FormData>(acceptInvitation, {});
  const isStudent = invite.role === "student";

  return (
    <div
      style={{
        background: "var(--bow-dark-surface)",
        border: "1px solid var(--bow-dark-border)",
        borderTop: "4px solid var(--bow-blue)",
        borderRadius: 6,
        padding: "clamp(24px,4vw,36px)",
      }}
    >
      <span style={eyebrowBlue}>You’re invited</span>
      <h1
        style={{
          margin: "12px 0 4px",
          fontFamily: "var(--font-display)",
          fontWeight: 900,
          fontSize: "clamp(30px,4vw,44px)",
          lineHeight: 0.95,
          letterSpacing: "-0.01em",
          textTransform: "uppercase",
        }}
      >
        Join {invite.org}
      </h1>
      <p style={{ margin: "0 0 24px", fontFamily: "var(--font-interface)", fontSize: 15, color: "#b9bcc4" }}>
        You’ve been invited as a <strong style={{ color: "#fff" }}>{invite.roleLabel}</strong>. Confirm the details,
        create a password, and you’re in.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 1,
          background: "var(--bow-dark-border)",
          border: "1px solid var(--bow-dark-border)",
          marginBottom: 26,
        }}
      >
        {[
          { label: "Invited email", value: invite.email },
          { label: "Role", value: invite.roleLabel },
          { label: "Cohort", value: invite.cohort },
          { label: "Track · Expires", value: `${invite.track} · ${invite.expires}` },
        ].map((cell) => (
          <div key={cell.label} style={{ background: "var(--bow-dark-surface)", padding: "14px 16px" }}>
            <span
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 10,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#6d7078",
                display: "block",
                marginBottom: 4,
              }}
            >
              {cell.label}
            </span>
            <span style={{ fontFamily: "var(--font-interface)", fontSize: 14 }}>{cell.value}</span>
          </div>
        ))}
      </div>

      <form action={action}>
        <input type="hidden" name="token" value={invite.token} />

        {isStudent ? (
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle} htmlFor="ai-first">First name</label>
              <input id="ai-first" name="first" placeholder="First name" style={inputStyle} />
            </div>
            <div style={{ width: 130 }}>
              <label style={labelStyle} htmlFor="ai-last">Last initial</label>
              <input id="ai-last" name="last" placeholder="B." style={inputStyle} />
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle} htmlFor="ai-first">Full name</label>
            <input id="ai-first" name="first" placeholder="Your name" style={inputStyle} />
          </div>
        )}

        {isStudent && (
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle} htmlFor="ai-grade">Grade band</label>
            <input id="ai-grade" name="grade" placeholder="e.g. 8th grade" style={inputStyle} />
          </div>
        )}

        <label style={labelStyle} htmlFor="ai-pw">Create a password</label>
        <input
          id="ai-pw"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="At least 8 characters"
          style={{ ...inputStyle, marginBottom: 8 }}
        />
        <span style={{ fontFamily: "var(--font-interface)", fontSize: 12, color: "#6d7078", display: "block", marginBottom: 20 }}>
          You’ll use this with {invite.email} to sign in.
        </span>

        {state.error && (
          <p
            role="alert"
            style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-negative)", letterSpacing: "0.02em", margin: "0 0 16px" }}
          >
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          style={{
            width: "100%",
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 15,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            padding: 15,
            border: "none",
            background: "var(--bow-positive)",
            color: "#fff",
            borderRadius: 4,
            cursor: pending ? "wait" : "pointer",
            opacity: pending ? 0.7 : 1,
          }}
        >
          {pending ? "Setting up…" : "Join & Continue"}
        </button>
      </form>
    </div>
  );
}
