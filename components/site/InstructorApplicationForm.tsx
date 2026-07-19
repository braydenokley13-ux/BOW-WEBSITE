"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { Button } from "@/components/ds";
import { createInstructorApplication } from "@/app/actions/instructors";

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

interface FormState {
  name: string;
  email: string;
  phone: string;
  location: string;
  experience: string;
  whyBow: string;
  availability: string;
}

const EMPTY: FormState = { name: "", email: "", phone: "", location: "", experience: "", whyBow: "", availability: "" };

export default function InstructorApplicationForm() {
  const [data, setData] = useState<FormState>(EMPTY);
  const [status, setStatus] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setData((d) => ({ ...d, [k]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "busy") return;
    if (!data.name.trim() || !/.+@.+\..+/.test(data.email)) {
      setError("Add your name and a valid email.");
      setStatus("error");
      return;
    }
    setStatus("busy");
    setError(null);
    try {
      const res = await createInstructorApplication({
        name: data.name,
        email: data.email,
        phone: data.phone,
        answers: {
          location: data.location,
          experience: data.experience,
          whyBow: data.whyBow,
          availability: data.availability,
        },
      });
      if (res.ok) {
        setStatus("done");
      } else {
        setError(
          res.error === "exists"
            ? "We already have an application on file for this email. We'll be in touch."
            : res.error || "Something went wrong. Try again.",
        );
        setStatus("error");
      }
    } catch {
      setError("Something went wrong. Try again.");
      setStatus("error");
    }
  };

  if (status === "done") {
    return (
      <div
        style={{
          background: "var(--bow-dark-surface)",
          border: "1px solid var(--bow-positive)",
          borderRadius: 8,
          padding: "clamp(24px,4vw,40px)",
        }}
      >
        <h2
          style={{
            margin: "0 0 8px",
            fontFamily: "var(--font-display)",
            fontWeight: 900,
            fontSize: "clamp(22px,3vw,30px)",
            textTransform: "uppercase",
            color: "#fff",
          }}
        >
          Application received.
        </h2>
        <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.6, color: "#b9bcc4" }}>
          Thanks, {data.name.split(/\s+/)[0]} — BOW leadership reviews every application. We&apos;ll follow up at {data.email} to
          schedule a conversation.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 620 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))", gap: 16 }}>
        <div>
          <label style={labelStyle} htmlFor="ia-name">Your name</label>
          <input className="bow-field" id="ia-name" style={inputStyle} value={data.name} onChange={set("name")} placeholder="Jordan Avery" />
        </div>
        <div>
          <label style={labelStyle} htmlFor="ia-email">Email</label>
          <input className="bow-field" id="ia-email" type="email" style={inputStyle} value={data.email} onChange={set("email")} placeholder="you@email.com" />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))", gap: 16 }}>
        <div>
          <label style={labelStyle} htmlFor="ia-phone">Phone (optional)</label>
          <input className="bow-field" id="ia-phone" style={inputStyle} value={data.phone} onChange={set("phone")} placeholder="(555) 555-5555" />
        </div>
        <div>
          <label style={labelStyle} htmlFor="ia-location">City / location</label>
          <input className="bow-field" id="ia-location" style={inputStyle} value={data.location} onChange={set("location")} placeholder="Chicago, IL" />
        </div>
      </div>
      <div>
        <label style={labelStyle} htmlFor="ia-experience">Relevant experience</label>
        <textarea
          className="bow-field"
          id="ia-experience"
          rows={4}
          style={{ ...inputStyle, resize: "vertical" }}
          value={data.experience}
          onChange={set("experience")}
          placeholder="Coaching, teaching, sports business background — whatever's relevant."
        />
      </div>
      <div>
        <label style={labelStyle} htmlFor="ia-why">Why BOW?</label>
        <textarea
          className="bow-field"
          id="ia-why"
          rows={3}
          style={{ ...inputStyle, resize: "vertical" }}
          value={data.whyBow}
          onChange={set("whyBow")}
          placeholder="What draws you to teaching sports business to young people?"
        />
      </div>
      <div>
        <label style={labelStyle} htmlFor="ia-availability">Availability notes</label>
        <textarea
          className="bow-field"
          id="ia-availability"
          rows={3}
          style={{ ...inputStyle, resize: "vertical" }}
          value={data.availability}
          onChange={set("availability")}
          placeholder="Days/times you're generally free to teach."
        />
      </div>
      {status === "error" && error && (
        <p style={{ margin: 0, fontFamily: "var(--font-data)", fontSize: 12.5, color: "var(--bow-warning-text)" }}>{error}</p>
      )}
      <div>
        <Button type="submit" variant="primary" size="md" disabled={status === "busy"}>
          {status === "busy" ? "Submitting…" : "Submit Application"}
        </Button>
      </div>
    </form>
  );
}
