"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  acceptInvitation,
  previewInvitation,
  type AcceptState,
  type InvitationPreview,
} from "@/app/actions/auth";

type PreviewState =
  | { status: "checking" }
  | { status: "ready"; token: string; invite: InvitationPreview }
  | { status: "problem"; message: string };

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

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
  color: "#b9bcc4",
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
const cardStyle: React.CSSProperties = {
  background: "var(--bow-dark-surface)",
  border: "1px solid var(--bow-dark-border)",
  borderTop: "4px solid var(--bow-blue)",
  borderRadius: 6,
  padding: "clamp(24px,4vw,36px)",
};

function ProblemCard({ message }: { message: string }) {
  return (
    <section aria-labelledby="invitation-problem-title" style={{ ...cardStyle, borderTopColor: "var(--bow-warning)" }}>
      <span style={{ ...eyebrowBlue, color: "var(--bow-warning)" }}>Invitation</span>
      <h1
        id="invitation-problem-title"
        style={{ margin: "12px 0 0", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(28px,4vw,40px)", lineHeight: 1, textTransform: "uppercase" }}
      >
        A fresh link is needed
      </h1>
      <p role="alert" style={{ margin: "16px 0 26px", fontFamily: "var(--font-interface)", fontSize: 15.5, lineHeight: 1.65, color: "#d4d6dc" }}>
        {message}
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href="/sign-in" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, textTransform: "uppercase", background: "var(--bow-blue)", color: "#fff", borderRadius: 4, padding: "12px 22px", textDecoration: "none" }}>
          Go to sign in
        </Link>
        <Link href="/get-involved" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, textTransform: "uppercase", border: "1px solid var(--bow-dark-border)", color: "#fff", borderRadius: 4, padding: "12px 22px", textDecoration: "none" }}>
          Contact BOW
        </Link>
      </div>
    </section>
  );
}

export default function AcceptInvitationForm() {
  const [preview, setPreview] = useState<PreviewState>({ status: "checking" });
  const inspected = useRef(false);
  const [state, action, pending] = useActionState<AcceptState, FormData>(acceptInvitation, {});

  useEffect(() => {
    if (inspected.current) return;
    inspected.current = true;

    const fragmentToken = new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
    // Query support exists only for links already issued before fragment URLs.
    const legacyQueryToken = new URLSearchParams(window.location.search).get("token") ?? "";
    const token = fragmentToken || legacyQueryToken;

    // Scrub before making the preview request. New fragment links never put the
    // token in the initial request; old query links are cleaned immediately.
    if (window.location.hash || window.location.search) {
      window.history.replaceState(window.history.state, "", window.location.pathname);
    }

    if (!TOKEN_PATTERN.test(token)) {
      queueMicrotask(() => {
        setPreview({
          status: "problem",
          message: "This invitation link is missing, incomplete, expired, or no longer available. Ask the person who invited you to send a fresh one.",
        });
      });
      return;
    }

    void previewInvitation(token)
      .then((result) => {
        setPreview(result.ok
          ? { status: "ready", token, invite: result.invite }
          : { status: "problem", message: result.error });
      })
      .catch(() => {
        setPreview({ status: "problem", message: "BOW could not check this invitation. Wait a moment, then open the newest link again." });
      });
  }, []);

  if (preview.status === "checking") {
    return (
      <section aria-labelledby="invitation-check-title" aria-busy="true" style={cardStyle}>
        <span style={eyebrowBlue}>Private invitation</span>
        <h1 id="invitation-check-title" style={{ margin: "12px 0 10px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(30px,4vw,44px)", lineHeight: 0.95, textTransform: "uppercase" }}>
          Checking your link
        </h1>
        <p role="status" aria-live="polite" style={{ margin: 0, fontFamily: "var(--font-interface)", color: "#d4d6dc", lineHeight: 1.6 }}>
          BOW is securely opening the invitation from your email…
        </p>
      </section>
    );
  }

  if (preview.status === "problem") return <ProblemCard message={preview.message} />;

  const { invite, token } = preview;
  const isStudent = invite.role === "student";

  return (
    <section aria-labelledby="accept-invitation-title" style={cardStyle}>
      <span style={eyebrowBlue}>You’re invited</span>
      <h1
        id="accept-invitation-title"
        style={{ margin: "12px 0 4px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(30px,4vw,44px)", lineHeight: 0.95, letterSpacing: "-0.01em", textTransform: "uppercase" }}
      >
        Join {invite.org}
      </h1>
      <p style={{ margin: "0 0 24px", fontFamily: "var(--font-interface)", fontSize: 15, color: "#d4d6dc" }}>
        You’ve been invited as a <strong style={{ color: "#fff" }}>{invite.roleLabel}</strong>. Confirm the details, create a password, and you’re in.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 1, background: "var(--bow-dark-border)", border: "1px solid var(--bow-dark-border)", marginBottom: 26 }}>
        {[
          { label: "Invited email", value: invite.email },
          { label: "Role", value: invite.roleLabel },
          { label: "Cohort", value: invite.cohort },
          { label: "Track · Expires", value: `${invite.track} · ${invite.expires}` },
        ].map((cell) => (
          <div key={cell.label} style={{ background: "var(--bow-dark-surface)", padding: "14px 16px", minWidth: 0 }}>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#b9bcc4", display: "block", marginBottom: 4 }}>
              {cell.label}
            </span>
            <span style={{ fontFamily: "var(--font-interface)", fontSize: 14, overflowWrap: "anywhere" }}>{cell.value}</span>
          </div>
        ))}
      </div>

      <form action={action}>
        <input type="hidden" name="token" value={token} />

        {isStudent ? (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 120px", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle} htmlFor="ai-first">First name</label>
              <input id="ai-first" name="first" autoComplete="given-name" placeholder="First name" required maxLength={160} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle} htmlFor="ai-last">Last initial</label>
              <input id="ai-last" name="last" autoComplete="off" inputMode="text" pattern="[A-Za-z]\.?" title="Enter one letter; a period is optional" placeholder="B." maxLength={2} style={inputStyle} />
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle} htmlFor="ai-first">Full name</label>
            <input id="ai-first" name="first" autoComplete="name" placeholder="Your full name" required maxLength={160} style={inputStyle} />
          </div>
        )}

        {isStudent && (
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle} htmlFor="ai-grade">Grade band</label>
            <input id="ai-grade" name="grade" placeholder="e.g. 8th grade" maxLength={80} style={inputStyle} />
          </div>
        )}

        <label style={labelStyle} htmlFor="ai-pw">Create a password</label>
        <input id="ai-pw" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={256} placeholder="At least 8 characters" style={{ ...inputStyle, marginBottom: 8 }} />
        <span style={{ fontFamily: "var(--font-interface)", fontSize: 12, color: "#b9bcc4", display: "block", marginBottom: 20 }}>
          You’ll use this with {invite.email} to sign in.
        </span>

        {state.error && <p role="alert" aria-live="assertive" style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-negative)", margin: "0 0 16px" }}>{state.error}</p>}

        <button
          className="bow-invitation-submit"
          type="submit"
          disabled={pending}
          style={{ width: "100%", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, letterSpacing: "0.05em", textTransform: "uppercase", padding: 15, border: "none", background: "var(--bow-positive-solid)", color: "#fff", borderRadius: 4, cursor: pending ? "wait" : "pointer", opacity: pending ? 0.7 : 1 }}
        >
          {pending ? "Setting up…" : "Join & Continue"}
        </button>
      </form>
    </section>
  );
}
