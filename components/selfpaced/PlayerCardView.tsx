"use client";

import { useState } from "react";
import Link from "next/link";
import type { PlayerCardData } from "@/lib/player-card";
import { generatePlayerCard } from "@/app/actions/lms";

const GOLD = "#C9A84C";

// Inlined (not imported from the server-only lib/player-card) so this client
// component doesn't pull the DB module into the browser bundle.
function positionTagline(label: string): string {
  switch (label) {
    case "Analyst": return "Reads the numbers behind every call.";
    case "GM": return "Runs the room. Makes the decision.";
    case "Scout": return "Spots the value everyone else misses.";
    case "Executive": return "Sets the strategy, week after week.";
    default: return "Every front office starts here.";
  }
}

function Stat({ value, label, gold }: { value: string; label: string; gold?: boolean }) {
  return (
    <div style={{ background: "#0A1628", padding: "14px 16px" }}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 24, lineHeight: 1, color: gold ? GOLD : "#fff" }}>{value}</div>
      <div style={{ marginTop: 6, fontFamily: "var(--font-data)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "#9aa3b2" }}>{label}</div>
    </div>
  );
}

export default function PlayerCardView({ data }: { data: PlayerCardData }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const quiz = data.quizScorePct === null ? "—" : `${data.quizScorePct}%`;

  const onDownload = async () => {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      const res = await generatePlayerCard();
      if (res.ok && res.html && res.filename) {
        const blob = new Blob([res.html], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = res.filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ background: "#070f1c", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: "clamp(24px,5vw,56px) 16px 80px" }}>
      <div style={{ width: "100%", maxWidth: 420, display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
        <Link href="/dashboard" style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: GOLD, textDecoration: "none" }}>
          ← Dashboard
        </Link>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9aa3b2" }}>
          Player Card
        </span>
      </div>

      {/* CARD */}
      <div style={{ width: 380, maxWidth: "100%", background: "linear-gradient(160deg,#13243d,#0A1628)", border: `2px solid ${GOLD}`, borderRadius: 18, overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.6)", position: "relative" }}>
        <div style={{ position: "absolute", inset: 8, border: "1px solid rgba(201,168,76,0.4)", borderRadius: 12, pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px 0" }}>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "#0A1628", background: GOLD, padding: "4px 10px", borderRadius: 100 }}>
            BOW Sports Capital
          </span>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "#C8FF3D" }}>{data.rankName}</span>
        </div>
        <div style={{ padding: "30px 22px 6px", textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 60, lineHeight: 0.9, letterSpacing: "0.01em", color: GOLD, textTransform: "uppercase" }}>{data.positionLabel}</div>
          <div style={{ fontFamily: "var(--font-interface)", fontSize: 12.5, color: "rgba(255,255,255,0.66)", marginTop: 8 }}>{positionTagline(data.positionLabel)}</div>
        </div>
        <div style={{ textAlign: "center", padding: "14px 22px 18px" }}>
          <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 26, letterSpacing: "-0.01em", color: "#fff", textTransform: "uppercase", lineHeight: 1.05 }}>{data.name}</h1>
          <div style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "#9aa3b2", marginTop: 6 }}>Official Player Card</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "rgba(201,168,76,0.25)", margin: "0 18px 18px", border: "1px solid rgba(201,168,76,0.25)", borderRadius: 10, overflow: "hidden" }}>
          <Stat value={String(data.bowScore)} label="BOW Score" gold />
          <Stat value={`${data.modulesCompleted}/${data.totalModules}`} label="Modules" />
          <Stat value={quiz} label="Quiz Score" />
          <Stat value={`🔥 ${data.currentStreak}`} label="Day Streak" />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 22px 18px" }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 18, letterSpacing: "0.02em", color: GOLD, textTransform: "uppercase" }}>BOW</span>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 9.5, letterSpacing: "0.12em", color: "#9aa3b2", textTransform: "uppercase" }}>bowsportscapital.com</span>
        </div>
      </div>

      {/* DOWNLOAD */}
      <div style={{ marginTop: 28, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <button
          onClick={onDownload}
          disabled={busy}
          style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14.5, letterSpacing: "0.05em", textTransform: "uppercase", padding: "13px 28px", border: "none", background: busy ? "#6d7078" : GOLD, color: "#0A1628", borderRadius: 6, cursor: busy ? "wait" : "pointer" }}
        >
          {busy ? "Generating…" : "Download Card"}
        </button>
        <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 13, color: "#9aa3b2", maxWidth: 320, textAlign: "center" }}>
          Screenshot it or download a shareable copy. Finish more modules, the sim, and the daily question to level up your position.
        </p>
        {error && <p style={{ margin: 0, fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-warning)" }}>Something went wrong. Please try again.</p>}
      </div>
    </div>
  );
}
