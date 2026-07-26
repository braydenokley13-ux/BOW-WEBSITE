"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import type { CSSProperties } from "react";
import { signIn, type SignInState } from "@/app/actions/sign-in";

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
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "";
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, {});

  return (
    <div
      className="bow-front-office"
      /* Sized to the content rather than to 80vh. At 80vh the panel was ~720px
       * tall around ~330px of content, so both columns floated in a large
       * void — and the page still overflowed the viewport once the footer
       * was added. */
      style={{ background: "var(--bow-ink)", color: "#fff", minHeight: "clamp(440px, 60vh, 620px)", display: "flex", flexDirection: "column" }}
    >
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))",
          alignItems: "stretch",
          maxWidth: "var(--wide-max)",
          margin: "0 auto",
          width: "100%",
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
          <form action={action} style={{ maxWidth: 400, width: "100%", margin: "0 auto" }}>
            <input type="hidden" name="next" value={next} />
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
                  Couldn’t sign you in
                </span>
                <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 13.5, lineHeight: 1.55, color: "#b9bcc4" }}>
                  {state.error}
                </p>
              </div>
            )}

            <label htmlFor="si-email" style={{ ...labelStyle, display: "block", marginBottom: 7 }}>
              Email
            </label>
            <input
              id="si-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@school.edu"
              className="bow-field"
              style={{ ...inputStyle, marginBottom: 18 }}
            />

            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 7 }}>
              <label htmlFor="si-pw" style={labelStyle}>
                Password
              </label>
            </div>
            <input
              id="si-pw"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              className="bow-field"
              style={{ ...inputStyle, marginBottom: 8 }}
            />
            {/* Rendered as a link, not as grey body text. At #9a9da6 with no
              * underline it read as a static caption, so the one recovery
              * route out of a failed sign-in didn't look clickable. */}
            <Link
              href="/forgot-password"
              style={{
                fontFamily: "var(--font-interface)",
                fontSize: "var(--type-body-sm)",
                color: "var(--text-link)",
                textDecoration: "underline",
                textUnderlineOffset: 3,
                display: "inline-flex",
                alignItems: "center",
                minHeight: 40,
                marginBottom: 14,
              }}
            >
              Forgot your password?
            </Link>

            <button
              type="submit"
              disabled={pending}
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
                cursor: pending ? "wait" : "pointer",
                opacity: pending ? 0.7 : 1,
              }}
            >
              {pending ? "Signing in…" : "Sign In"}
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
              Join the Interest List
            </Link>
          </form>
        </div>
      </div>
    </div>
  );
}
