"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DailyScenarioView } from "@/lib/account";
import { submitDailyScenario } from "@/app/actions/lms";

interface Props {
  /** This week's active scenario (always available), or null if none seeded. */
  active: DailyScenarioView | null;
  /** Previously answered scenarios (excluding this week's), newest first. */
  history: DailyScenarioView[];
}

/**
 * BOW Daily Sports Scenarios (Feature 2). One scenario is active each week and
 * is always available regardless of module progress. The explanation reveals
 * only after the student submits a response; prior responses persist.
 */
export default function DailyScenarios({ active, history }: Props) {
  return (
    <section
      className="bow-front-office"
      style={{ background: "var(--bow-ink)", color: "#fff", borderRadius: 6, padding: "clamp(22px,3.2vw,34px)", marginTop: 8 }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
          BOW Daily
        </span>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6d7078" }}>
          This week’s scenario
        </span>
      </div>
      <h2 style={{ margin: "0 0 4px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(24px,3.4vw,38px)", lineHeight: 0.96, letterSpacing: "-0.01em", textTransform: "uppercase" }}>
        Your sports-business scenario.
      </h2>
      <p style={{ margin: "0 0 22px", fontFamily: "var(--font-interface)", fontSize: 14.5, lineHeight: 1.6, color: "#b9bcc4", maxWidth: 560 }}>
        One real sports situation a week. Read it, make your call, then see the economics behind it. A new scenario rotates in every week — answer it whenever you like.
      </p>

      {active ? (
        <ActiveScenario key={active.id} scenario={active} />
      ) : (
        <div style={{ border: "1px solid var(--bow-dark-border)", background: "var(--bow-dark-surface)", borderRadius: 4, padding: "20px 22px" }}>
          <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14.5, lineHeight: 1.6, color: "#b9bcc4" }}>
            No scenario is available right now. Check back soon.
          </p>
        </div>
      )}

      {history.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6d7078", display: "block", marginBottom: 12 }}>
            Scenarios you’ve answered
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {history.map((s) => (
              <article key={s.id} style={{ border: "1px solid var(--bow-dark-border)", background: "var(--bow-dark-surface)", borderRadius: 4, padding: "clamp(18px,2.4vw,24px)" }}>
                <ConceptTag concept={s.concept} />
                <p style={{ margin: "12px 0 0", fontFamily: "var(--font-editorial)", fontSize: "clamp(15px,1.7vw,17px)", lineHeight: 1.5, color: "#d4d6db" }}>
                  {s.scenario}
                </p>
                <Reveal response={s.response ?? ""} explanation={s.explanation ?? ""} compact />
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ActiveScenario({ scenario }: { scenario: DailyScenarioView }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [response, setResponse] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Server-revealed copy after a submit this session (so it shows without a reload).
  const [revealed, setRevealed] = useState<{ explanation: string } | null>(null);

  const answered = scenario.answered;

  const onSubmit = async () => {
    if (!response.trim() || submitting) return;
    setSubmitting(true);
    const res = await submitDailyScenario(scenario.id, response);
    setSubmitting(false);
    if (res.ok && res.explanation) {
      setRevealed({ explanation: res.explanation });
      startTransition(() => router.refresh());
    }
  };

  return (
    <article style={{ border: "1px solid var(--bow-dark-border)", background: "var(--bow-dark-surface)", borderTop: "4px solid var(--bow-orange)", borderRadius: 4, padding: "clamp(20px,3vw,28px)" }}>
      <ConceptTag concept={scenario.concept} />
      <p style={{ margin: "14px 0 0", fontFamily: "var(--font-editorial)", fontSize: "clamp(15.5px,1.7vw,18px)", lineHeight: 1.5, color: "#d4d6db" }}>
        {scenario.scenario}
      </p>

      {answered ? (
        // Already answered on a prior visit — show their saved response + explanation.
        <Reveal response={scenario.response ?? ""} explanation={scenario.explanation ?? ""} />
      ) : revealed ? (
        // Just submitted this session.
        <Reveal response={response} explanation={revealed.explanation} />
      ) : (
        <>
          <div style={{ marginTop: 18, borderLeft: "4px solid var(--bow-blue)", paddingLeft: 16 }}>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6f8bff" }}>Your response</span>
            <p style={{ margin: "6px 0 0", fontFamily: "var(--font-interface)", fontSize: 13.5, lineHeight: 1.5, color: "#b9bcc4" }}>
              Make your call — a sentence or two on what you’d do and why.
            </p>
          </div>
          <textarea
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            rows={3}
            placeholder="Write your answer here…"
            style={{ width: "100%", marginTop: 14, background: "var(--bow-ink)", border: "1px solid var(--bow-dark-border)", color: "#fff", padding: "12px 14px", borderRadius: 4, fontFamily: "var(--font-interface)", fontSize: 14.5, lineHeight: 1.55, resize: "vertical", outline: "none" }}
          />
          <button
            onClick={onSubmit}
            disabled={!response.trim() || submitting}
            style={{ marginTop: 14, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, letterSpacing: "0.05em", textTransform: "uppercase", padding: "12px 24px", border: "none", background: !response.trim() || submitting ? "var(--bow-inactive)" : "var(--bow-orange)", color: "#fff", borderRadius: 4, cursor: !response.trim() || submitting ? "not-allowed" : "pointer" }}
          >
            {submitting ? "Submitting…" : "Submit Response"}
          </button>
        </>
      )}
    </article>
  );
}

function ConceptTag({ concept }: { concept: string }) {
  return (
    <span style={{ display: "inline-block", fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.04em", textTransform: "uppercase", color: "#0a0a0b", background: "var(--bow-orange)", padding: "3px 9px", borderRadius: 3 }}>
      {concept}
    </span>
  );
}

function Reveal({ response, explanation, compact = false }: { response: string; explanation: string; compact?: boolean }) {
  return (
    <div style={{ marginTop: compact ? 12 : 18 }}>
      <div style={{ background: "var(--bow-ink)", border: "1px solid var(--bow-dark-border)", borderRadius: 4, padding: "12px 14px" }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6d7078" }}>Your call</span>
        <p style={{ margin: "5px 0 0", fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.55, color: "#d4d6db", whiteSpace: "pre-wrap" }}>{response}</p>
      </div>
      <div style={{ marginTop: 12, border: "1px solid var(--bow-dark-border)", borderTop: "4px solid var(--bow-positive)", background: "var(--bow-dark-surface)", borderRadius: 4, padding: "14px 16px" }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-positive)" }}>The economics</span>
        <p style={{ margin: "7px 0 0", fontFamily: "var(--font-editorial)", fontSize: 15.5, lineHeight: 1.55, color: "#d4d6db" }}>{explanation}</p>
      </div>
    </div>
  );
}
