"use client";

/* ============================================================
 * FrontOfficeLab — the curriculum touches the real model.
 *
 * A guided exercise on the student dashboard built from the SAME
 * components the analytics desk runs (SliderPanel + the live
 * ContractVerdict embed), on a real contract from the tracked
 * league data. The pedagogy is the AASV thesis itself: the verdict
 * is not a fact, it's a consequence of assumptions — so the exercise
 * is "flip the verdict, then say what you had to believe."
 *
 * Deliberately no grading and no submission: the deliverable is the
 * student's own argument, and the place to make it is the weekly
 * challenge or a notebook draft on the research desk.
 * ============================================================ */

import Link from "next/link";
import type { AnalyticsPlayer } from "@/lib/aasv";
import { useAssumptions } from "@/components/analytics/useAssumptions";
import SliderPanel from "@/components/analytics/SliderPanel";
import { LiveContractVerdict } from "@/components/analytics/embeds/LiveAssumptions";

const promptStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-interface)",
  fontSize: 14,
  lineHeight: 1.6,
  color: "var(--bow-ink)",
};

export default function FrontOfficeLab({ player, allPlayers }: { player: AnalyticsPlayer; allPlayers: AnalyticsPlayer[] }) {
  const [assumptions, setAssumptions, reset] = useAssumptions();

  return (
    <section
      aria-label="Front Office Lab"
      style={{ background: "var(--bow-paper)", border: "1px solid var(--border-rule)", borderRadius: 8, padding: "clamp(18px,2.6vw,28px)", display: "flex", flexDirection: "column", gap: 16 }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
            Front Office Lab · Live model
          </span>
          <h2 style={{ margin: "6px 0 0", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(20px,2.6vw,26px)", textTransform: "uppercase", letterSpacing: "-0.01em", color: "var(--bow-ink)" }}>
            Argue with the model
          </h2>
        </div>
        <Link
          href="/analytics"
          style={{ fontFamily: "var(--font-data)", fontSize: 11.5, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--bow-blue)", textDecoration: "none" }}
        >
          The full research desk →
        </Link>
      </div>

      <p style={promptStyle}>
        This is not a simulation — it&rsquo;s the same valuation model the research desk publishes with, pointed at{" "}
        <strong>{player.name}</strong>&rsquo;s real contract. The verdict below isn&rsquo;t a fact; it&rsquo;s what
        follows from the dials. Your exercise, three steps:
      </p>
      <ol style={{ margin: 0, paddingLeft: 22, display: "flex", flexDirection: "column", gap: 6 }}>
        <li style={promptStyle}>
          Read the verdict as-is. In one sentence, say what the model believes a{" "}
          <Link href="/glossary" className="bow-link" style={{ color: "var(--bow-blue)" }}>marginal win</Link> costs.
        </li>
        <li style={promptStyle}>
          Now flip the verdict — make this contract read one tier better or worse — using the fewest dial moves you can.
        </li>
        <li style={promptStyle}>
          Say out loud what you had to believe to get there (a cheaper win? a scarier{" "}
          <Link href="/glossary" className="bow-link" style={{ color: "var(--bow-blue)" }}>apron</Link>?). That
          sentence is a front-office opinion — the exact kind the{" "}
          <Link href="/analytics/questions" className="bow-link" style={{ color: "var(--bow-blue)" }}>Open Docket</Link>{" "}
          pays out on.
        </li>
      </ol>

      <SliderPanel assumptions={assumptions} onChange={setAssumptions} onReset={reset} />
      <LiveContractVerdict player={player} allPlayers={allPlayers} />
    </section>
  );
}
