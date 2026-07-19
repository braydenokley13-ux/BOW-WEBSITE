"use client";

import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Button } from "@/components/ds";
import { submitPublicInquiry } from "@/app/actions/public-forms";

const inputStyle: CSSProperties = {
  background: "var(--bow-ink)",
  border: "1px solid var(--bow-dark-border)",
  color: "#fff",
  padding: "12px 14px",
  fontFamily: "var(--font-interface)",
  fontSize: 15,
  width: "100%",
  borderRadius: 4,
};

const labelStyle: CSSProperties = {
  fontFamily: "var(--font-data)",
  fontSize: 11,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "#9a9da6",
  display: "block",
  marginBottom: 6,
};

const TYPES = ["League / Pro Team", "School", "Camp", "Youth Organization", "Family", "Other"];

export default function ContactForm() {
  const [data, setData] = useState({ name: "", email: "", type: TYPES[0], orgName: "", summary: "" });
  const [status, setStatus] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const requestKeyRef = useRef<string | null>(null);
  const submissionPendingRef = useRef(false);
  const set = (k: keyof typeof data) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (submissionPendingRef.current) return;
    setData((d) => ({ ...d, [k]: e.target.value }));
    setError(null);
    setStatus((current) => current === "error" ? "idle" : current);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submissionPendingRef.current) return;
    const name = data.name.trim();
    const email = data.email.trim();
    const summary = data.summary.trim();
    if (!name) {
      setError("Enter your name so the BOW team knows who to contact.");
      setStatus("error");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address so we can reply.");
      setStatus("error");
      return;
    }
    if (!summary) {
      setError("Add a short message about how BOW can help.");
      setStatus("error");
      return;
    }
    submissionPendingRef.current = true;
    setStatus("busy");
    setError(null);
    const requestKey = requestKeyRef.current
      ?? `contact-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
    requestKeyRef.current = requestKey;
    try {
      const res = await submitPublicInquiry({
        requestKey,
        source: "contact",
        name,
        email,
        type: data.type,
        orgName: data.orgName.trim(),
        summary,
      });
      if (res.ok) {
        setStatus("done");
        return;
      }
      setError(res.error ?? "We could not confirm the message. Review the details and try again safely.");
      setStatus("error");
    } catch {
      setError("The connection was interrupted. Your message is still here, and it is safe to try again.");
      setStatus("error");
    } finally {
      submissionPendingRef.current = false;
    }
  };

  if (status === "done") {
    return (
      <div role="status" aria-live="polite" style={{ background: "var(--bow-dark-surface)", border: "1px solid var(--bow-positive)", borderRadius: 8, padding: "clamp(24px,4vw,40px)" }}>
        <h2 style={{ margin: "0 0 8px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(22px,3vw,30px)", textTransform: "uppercase", color: "#fff" }}>
          Thanks — we’ve got it.
        </h2>
        <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.6, color: "#b9bcc4" }}>
          Your message is in front of the BOW team. We’ll reach out at {data.email} shortly.
        </p>
      </div>
    );
  }

  return (
    <form aria-busy={status === "busy"} onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 620 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))", gap: 16 }}>
        <div>
          <label style={labelStyle} htmlFor="cf-name">Your name</label>
          <input className="bow-field" id="cf-name" style={inputStyle} value={data.name} onChange={set("name")} placeholder="Jordan Avery" required maxLength={120} autoComplete="name" disabled={status === "busy"} aria-describedby={status === "error" ? "cf-error" : undefined} />
        </div>
        <div>
          <label style={labelStyle} htmlFor="cf-email">Email</label>
          <input className="bow-field" id="cf-email" type="email" style={inputStyle} value={data.email} onChange={set("email")} placeholder="you@organization.com" required maxLength={200} autoComplete="email" disabled={status === "busy"} aria-describedby={status === "error" ? "cf-error" : undefined} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))", gap: 16 }}>
        <div>
          <label style={labelStyle} htmlFor="cf-type">I’m reaching out as</label>
          <select className="bow-field" id="cf-type" style={inputStyle} value={data.type} onChange={set("type")} disabled={status === "busy"}>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle} htmlFor="cf-org">Organization (optional)</label>
          <input className="bow-field" id="cf-org" style={inputStyle} value={data.orgName} onChange={set("orgName")} placeholder="Team, league, or school" maxLength={200} autoComplete="organization" disabled={status === "busy"} />
        </div>
      </div>
      <div>
        <label style={labelStyle} htmlFor="cf-msg">How can we help?</label>
        <textarea className="bow-field" id="cf-msg" rows={5} style={{ ...inputStyle, resize: "vertical" }} value={data.summary} onChange={set("summary")} placeholder="Tell us about your students, your program, or the partnership you have in mind." required maxLength={2000} disabled={status === "busy"} aria-describedby={status === "error" ? "cf-error" : undefined} />
      </div>
      {status === "error" && (
        <p id="cf-error" role="alert" aria-live="assertive" style={{ margin: 0, fontFamily: "var(--font-data)", fontSize: 12.5, color: "var(--bow-warning-text)" }}>
          {error}
        </p>
      )}
      <div>
        <Button type="submit" variant="primary" size="md" disabled={status === "busy"}>
          {status === "busy" ? "Sending…" : "Request a Partnership"}
        </Button>
      </div>
    </form>
  );
}
