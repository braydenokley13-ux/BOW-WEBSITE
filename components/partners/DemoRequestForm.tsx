"use client";

import { useState, useTransition } from "react";
import type { CSSProperties } from "react";
import { submitDemoRequest } from "@/app/actions/partners";

/* ============================================================
 * Request a Demo — the public form on every partner landing page.
 *
 * Calls the public `submitDemoRequest` server action directly and
 * shows submitting / thank-you / error states, mirroring the pattern
 * in components/site/InquiryForm.tsx. No email is sent — the request
 * lands in the admin "Partners" inbox.
 *
 * Rendered on a dark (var(--bow-ink)) panel, so inputs use white text
 * on the ink surface like InquiryForm's dark inputs.
 * ============================================================ */

const labelStyle: CSSProperties = {
  fontFamily: "var(--font-data)",
  fontSize: 11,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "#9fb0c8",
};

const inputStyle: CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.18)",
  color: "#fff",
  padding: "12px 14px",
  fontFamily: "var(--font-interface)",
  fontSize: 15,
  outline: "none",
  width: "100%",
  borderRadius: 4,
};

export default function DemoRequestForm({ orgSlug }: { orgSlug: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isPending) return;
    setError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) {
      setError("Please enter your name.");
      return;
    }
    if (!/.+@.+\..+/.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await submitDemoRequest(orgSlug, trimmedName, trimmedEmail, message.trim());
        if (res.ok) {
          setDone(true);
        } else {
          setError("We couldn't send your request. Please check your details and try again.");
        }
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  };

  if (done) {
    return (
      <div
        role="status"
        style={{
          border: "1px solid rgba(255,255,255,0.18)",
          borderLeft: "4px solid var(--bow-positive)",
          padding: "24px 26px",
          background: "rgba(255,255,255,0.03)",
          borderRadius: 4,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#5fcf99",
            display: "block",
            marginBottom: 10,
          }}
        >
          Request received
        </span>
        <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 15.5, lineHeight: 1.6, color: "#cdd6e3" }}>
          Thanks, {name.trim().split(" ")[0] || "there"} — your demo request is in. The BOW front office will be in
          touch at {email.trim()} shortly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }} noValidate>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label htmlFor="dr-name" style={labelStyle}>
          Your name <span style={{ color: "var(--bow-orange)" }} aria-label="required">*</span>
        </label>
        <input
          id="dr-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Cooper"
          autoComplete="name"
          aria-required="true"
          style={inputStyle}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label htmlFor="dr-email" style={labelStyle}>
          Work email <span style={{ color: "var(--bow-orange)" }} aria-label="required">*</span>
        </label>
        <input
          id="dr-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="jane@yourschool.org"
          autoComplete="email"
          aria-required="true"
          style={inputStyle}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label htmlFor="dr-message" style={labelStyle}>
          What are you hoping to set up?
        </label>
        <textarea
          id="dr-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          placeholder="Tell us about your program, grade levels, or timeline…"
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </div>

      {error && (
        <span
          role="alert"
          style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.02em", color: "#ff8a7a" }}
        >
          {error}
        </span>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <button
          type="submit"
          disabled={isPending}
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 15,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            padding: "14px 30px",
            border: "none",
            background: isPending ? "rgba(255,255,255,0.25)" : "var(--bow-orange)",
            color: isPending ? "#cdd6e3" : "var(--bow-ink)",
            borderRadius: 4,
            cursor: isPending ? "wait" : "pointer",
          }}
        >
          {isPending ? "Sending…" : "Request a Demo"}
        </button>
        <span style={{ fontFamily: "var(--font-interface)", fontSize: 12.5, color: "#7e90a8" }}>
          No spam. We&apos;ll only use this to reach out about BOW.
        </span>
      </div>
    </form>
  );
}
