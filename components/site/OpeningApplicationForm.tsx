"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ds";
import { createPublicApplication } from "@/app/actions/people-work";
import type { OpeningQuestion } from "@/lib/people-work";

export default function OpeningApplicationForm({
  openingSlug,
  questions,
}: {
  openingSlug: string;
  questions: OpeningQuestion[];
}) {
  const [identity, setIdentity] = useState({ name: "", email: "", phone: "" });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const field = { background: "#fff", border: "1px solid var(--border-rule)", color: "var(--bow-ink)", padding: "12px 14px", width: "100%", borderRadius: 4 } as const;
  const label = { display: "block", marginBottom: 6, fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--bow-slate)" };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setState("busy");
    setError(null);
    const result = await createPublicApplication({ openingSlug, ...identity, answers });
    if (!result.ok) {
      setState("idle");
      setError(result.error ?? "Your application could not be submitted.");
      return;
    }
    setState("done");
  };

  if (state === "done") {
    return (
      <div style={{ border: "1px solid var(--bow-positive)", background: "var(--bow-positive-tint)", padding: "clamp(24px,4vw,40px)" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 30, textTransform: "uppercase" }}>Application received.</h2>
        <p style={{ marginTop: 8, lineHeight: 1.6, color: "var(--bow-slate)" }}>BOW now has your application and a named next action. We will contact you at {identity.email}.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
        <div><label style={label} htmlFor="opening-name">Your name</label><input className="bow-field" id="opening-name" required maxLength={120} style={field} value={identity.name} onChange={(event) => setIdentity((value) => ({ ...value, name: event.target.value }))} /></div>
        <div><label style={label} htmlFor="opening-email">Email</label><input className="bow-field" id="opening-email" required type="email" maxLength={200} style={field} value={identity.email} onChange={(event) => setIdentity((value) => ({ ...value, email: event.target.value }))} /></div>
        <div><label style={label} htmlFor="opening-phone">Phone (optional)</label><input className="bow-field" id="opening-phone" maxLength={40} style={field} value={identity.phone} onChange={(event) => setIdentity((value) => ({ ...value, phone: event.target.value }))} /></div>
      </div>
      {questions.map((question) => (
        <div key={question.key}>
          <label style={label} htmlFor={`opening-${question.key}`}>{question.label}</label>
          {question.type === "textarea" ? (
            <textarea className="bow-field" id={`opening-${question.key}`} required={question.required} rows={4} maxLength={2000} style={{ ...field, resize: "vertical" }} value={answers[question.key] ?? ""} onChange={(event) => setAnswers((value) => ({ ...value, [question.key]: event.target.value }))} />
          ) : question.type === "select" ? (
            <select className="bow-field" id={`opening-${question.key}`} required={question.required} style={field} value={answers[question.key] ?? ""} onChange={(event) => setAnswers((value) => ({ ...value, [question.key]: event.target.value }))}>
              <option value="">Choose one</option>
              {(question.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          ) : (
            <input className="bow-field" id={`opening-${question.key}`} required={question.required} maxLength={2000} style={field} value={answers[question.key] ?? ""} onChange={(event) => setAnswers((value) => ({ ...value, [question.key]: event.target.value }))} />
          )}
        </div>
      ))}
      {error && <p role="alert" style={{ color: "var(--bow-negative)", fontFamily: "var(--font-interface)" }}>{error}</p>}
      <div><Button type="submit" variant="primary" size="lg" disabled={state === "busy"}>{state === "busy" ? "Submitting…" : "Submit Application"}</Button></div>
      <p style={{ fontSize: 12, lineHeight: 1.5, color: "var(--bow-slate)" }}>Submitting creates an application for this opening only. You may apply for a different BOW role separately.</p>
    </form>
  );
}
