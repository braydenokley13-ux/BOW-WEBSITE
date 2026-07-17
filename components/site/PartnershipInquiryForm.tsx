"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { Button } from "@/components/ds";
import { submitPartnershipInquiry } from "@/app/actions/public-forms";

const inputStyle: CSSProperties = {
  background: "var(--bow-white)",
  border: "1px solid var(--border-rule)",
  color: "var(--bow-ink)",
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
  color: "var(--bow-slate)",
  display: "block",
  marginBottom: 6,
};

export default function PartnershipInquiryForm() {
  const [data, setData] = useState({ organizationName: "", contactName: "", contactEmail: "", message: "" });
  const [status, setStatus] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof data) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setData((d) => ({ ...d, [k]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "busy") return;
    setStatus("busy");
    setError(null);
    const res = await submitPartnershipInquiry(data);
    if (res.ok) setStatus("done");
    else {
      setError(res.error ?? "Something went wrong.");
      setStatus("error");
    }
  };

  if (status === "done") {
    return (
      <div style={{ background: "var(--bow-white)", border: "1px solid var(--bow-positive)", borderRadius: 8, padding: "clamp(24px,4vw,40px)" }}>
        <h2 style={{ margin: "0 0 8px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(20px,3vw,26px)", textTransform: "uppercase" }}>
          Thanks — we&rsquo;ve got it.
        </h2>
        <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.6, color: "var(--bow-slate)" }}>
          Your partnership inquiry is in front of the BOW team.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 620 }}>
      <div>
        <label style={labelStyle} htmlFor="pi-org">Organization name</label>
        <input id="pi-org" style={inputStyle} value={data.organizationName} onChange={set("organizationName")} placeholder="League, school, or organization" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))", gap: 16 }}>
        <div>
          <label style={labelStyle} htmlFor="pi-name">Your name</label>
          <input id="pi-name" style={inputStyle} value={data.contactName} onChange={set("contactName")} placeholder="Jordan Avery" />
        </div>
        <div>
          <label style={labelStyle} htmlFor="pi-email">Email</label>
          <input id="pi-email" type="email" style={inputStyle} value={data.contactEmail} onChange={set("contactEmail")} placeholder="you@organization.com" />
        </div>
      </div>
      <div>
        <label style={labelStyle} htmlFor="pi-msg">Tell us about the partnership</label>
        <textarea id="pi-msg" rows={5} style={{ ...inputStyle, resize: "vertical" }} value={data.message} onChange={set("message")} />
      </div>
      {status === "error" && (
        <p style={{ margin: 0, fontFamily: "var(--font-data)", fontSize: 12.5, color: "var(--bow-warning-text)" }}>{error}</p>
      )}
      <div>
        <Button type="submit" variant="primary" size="md" disabled={status === "busy"}>
          {status === "busy" ? "Sending…" : "Request a Partnership"}
        </Button>
      </div>
    </form>
  );
}
