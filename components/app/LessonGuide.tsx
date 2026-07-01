"use client";

import { useState } from "react";
import Link from "next/link";
import type { Lesson } from "@/lib/lessons";

/**
 * The instructor lesson guide — the 10-section prep document an instructor
 * needs before, during, and after teaching a case: overview, objective,
 * business concept, scenario, simulation instructions, the key decision,
 * discussion prompts, common misconceptions, wrap-up, and an optional
 * extension. Sections 1-7 render straight from the lesson's real content
 * (situation/evidence/stakeholders/decisionOptions/discussionQuestions —
 * the same data the public case-file page uses). Sections 8-9-10 don't have
 * a dedicated per-lesson field in the data model yet, so they're honestly
 * synthesized FROM this lesson's real stakeholders/concepts rather than
 * hardcoded filler that would read the same on every lesson.
 */

const sectionWrap: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 10, padding: "18px 0", borderBottom: "1px solid var(--border-rule)" };
const kicker: React.CSSProperties = { fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-blue)" };
const body: React.CSSProperties = { margin: 0, fontFamily: "var(--font-interface)", fontSize: 13.5, lineHeight: 1.55, color: "var(--bow-ink)" };
const muted: React.CSSProperties = { margin: 0, fontFamily: "var(--font-interface)", fontSize: 13, lineHeight: 1.5, color: "var(--bow-slate)" };

function objectiveFor(l: Lesson): string {
  const outcome = l.learningOutcomes[0];
  if (outcome) return `By the end of this case, students should be able to ${outcome.use.toLowerCase().replace(/\.$/, "")}.`;
  return `By the end of this case, students should be able to apply ${l.concepts[0] ?? "the concept"} to a real front-office decision.`;
}

function misconceptionsFor(l: Lesson): string[] {
  if (l.stakeholders.length < 2) {
    return ["Watch for students defending the option with the best-sounding label instead of weighing the actual trade-off in the evidence above."];
  }
  const [a, b] = l.stakeholders;
  return [
    `Most students assume there's a single "right" call. Use the tension between ${a.name} (wants ${a.interest.toLowerCase()}) and ${b.name} (concerned about ${b.concern.toLowerCase()}) to show every option has a real cost.`,
    "Students often confuse the sports headline for the economics underneath it — keep pulling the conversation back to the concept, not just what happened in the game.",
  ];
}

function wrapUpFor(l: Lesson): string {
  const concept = l.concepts[0] ?? "the concept";
  return `Ask each student to write one sentence defending their call using "${concept}" by name — reasoning without the vocabulary doesn't count as done.`;
}

function extensionFor(l: Lesson): string {
  const concept = l.concepts[0] ?? "this concept";
  return `Optional: have students find one real headline where ${concept.toLowerCase()} shaped a team's decision and bring it to the next class.`;
}

export default function LessonGuide({ lesson: l }: { lesson: Lesson }) {
  const [open, setOpen] = useState(true);

  return (
    <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 22 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Instructor Lesson Guide</span>
        <button onClick={() => setOpen((v) => !v)} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--bow-blue)", background: "transparent", border: "none", cursor: "pointer" }}>
          {open ? "Collapse" : "Expand"}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 8 }}>
          <div style={sectionWrap}>
            <span style={kicker}>1 · Lesson Overview</span>
            <p style={body}>{l.overview || l.summary}</p>
          </div>

          <div style={sectionWrap}>
            <span style={kicker}>2 · Learning Objective</span>
            <p style={body}>{objectiveFor(l)}</p>
          </div>

          <div style={sectionWrap}>
            <span style={kicker}>3 · Business Concept Taught</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
              {l.concepts.map((c) => (
                <span key={c} style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-ink)", background: "var(--bow-paper)", border: "1px solid var(--border-rule)", padding: "3px 8px", borderRadius: 999 }}>{c}</span>
              ))}
            </div>
            {l.learningOutcomes.map((o) => (
              <p key={o.concept} style={muted}><strong style={{ color: "var(--bow-ink)" }}>{o.concept}</strong>{o.means ? ` — ${o.means}` : ""}</p>
            ))}
          </div>

          <div style={sectionWrap}>
            <span style={kicker}>4 · Scenario Setup</span>
            {l.situation.map((p, i) => (
              <p key={i} style={muted}>{p}</p>
            ))}
            {l.needToKnow.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
                {l.needToKnow.map((k) => (
                  <p key={k.term} style={muted}><strong style={{ color: "var(--bow-ink)" }}>{k.term}:</strong> {k.body}</p>
                ))}
              </div>
            )}
          </div>

          <div style={sectionWrap}>
            <span style={kicker}>5 · Simulation Instructions</span>
            {l.simulationStatus === "available" ? (
              <>
                <p style={body}>This case has a live simulation. Have students launch it after the scenario briefing, make their call, and return with their result before the debrief.</p>
                <Link href={l.simulationUrl ?? "/simulation"} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--bow-blue)", width: "fit-content" }}>
                  Preview the simulation →
                </Link>
              </>
            ) : (
              <p style={muted}>No interactive simulation is built for this case yet — run it as a discussion using the decision options below, then debrief as a class.</p>
            )}
          </div>

          <div style={sectionWrap}>
            <span style={kicker}>6 · Key Decision Students Make</span>
            <p style={body}>{l.decisionPrompt || l.centralQuestion}</p>
            {l.decisionOptions.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                {l.decisionOptions.map((o, i) => (
                  <p key={i} style={muted}><strong style={{ color: "var(--bow-ink)" }}>{String.fromCharCode(65 + i)}. {o.label}</strong>{o.detail ? ` — ${o.detail}` : ""}</p>
                ))}
              </div>
            )}
          </div>

          <div style={sectionWrap}>
            <span style={kicker}>7 · Discussion Prompts</span>
            {(l.discussionQuestions.length > 0 ? l.discussionQuestions : [l.centralQuestion]).map((q, i) => (
              <p key={i} style={muted}>{i + 1}. {q}</p>
            ))}
          </div>

          <div style={sectionWrap}>
            <span style={kicker}>8 · Common Student Misconceptions</span>
            {misconceptionsFor(l).map((m, i) => (
              <p key={i} style={muted}>{m}</p>
            ))}
          </div>

          <div style={sectionWrap}>
            <span style={kicker}>9 · Wrap-Up / Reflection</span>
            <p style={body}>{wrapUpFor(l)}</p>
          </div>

          <div style={{ ...sectionWrap, borderBottom: "none", paddingBottom: 0 }}>
            <span style={kicker}>10 · Optional Extension Activity</span>
            <p style={muted}>{extensionFor(l)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
