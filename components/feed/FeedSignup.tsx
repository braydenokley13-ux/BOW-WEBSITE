"use client";

import { useActionState } from "react";
import { signUpForFeed, type FeedSignupState } from "@/app/actions/feed";

const initialState: FeedSignupState = {};

export default function FeedSignup() {
  const [state, formAction, pending] = useActionState(signUpForFeed, initialState);

  return (
    <section
      className="bow-front-office"
      style={{ background: "var(--bow-ink)", color: "#fff", minHeight: "100vh", display: "flex", alignItems: "center", padding: "clamp(32px,6vw,80px) clamp(18px,4vw,40px)" }}
    >
      <div style={{ width: "100%", maxWidth: 1040, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "clamp(28px,5vw,64px)", alignItems: "center" }}>
        {/* left: the pitch */}
        <div style={{ maxWidth: 520 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--bow-orange)" }} />
            BOW Daily Feed · Live
          </div>
          <h1 style={{ margin: "16px 0 0", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(40px,7vw,84px)", lineHeight: 0.86, letterSpacing: "-0.02em", textTransform: "uppercase" }}>
            The day&apos;s biggest
            <br />
            sports-business call
            <br />
            <span style={{ color: "#6f8bff" }}>is yours.</span>
          </h1>
          <p style={{ margin: "22px 0 0", fontFamily: "var(--font-interface)", fontSize: "clamp(15px,1.4vw,19px)", lineHeight: 1.6, color: "#b9bcc4", maxWidth: 460 }}>
            One real story at a time. Read the headline, make the GM&apos;s decision, then see what actually happened — and the economics behind it. No cohort, no class. Just you and the front office.
          </p>
          <ul style={{ margin: "24px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              "4 decisions from real sport-business events",
              "Unlock a Track 101 preview simulation",
              "Earn a completion certificate",
            ].map((t) => (
              <li key={t} style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-interface)", fontSize: 14.5, color: "#d4d6db" }}>
                <span style={{ fontFamily: "var(--font-data)", color: "var(--bow-positive)" }}>→</span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* right: the terminal sign-in */}
        <div style={{ border: "1px solid var(--bow-dark-border)", background: "var(--bow-dark-surface)" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--bow-dark-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6d7078" }}>Open your terminal</span>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "#6d7078" }}>EST · LIVE</span>
          </div>
          <form action={formAction} style={{ padding: "24px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9a9da6" }}>Display name</span>
              <input
                name="displayName"
                type="text"
                required
                minLength={2}
                maxLength={60}
                placeholder="What should we call you?"
                style={inputStyle}
              />
            </label>
            {state.error && (
              <p aria-live="polite" style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-negative)" }}>
                {state.error}
              </p>
            )}
            <button
              type="submit"
              disabled={pending}
              style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, letterSpacing: "0.05em", textTransform: "uppercase", padding: "15px 22px", border: "none", background: pending ? "var(--bow-inactive)" : "var(--bow-blue)", color: "#fff", borderRadius: 4, cursor: pending ? "wait" : "pointer" }}
            >
              {pending ? "Opening…" : "Enter the Feed"}
            </button>
            <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 12, lineHeight: 1.5, color: "#6d7078" }}>
              No email or account required. Progress stays on this device for 30 days; clearing cookies starts a fresh preview.
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--bow-ink)",
  border: "1px solid var(--bow-dark-border)",
  color: "#fff",
  padding: "12px 14px",
  borderRadius: 4,
  fontFamily: "var(--font-interface)",
  fontSize: 15,
};
