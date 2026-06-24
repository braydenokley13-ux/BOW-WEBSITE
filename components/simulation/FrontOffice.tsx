"use client";

import { useState } from "react";
import Link from "next/link";
import { fmtCap, type SimState, type SimDecision } from "@/lib/sim-game";
import {
  gradeEastfield,
  EASTFIELD_TEAM,
  START_CAP_EASTFIELD,
  TOTAL_TURNS_EASTFIELD,
  type EastfieldReport,
} from "@/lib/sim-eastfield";
import { startEastfield, makeEastfieldDecision } from "@/app/actions/eastfield";

interface PublicChoice {
  id: string;
  label: string;
  description: string;
}
interface PublicTurn {
  turn: number;
  concept: string;
  title: string;
  situation: string;
  choices: PublicChoice[];
}

interface Props {
  firstName: string;
  turns: PublicTurn[];
  initialState: SimState | null;
}

const card: React.CSSProperties = { border: "1px solid var(--bow-dark-border)", background: "var(--bow-dark-surface)", borderRadius: 6 };

export default function FrontOffice({ firstName, turns, initialState }: Props) {
  const [state, setState] = useState<SimState | null>(initialState);
  const [resolved, setResolved] = useState<SimDecision | null>(null);
  const [report, setReport] = useState<EastfieldReport | null>(null);
  const [busy, setBusy] = useState(false);

  const finalReport: EastfieldReport | null = report ?? (state?.completed ? gradeEastfield(state.decisions) : null);

  const onStart = async () => {
    if (busy) return;
    setBusy(true);
    const res = await startEastfield();
    setBusy(false);
    if (res.ok && res.state) {
      setState(res.state);
      setResolved(null);
      setReport(null);
    }
  };

  const onChoose = async (choiceId: string) => {
    if (busy) return;
    setBusy(true);
    const res = await makeEastfieldDecision(choiceId);
    setBusy(false);
    if (res.ok && res.state) {
      setState(res.state);
      if (res.justResolved) setResolved(res.justResolved);
      if (res.report) setReport(res.report);
    }
  };

  return (
    <div className="bow-front-office" style={{ background: "var(--bow-ink)", color: "#fff", minHeight: "100vh", padding: "clamp(24px,4vw,44px) clamp(16px,4vw,32px) 96px" }}>
      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-blue)" }}>
            The Front Office · Track 201
          </span>
          <Link href="/dashboard" style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6f8bff", textDecoration: "none" }}>
            ← Dashboard
          </Link>
        </div>

        {!state ? (
          <Entry firstName={firstName} busy={busy} onStart={onStart} />
        ) : resolved ? (
          <Outcome resolved={resolved} isFinal={!!finalReport} onContinue={() => setResolved(null)} />
        ) : finalReport ? (
          <ReportCard report={finalReport} onPlayAgain={onStart} busy={busy} />
        ) : (
          <Playing state={state} turns={turns} busy={busy} onChoose={onChoose} />
        )}
      </div>
    </div>
  );
}

/* ---------------- entry ---------------- */

function Entry({ firstName, busy, onStart }: { firstName: string; busy: boolean; onStart: () => void }) {
  const facts = [
    { label: "Your team", value: EASTFIELD_TEAM },
    { label: "Inherited cap", value: fmtCap(START_CAP_EASTFIELD) },
    { label: "Starting record", value: "0–0" },
    { label: "Turns", value: `${TOTAL_TURNS_EASTFIELD} decisions` },
  ];
  return (
    <>
      <h1 style={{ margin: "10px 0 8px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(32px,5vw,56px)", lineHeight: 0.92, letterSpacing: "-0.02em", textTransform: "uppercase" }}>
        You’re the new GM.
      </h1>
      <p style={{ margin: "0 0 22px", fontFamily: "var(--font-interface)", fontSize: 16, lineHeight: 1.6, color: "#b9bcc4", maxWidth: 560 }}>
        Welcome to the Eastfield Eagles, {firstName}. You inherit a messy cap sheet and eight decisions to fix it — Bird Rights, the Mid-Level Exception, the luxury tax, market size, analytics, roster windows, pick value, and surplus value. Every call teaches one front-office concept, and at the end you get a cap-efficiency report card.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: 12, marginBottom: 24 }}>
        {facts.map((f) => (
          <div key={f.label} style={{ ...card, padding: "16px 18px" }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 22, color: "#fff" }}>{f.value}</div>
            <div style={{ marginTop: 6, fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9a9da6" }}>{f.label}</div>
          </div>
        ))}
      </div>
      <button
        onClick={onStart}
        disabled={busy}
        style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, letterSpacing: "0.05em", textTransform: "uppercase", padding: "15px 30px", border: "none", background: busy ? "var(--bow-inactive)" : "var(--bow-blue)", color: "#fff", borderRadius: 4, cursor: busy ? "wait" : "pointer" }}
      >
        {busy ? "Loading…" : "Take the Job →"}
      </button>
    </>
  );
}

/* ---------------- HUD ---------------- */

function Hud({ state }: { state: SimState }) {
  const items = [
    { label: "Cap space", value: fmtCap(state.capSpace), accent: state.capSpace < 0 ? "var(--bow-negative)" : "#5fcf99" },
    { label: "Record", value: state.record, accent: "#fff" },
    { label: "Turn", value: `${Math.min(state.turn, TOTAL_TURNS_EASTFIELD)} / ${TOTAL_TURNS_EASTFIELD}`, accent: "#6f8bff" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, margin: "18px 0 22px" }}>
      {items.map((i) => (
        <div key={i.label} style={{ ...card, padding: "12px 14px" }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 20, color: i.accent }}>{i.value}</div>
          <div style={{ marginTop: 4, fontFamily: "var(--font-data)", fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9a9da6" }}>{i.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- playing ---------------- */

function Playing({ state, turns, busy, onChoose }: { state: SimState; turns: PublicTurn[]; busy: boolean; onChoose: (id: string) => void }) {
  const turn = turns.find((t) => t.turn === state.turn);
  if (!turn) return null;
  return (
    <>
      <h1 style={{ margin: "10px 0 0", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(26px,4vw,40px)", lineHeight: 0.96, textTransform: "uppercase" }}>
        {turn.title}
      </h1>
      <Hud state={state} />
      <div style={{ ...card, borderTop: "4px solid var(--bow-blue)", padding: "clamp(18px,2.6vw,26px)" }}>
        <span style={{ display: "inline-block", fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.04em", textTransform: "uppercase", color: "#fff", background: "var(--bow-blue)", padding: "3px 9px", borderRadius: 3 }}>
          {turn.concept}
        </span>
        <p style={{ margin: "14px 0 0", fontFamily: "var(--font-editorial)", fontSize: "clamp(16px,2vw,19px)", lineHeight: 1.5, color: "#e3e5ea" }}>
          {turn.situation}
        </p>
        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
          {turn.choices.map((c) => (
            <button
              key={c.id}
              onClick={() => onChoose(c.id)}
              disabled={busy}
              style={{ textAlign: "left", border: "1px solid var(--bow-dark-border)", background: "var(--bow-ink)", color: "#fff", borderRadius: 5, padding: "14px 16px", cursor: busy ? "wait" : "pointer" }}
            >
              <span style={{ display: "block", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, textTransform: "uppercase", letterSpacing: "0.01em" }}>{c.label}</span>
              <span style={{ display: "block", marginTop: 4, fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.03em", color: "#9a9da6" }}>{c.description}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

/* ---------------- outcome ---------------- */

function Outcome({ resolved, isFinal, onContinue }: { resolved: SimDecision; isFinal: boolean; onContinue: () => void }) {
  return (
    <>
      <h1 style={{ margin: "10px 0 18px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(24px,4vw,38px)", lineHeight: 0.96, textTransform: "uppercase" }}>
        Your call: {resolved.label}
      </h1>
      <div style={{ ...card, borderTop: "4px solid var(--bow-positive)", padding: "clamp(18px,2.6vw,26px)" }}>
        <p style={{ margin: 0, fontFamily: "var(--font-editorial)", fontSize: "clamp(15.5px,1.9vw,18px)", lineHeight: 1.55, color: "#e3e5ea" }}>
          {resolved.outcome}
        </p>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 18 }}>
          <Pill label="Cap change" value={fmtCap(resolved.capImpact)} accent={resolved.capImpact < 0 ? "var(--bow-negative)" : "#5fcf99"} />
          <Pill label="Cap space now" value={fmtCap(resolved.capAfter)} accent={resolved.capAfter < 0 ? "var(--bow-negative)" : "#fff"} />
          <Pill label="Record" value={`${resolved.winsAfter}-${resolved.lossesAfter}`} accent="#fff" />
        </div>
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--bow-dark-border)" }}>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-blue)" }}>
            You just applied: {resolved.conceptLabel}
          </span>
        </div>
      </div>
      <button
        onClick={onContinue}
        style={{ marginTop: 20, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, letterSpacing: "0.05em", textTransform: "uppercase", padding: "14px 28px", border: "none", background: "var(--bow-blue)", color: "#fff", borderRadius: 4, cursor: "pointer" }}
      >
        {isFinal ? "See Final Report →" : "Next Decision →"}
      </button>
    </>
  );
}

function Pill({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 20, color: accent }}>{value}</div>
      <div style={{ marginTop: 3, fontFamily: "var(--font-data)", fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9a9da6" }}>{label}</div>
    </div>
  );
}

/* ---------------- report card ---------------- */

function ReportCard({ report, onPlayAgain, busy }: { report: EastfieldReport; onPlayAgain: () => void; busy: boolean }) {
  const gradeColor = report.grade === "A" ? "#5fcf99" : report.grade === "B" ? "#6f8bff" : report.grade === "C" ? "var(--bow-warning)" : "var(--bow-orange)";
  return (
    <>
      <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-blue)" }}>
        Final Report · {EASTFIELD_TEAM}
      </span>
      <h1 style={{ margin: "8px 0 18px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(30px,5vw,52px)", lineHeight: 0.92, textTransform: "uppercase" }}>
        You fixed the books.
      </h1>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "stretch", marginBottom: 22 }}>
        <div style={{ ...card, borderTop: `4px solid ${gradeColor}`, padding: "20px 26px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minWidth: 140 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 72, lineHeight: 1, color: gradeColor }}>{report.grade}</div>
          <div style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9a9da6" }}>Cap Efficiency · {report.capEfficiency}/100</div>
        </div>
        <div style={{ flex: 1, minWidth: 200, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10 }}>
          <Stat label="Final record" value={report.record} />
          <Stat label="Final cap space" value={fmtCap(report.finalCap)} accent={report.finalCap < 0 ? "var(--bow-negative)" : "#5fcf99"} />
          <Stat label="Wins per $10M" value={report.winsPerSpend} />
          <Stat label="Sound calls" value={`${report.soundCount} / ${report.totalDecisions}`} />
        </div>
      </div>

      <div style={{ ...card, padding: "clamp(18px,2.4vw,24px)", marginBottom: 18 }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-blue)" }}>
          Your front office, reviewed
        </span>
        <p style={{ margin: "10px 0 0", fontFamily: "var(--font-editorial)", fontSize: 16, lineHeight: 1.6, color: "#e3e5ea" }}>
          {report.feedback}
        </p>
      </div>

      <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9a9da6", display: "block", marginBottom: 10 }}>
        Decisions graded by concept
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        {report.conceptGrades.map((c, i) => (
          <div key={i} style={{ ...card, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 12.5, letterSpacing: "0.02em", color: "#e3e5ea" }}>
              {c.sound ? "✓" : "•"} {c.concept}
            </span>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 18, color: c.sound ? "#5fcf99" : "var(--bow-warning)" }}>
              {c.grade}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={onPlayAgain}
          disabled={busy}
          style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, letterSpacing: "0.05em", textTransform: "uppercase", padding: "13px 26px", border: "none", background: busy ? "var(--bow-inactive)" : "var(--bow-blue)", color: "#fff", borderRadius: 4, cursor: busy ? "wait" : "pointer" }}
        >
          {busy ? "Loading…" : "Run It Again"}
        </button>
        <Link href="/leaderboard" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, letterSpacing: "0.05em", textTransform: "uppercase", padding: "13px 26px", border: "1px solid rgba(255,255,255,0.35)", color: "#fff", borderRadius: 4, textDecoration: "none" }}>
          See the Leaderboard
        </Link>
      </div>
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ ...card, padding: "12px 14px" }}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 20, color: accent ?? "#fff" }}>{value}</div>
      <div style={{ marginTop: 4, fontFamily: "var(--font-data)", fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9a9da6" }}>{label}</div>
    </div>
  );
}
