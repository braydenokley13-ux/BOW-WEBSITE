"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { CSSProperties } from "react";
import { joinSelfPaced, type AuthState } from "@/app/actions/auth";

const labelStyle: CSSProperties = {
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

const POINTS = [
  "Start Track 101 tonight — no instructor code, no cohort",
  "Six modules that unlock as you go, at your own pace",
  "A daily sports-business briefing to keep you sharp",
];

export default function JoinForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(joinSelfPaced, {});

  return (
    <div
      className="bow-front-office"
      style={{ background: "var(--bow-ink)", color: "#fff", minHeight: "80vh", display: "flex", flexDirection: "column" }}
    >
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          alignItems: "stretch",
        }}
      >
        {/* brand panel */}
        <div
          style={{
            padding: "clamp(36px,5vw,72px) clamp(18px,4vw,48px)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            borderRight: "1px solid var(--bow-dark-border)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "linear-gradient(rgba(49,87,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(49,87,255,0.05) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
              opacity: 0.6,
            }}
          />
          <div style={{ position: "relative", maxWidth: 460 }}>
            <span
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 11,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--bow-orange)",
              }}
            >
              Self-Paced · Track 101
            </span>
            <h1
              style={{
                margin: "14px 0 0",
                fontFamily: "var(--font-display)",
                fontWeight: 900,
                fontSize: "clamp(40px,5.2vw,68px)",
                lineHeight: 0.9,
                letterSpacing: "-0.02em",
                textTransform: "uppercase",
              }}
            >
              Run the front office on your own clock.
            </h1>
            <div
              style={{
                height: 6,
                width: 130,
                background: "var(--bow-orange)",
                margin: "24px 0",
                clipPath: "polygon(0 0, 70% 0, 70% 50%, 100% 50%, 100% 100%, 0 100%)",
              }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {POINTS.map((p) => (
                <div key={p} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                  <span style={{ color: "var(--bow-positive)", fontSize: 12 }}>●</span>
                  <span style={{ fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.5, color: "#b9bcc4" }}>{p}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* form panel */}
        <div
          style={{
            padding: "clamp(32px,4vw,64px) clamp(18px,4vw,48px)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <form action={action} style={{ maxWidth: 400, width: "100%", margin: "0 auto" }}>
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 900,
                fontSize: 24,
                textTransform: "uppercase",
                letterSpacing: "-0.01em",
                display: "block",
                marginBottom: 22,
              }}
            >
              Create your account
            </span>

            {state.error && (
              <div
                role="alert"
                style={{
                  border: "1px solid var(--bow-dark-border)",
                  borderLeft: "4px solid var(--bow-negative)",
                  padding: "16px 18px",
                  marginBottom: 22,
                  background: "var(--bow-dark-surface)",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: 14,
                    textTransform: "uppercase",
                    letterSpacing: "0.02em",
                    display: "block",
                    marginBottom: 5,
                  }}
                >
                  Couldn’t create your account
                </span>
                <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 13.5, lineHeight: 1.55, color: "#b9bcc4" }}>
                  {state.error}
                </p>
              </div>
            )}

            <label htmlFor="jn-name" style={{ ...labelStyle, display: "block", marginBottom: 7 }}>
              Your name
            </label>
            <input
              id="jn-name"
              name="name"
              type="text"
              autoComplete="name"
              required
              placeholder="Jordan Avery"
              style={{ ...inputStyle, marginBottom: 18 }}
            />

            <label htmlFor="jn-email" style={{ ...labelStyle, display: "block", marginBottom: 7 }}>
              Email
            </label>
            <input
              id="jn-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@email.com"
              style={{ ...inputStyle, marginBottom: 18 }}
            />

            <label htmlFor="jn-pw" style={{ ...labelStyle, display: "block", marginBottom: 7 }}>
              Password
            </label>
            <input
              id="jn-pw"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="At least 8 characters"
              style={{ ...inputStyle, marginBottom: 8 }}
            />
            <span
              style={{
                fontFamily: "var(--font-interface)",
                fontSize: 12.5,
                color: "#9a9da6",
                display: "inline-block",
                marginBottom: 22,
              }}
            >
              You’ll use this with your email to sign back in.
            </span>

            <button
              type="submit"
              disabled={pending}
              style={{
                width: "100%",
                background: "var(--bow-orange)",
                color: "#fff",
                border: "none",
                padding: 15,
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 15,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                borderRadius: 4,
                cursor: pending ? "wait" : "pointer",
                opacity: pending ? 0.7 : 1,
              }}
            >
              {pending ? "Setting you up…" : "Start Track 101"}
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "22px 0" }}>
              <span style={{ flex: 1, height: 1, background: "var(--bow-dark-border)" }} />
              <span
                style={{
                  fontFamily: "var(--font-data)",
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "#6d7078",
                }}
              >
                Already have an account
              </span>
              <span style={{ flex: 1, height: 1, background: "var(--bow-dark-border)" }} />
            </div>
            <Link
              href="/sign-in"
              style={{
                display: "block",
                textAlign: "center",
                width: "100%",
                background: "transparent",
                color: "#fff",
                border: "1px solid var(--bow-dark-border)",
                padding: 13,
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 14,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                borderRadius: 4,
                textDecoration: "none",
              }}
            >
              Sign In Instead
            </Link>
          </form>
        </div>
      </div>
    </div>
  );
}
