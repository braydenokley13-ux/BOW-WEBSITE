"use client";

import Link from "next/link";
import { useState } from "react";
import type { CSSProperties } from "react";

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

export default function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [banner, setBanner] = useState<{ title: string; body: string } | null>(null);

  const doSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: wire to auth
    setBanner({
      title: "Authentication is coming soon",
      body: "Sign-in isn’t live yet. We’re building the front office now — check back soon, or sign up to get notified when accounts open.",
    });
  };

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
                color: "var(--bow-blue)",
              }}
            >
              The Front Office
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
              Sign in to your program.
            </h1>
            <div
              style={{
                height: 6,
                width: 130,
                background: "var(--bow-blue)",
                margin: "24px 0",
                clipPath: "polygon(0 0, 70% 0, 70% 50%, 100% 50%, 100% 100%, 0 100%)",
              }}
            />
            <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 16, lineHeight: 1.6, color: "#b9bcc4", maxWidth: 400 }}>
              Students, instructors, and BOW administrators run the program from one front office. Pick up exactly where
              your cohort left off.
            </p>
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
          <form onSubmit={doSignIn} style={{ maxWidth: 400, width: "100%", margin: "0 auto" }}>
            {banner && (
              <div
                role="alert"
                style={{
                  border: "1px solid var(--bow-dark-border)",
                  borderLeft: "4px solid var(--bow-blue)",
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
                  {banner.title}
                </span>
                <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 13.5, lineHeight: 1.55, color: "#b9bcc4" }}>
                  {banner.body}
                </p>
              </div>
            )}

            <label htmlFor="si-email" style={{ ...labelStyle, display: "block", marginBottom: 7 }}>
              Email
            </label>
            <input
              id="si-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@school.edu"
              style={{ ...inputStyle, marginBottom: 18 }}
            />

            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 7 }}>
              <label htmlFor="si-pw" style={labelStyle}>
                Password
              </label>
            </div>
            <input
              id="si-pw"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
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
              Forgot password? We’ll send a reset link.
            </span>

            <button
              type="submit"
              style={{
                width: "100%",
                background: "var(--bow-blue)",
                color: "#fff",
                border: "none",
                padding: 15,
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 15,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              Sign In
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
                New to BOW
              </span>
              <span style={{ flex: 1, height: 1, background: "var(--bow-dark-border)" }} />
            </div>
            <Link
              href="/sign-up"
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
              Sign Up Instead
            </Link>
          </form>
        </div>
      </div>
    </div>
  );
}
