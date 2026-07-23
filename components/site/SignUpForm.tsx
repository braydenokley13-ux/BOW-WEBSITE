"use client";

import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Button } from "@/components/ds";
import { submitPublicInquiry } from "@/app/actions/public-forms";

const ROLE_OPTIONS = ["Student", "Parent", "Educator", "School / Camp", "Other"];
const INTEREST_OPTIONS = [
  "Track 101",
  "Track 201",
  "Track 301 (interest list)",
  "Highway World updates",
  "School / Camp partnership",
];

interface FormState {
  name: string;
  email: string;
  role: string;
  interest: string;
  org: string;
  message: string;
}

const INITIAL: FormState = {
  name: "",
  email: "",
  role: "Student",
  interest: "Track 101",
  org: "",
  message: "",
};

const labelStyle: CSSProperties = {
  fontFamily: "var(--font-data)",
  fontSize: 11,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "#9a9da6",
};

const fieldStyle: CSSProperties = {
  background: "var(--bow-ink)",
  border: "1px solid var(--bow-dark-border)",
  color: "#fff",
  padding: "12px 14px",
  borderRadius: "var(--radius-control)",
  fontSize: 15,
};

export default function SignUpForm() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const requestKeyRef = useRef<string | null>(null);
  const submissionPendingRef = useRef(false);

  const setField = (key: keyof FormState, value: string) => {
    if (submissionPendingRef.current) return;
    setForm((f) => ({ ...f, [key]: value }));
    setError("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submissionPendingRef.current) return;
    const name = form.name.trim();
    const email = form.email.trim();
    if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Add your name and a valid email so we can reach you.");
      return;
    }
    submissionPendingRef.current = true;
    setPending(true);
    const summary = [`Interested in ${form.interest}.`, form.message.trim()].filter(Boolean).join(" ");
    const requestKey = requestKeyRef.current
      ?? `signup-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
    requestKeyRef.current = requestKey;
    try {
      const res = await submitPublicInquiry({
        requestKey,
        source: "sign_up",
        name,
        email,
        type: form.role,
        orgName: form.org.trim(),
        summary,
      });
      if (!res.ok) {
        setError(res.error ?? "We could not confirm the submission. Review your details and try again safely.");
        return;
      }
      setSubmitted(true);
      setError("");
    } catch {
      setError("The submission was interrupted. Your information is still here, and it is safe to try again.");
    } finally {
      submissionPendingRef.current = false;
      setPending(false);
    }
  };

  const reset = () => {
    setSubmitted(false);
    setForm(INITIAL);
    setError("");
    setPending(false);
    requestKeyRef.current = null;
    submissionPendingRef.current = false;
  };

  return (
    <div className="bow-front-office" style={{ background: "var(--bow-ink)", color: "#fff", minHeight: "80vh" }}>
      <section style={{ padding: "clamp(40px,5vw,72px) clamp(18px,4vw,40px) clamp(48px,7vw,96px)" }}>
        <div
          style={{
            maxWidth: 920,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "clamp(28px,4vw,56px)",
            alignItems: "start",
          }}
        >
          {/* left: pitch */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--bow-orange)",
              }}
            >
              BOW Interest List
            </span>
            <h1
              style={{
                margin: 0,
                fontFamily: "var(--font-display)",
                fontWeight: 900,
                fontSize: "clamp(40px,6vw,80px)",
                lineHeight: 0.86,
                letterSpacing: "-0.02em",
                textTransform: "uppercase",
              }}
            >
              Find your next BOW program.
            </h1>
            <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 17, lineHeight: 1.6, color: "#b9bcc4" }}>
              This joins the interest list — it&apos;s not a confirmed registration. Already know which program you want?{" "}
              <a href="/programs" style={{ color: "#fff", textDecoration: "underline" }}>Register directly on /programs</a> instead.
            </p>
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  fontFamily: "var(--font-data)",
                  fontSize: 12,
                  letterSpacing: "0.04em",
                  color: "#9a9da6",
                }}
              >
                <span style={{ color: "var(--bow-positive)" }}>●</span>No account required to browse
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  fontFamily: "var(--font-data)",
                  fontSize: 12,
                  letterSpacing: "0.04em",
                  color: "#9a9da6",
                }}
              >
                <span style={{ color: "var(--bow-blue)" }}>●</span>We only use this to follow up
              </div>
            </div>
          </div>

          {/* right: form / success */}
          <div
            style={{
              background: "var(--bow-dark-surface)",
              border: "1px solid var(--bow-dark-border)",
              borderTop: "4px solid var(--bow-blue)",
              padding: "clamp(22px,3vw,32px)",
              borderRadius: "var(--radius-card)",
            }}
          >
            {submitted ? (
              <div role="status" aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: 16, textAlign: "left", padding: "12px 0" }}>
                <span
                  style={{
                    fontFamily: "var(--font-data)",
                    fontSize: 12,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--bow-positive)",
                  }}
                >
                  ✓ You’re on the list
                </span>
                <h2 style={{ margin: 0, fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: 28, lineHeight: 1.1 }}>
                  Thanks, {form.name}. The front office will be in touch.
                </h2>
                <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.6, color: "#b9bcc4" }}>
                  We’ll reach out at {form.email} with next steps for{" "}
                  <strong style={{ color: "#fff" }}>{form.interest}</strong>. In the meantime, the room is open.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 6 }}>
                  <Button href="/programs/track-101" variant="primary" size="md">
                    Explore Track 101
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={reset}
                    style={{ color: "#fff", borderColor: "var(--bow-dark-border)" }}
                  >
                    Submit Another
                  </Button>
                </div>
              </div>
            ) : (
              <form aria-busy={pending} onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label htmlFor="su-name" style={labelStyle}>
                    Name
                  </label>
                  <input
                    className="bow-field"
                    id="su-name"
                    value={form.name}
                    onChange={(e) => setField("name", e.target.value)}
                    placeholder="Your name"
                    required
                    maxLength={120}
                    autoComplete="name"
                    disabled={pending}
                    aria-describedby={error ? "su-error" : undefined}
                    style={fieldStyle}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label htmlFor="su-email" style={labelStyle}>
                    Email
                  </label>
                  <input
                    className="bow-field"
                    id="su-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setField("email", e.target.value)}
                    placeholder="you@email.com"
                    required
                    maxLength={200}
                    autoComplete="email"
                    disabled={pending}
                    aria-describedby={error ? "su-error" : undefined}
                    style={fieldStyle}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label htmlFor="su-role" style={labelStyle}>
                      I am a
                    </label>
                    <select
                      className="bow-field"
                      id="su-role"
                      value={form.role}
                      onChange={(e) => setField("role", e.target.value)}
                      disabled={pending}
                      style={fieldStyle}
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label htmlFor="su-interest" style={labelStyle}>
                      Interested in
                    </label>
                    <select
                      className="bow-field"
                      id="su-interest"
                      value={form.interest}
                      onChange={(e) => setField("interest", e.target.value)}
                      disabled={pending}
                      style={fieldStyle}
                    >
                      {INTEREST_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label htmlFor="su-org" style={labelStyle}>
                    School / Camp / Org{" "}
                    <span style={{ textTransform: "none", letterSpacing: 0 }}>(optional)</span>
                  </label>
                  <input
                    className="bow-field"
                    id="su-org"
                    value={form.org}
                    onChange={(e) => setField("org", e.target.value)}
                    placeholder="If you're inquiring for a group"
                    maxLength={200}
                    autoComplete="organization"
                    disabled={pending}
                    style={fieldStyle}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label htmlFor="su-message" style={labelStyle}>
                    Anything else <span style={{ textTransform: "none", letterSpacing: 0 }}>(optional)</span>
                  </label>
                  <textarea
                    className="bow-field"
                    id="su-message"
                    value={form.message}
                    onChange={(e) => setField("message", e.target.value)}
                    rows={3}
                    placeholder="Tell us what you're looking for"
                    maxLength={1500}
                    disabled={pending}
                    style={{ ...fieldStyle, resize: "vertical", fontFamily: "var(--font-interface)" }}
                  />
                </div>
                {error && (
                  <div
                    id="su-error"
                    role="alert"
                    aria-live="assertive"
                    style={{
                      fontFamily: "var(--font-data)",
                      fontSize: 12,
                      color: "var(--bow-negative)",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {error}
                  </div>
                )}
                <div style={{ marginTop: 4 }}>
                  <Button variant="primary" size="lg" type="submit" full disabled={pending}>
                    {pending ? "Sending…" : "Take My Seat"}
                  </Button>
                </div>
                <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 12, lineHeight: 1.5, color: "#6d7078" }}>
                  By signing up you agree to receive program updates from BOW Sports Capital. Your details are sent to the
                  BOW front office as an inquiry.
                </p>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
