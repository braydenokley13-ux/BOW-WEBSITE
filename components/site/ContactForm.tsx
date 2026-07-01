"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { Button } from "@/components/ds";
import { createInquiry } from "@/app/actions/lms";

const inputStyle: CSSProperties = {
  background: "var(--bow-ink)",
  border: "1px solid var(--bow-dark-border)",
  color: "#fff",
  padding: "12px 14px",
  fontFamily: "var(--font-interface)",
  fontSize: 15,
  outline: "none",
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
  const set = (k: keyof typeof data) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setData((d) => ({ ...d, [k]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "busy") return;
    if (!data.name.trim() || !/.+@.+\..+/.test(data.email) || !data.summary.trim()) {
      setStatus("error");
      return;
    }
    setStatus("busy");
    try {
      const res = await createInquiry({
        name: data.name,
        email: data.email,
        type: data.type,
        orgName: data.orgName,
        summary: data.summary,
      });
      setStatus(res.ok ? "done" : "error");
    } catch {
      setStatus("error");
    }
  };

  if (status === "done") {
    return (
      <div style={{ background: "var(--bow-dark-surface)", border: "1px solid var(--bow-positive)", borderRadius: 8, padding: "clamp(24px,4vw,40px)" }}>
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
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 620 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))", gap: 16 }}>
        <div>
          <label style={labelStyle} htmlFor="cf-name">Your name</label>
          <input id="cf-name" style={inputStyle} value={data.name} onChange={set("name")} placeholder="Jordan Avery" />
        </div>
        <div>
          <label style={labelStyle} htmlFor="cf-email">Email</label>
          <input id="cf-email" type="email" style={inputStyle} value={data.email} onChange={set("email")} placeholder="you@organization.com" />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))", gap: 16 }}>
        <div>
          <label style={labelStyle} htmlFor="cf-type">I’m reaching out as</label>
          <select id="cf-type" style={inputStyle} value={data.type} onChange={set("type")}>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle} htmlFor="cf-org">Organization (optional)</label>
          <input id="cf-org" style={inputStyle} value={data.orgName} onChange={set("orgName")} placeholder="Team, league, or school" />
        </div>
      </div>
      <div>
        <label style={labelStyle} htmlFor="cf-msg">How can we help?</label>
        <textarea id="cf-msg" rows={5} style={{ ...inputStyle, resize: "vertical" }} value={data.summary} onChange={set("summary")} placeholder="Tell us about your students, your program, or the partnership you have in mind." />
      </div>
      {status === "error" && (
        <p style={{ margin: 0, fontFamily: "var(--font-data)", fontSize: 12.5, color: "var(--bow-warning-text)" }}>
          Please add your name, a valid email, and a short message.
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
