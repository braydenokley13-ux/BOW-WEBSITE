"use client";

import { useState } from "react";
import { submitNewsStory } from "@/app/actions/content";

const input: React.CSSProperties = { width: "100%", background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 5, padding: "11px 13px", fontFamily: "var(--font-interface)", fontSize: 14.5, color: "var(--bow-ink)", outline: "none" };
const label: React.CSSProperties = { fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 6 };

export default function NewsSubmitForm() {
  const [data, setData] = useState({ headline: "", summary: "", sourceUrl: "" });
  const [status, setStatus] = useState<"idle" | "busy" | "done" | "error">("idle");
  const set = (k: keyof typeof data) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setData((d) => ({ ...d, [k]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "busy") return;
    if (!data.headline.trim()) { setStatus("error"); return; }
    setStatus("busy");
    try {
      const res = await submitNewsStory(data);
      if (res.ok) { setStatus("done"); setData({ headline: "", summary: "", sourceUrl: "" }); }
      else setStatus("error");
    } catch { setStatus("error"); }
  };

  if (status === "done") {
    return (
      <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14.5, color: "var(--bow-positive)" }}>
        ✓ Thanks! Your story was submitted for review. An admin will approve it before it appears here.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label style={label} htmlFor="ns-h">Headline</label>
        <input id="ns-h" style={input} value={data.headline} onChange={set("headline")} placeholder="A sports-business story you spotted" />
      </div>
      <div>
        <label style={label} htmlFor="ns-s">Why it matters (which concept?)</label>
        <textarea id="ns-s" rows={3} style={{ ...input, resize: "vertical" }} value={data.summary} onChange={set("summary")} placeholder="One or two sentences tying it to a BOW concept." />
      </div>
      <div>
        <label style={label} htmlFor="ns-u">Source link (optional)</label>
        <input id="ns-u" style={input} value={data.sourceUrl} onChange={set("sourceUrl")} placeholder="https://…" />
      </div>
      {status === "error" && <p style={{ margin: 0, fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-warning-text)" }}>Add a headline to submit.</p>}
      <div>
        <button type="submit" disabled={status === "busy"} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13.5, letterSpacing: "0.05em", textTransform: "uppercase", padding: "11px 22px", border: "none", background: status === "busy" ? "var(--bow-inactive)" : "var(--bow-blue)", color: "#fff", borderRadius: 4, cursor: status === "busy" ? "wait" : "pointer" }}>
          {status === "busy" ? "Submitting…" : "Submit a Story"}
        </button>
      </div>
    </form>
  );
}
