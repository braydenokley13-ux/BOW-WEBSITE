"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button, DataStrip, DecisionCard } from "@/components/ds";
import type { DataItem } from "@/components/ds";
import {
  SIM,
  SIM_AXIS,
  SIM_BASE,
  entryMetrics,
  identityForAxis,
  otherExecForAxis,
  METRIC_META,
  type MetricKey,
  type Metrics,
} from "@/lib/simulation";

const METRIC_KEYS: MetricKey[] = ["winNow", "future", "cap", "fans"];

type Choices = Record<number, string>;
type Revealed = Record<number, boolean>;

/** Running Front Office Index: base + deltas from every committed choice up to a step. */
function computeMetrics(choices: Choices, uptoInclusive: number | null): { m: Metrics; lastDelta: Partial<Metrics> } {
  const m: Metrics = { ...SIM_BASE };
  const lastDelta: Partial<Metrics> = {};
  Object.keys(choices).forEach((k) => {
    const step = Number(k);
    if (uptoInclusive != null && step > uptoInclusive) return;
    const dec = SIM[step];
    const ch = choices[step];
    const d = dec && dec.detail[ch] && dec.detail[ch].metrics;
    if (d) {
      (Object.keys(d) as MetricKey[]).forEach((key) => {
        const delta = d[key];
        if (delta == null) return;
        m[key] += delta;
        if (step === uptoInclusive) lastDelta[key] = delta;
      });
    }
  });
  METRIC_KEYS.forEach((k) => {
    m[k] = Math.max(2, Math.min(99, m[k]));
  });
  return { m, lastDelta };
}

function tone(v: number | undefined): DataItem["tone"] {
  if (v == null || v === 0) return undefined;
  return v > 0 ? "positive" : "negative";
}

const SECTION_PAD_ENTRY = "clamp(24px,3vw,36px) clamp(18px,4vw,40px) clamp(48px,7vw,96px)";

interface SimulationProps {
  /** Fires once the simulation reaches its debrief — used by embedders (e.g. the Daily Feed). */
  onComplete?: () => void;
  /** Optional footer to render on the completed screen in place of the marketing CTAs. */
  completedFooter?: React.ReactNode;
}

export default function Simulation({ onComplete, completedFooter }: SimulationProps = {}) {
  const [started, setStarted] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [step, setStep] = useState(0);
  const [choices, setChoices] = useState<Choices>({});
  const [revealed, setRevealed] = useState<Revealed>({});

  useEffect(() => {
    if (completed) onComplete?.();
    // Fire only on the completed transition; onComplete is treated as stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completed]);

  const scrollTop = () => {
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "auto" });
  };

  const beginSim = () => {
    setStarted(true);
    setCompleted(false);
    setStep(0);
    setChoices({});
    setRevealed({});
    scrollTop();
  };

  const replay = () => beginSim();

  const submit = (choiceId: string) => {
    setChoices((c) => ({ ...c, [step]: choiceId }));
    setRevealed((r) => ({ ...r, [step]: true }));
  };

  const advance = () => {
    const isLast = step >= SIM.length - 1;
    if (isLast) {
      setCompleted(true);
    } else {
      setStep((s) => s + 1);
    }
    scrollTop();
  };

  const reviewBrief = () => {
    if (typeof document === "undefined") return;
    const el = document.getElementById("sim-situation");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const entry = !started && !completed;
  const active = started && !completed;

  return (
    <div className="bow-front-office" style={{ background: "var(--bow-ink)", color: "#fff", minHeight: "88vh" }}>
      {entry && <EntryScreen onBegin={beginSim} />}
      {active && (
        <ActiveScreen
          step={step}
          choices={choices}
          revealed={!!revealed[step]}
          onSubmit={submit}
          onAdvance={advance}
          onReviewBrief={reviewBrief}
        />
      )}
      {completed && <CompletedScreen choices={choices} onReplay={replay} footer={completedFooter} />}
    </div>
  );
}

/* ===================== ENTRY ===================== */
function EntryScreen({ onBegin }: { onBegin: () => void }) {
  return (
    <section style={{ padding: SECTION_PAD_ENTRY, position: "relative", overflow: "hidden" }}>
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(49,87,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(49,87,255,0.06) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          opacity: 0.6,
        }}
      />
      <div style={{ maxWidth: "var(--content-max)", margin: "0 auto", position: "relative" }}>
        <nav
          aria-label="Breadcrumb"
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
            fontFamily: "var(--font-data)",
            fontSize: 12,
            letterSpacing: "0.04em",
            color: "#6d7078",
          }}
        >
          <Link href="/programs/track-101" style={{ color: "#6f8bff", textDecoration: "none" }}>
            Track 101
          </Link>
          <span aria-hidden>/</span>
          <Link href="/lessons" style={{ color: "#6f8bff", textDecoration: "none" }}>
            Lesson 2
          </Link>
          <span aria-hidden>/</span>
          <span style={{ color: "#fff" }}>Simulation</span>
        </nav>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "clamp(28px,4vw,56px)",
            alignItems: "center",
            marginTop: 28,
          }}
        >
          <div style={{ maxWidth: 560 }}>
            <span
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 12,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--bow-orange)",
              }}
            >
              War Room · Standalone Simulation
            </span>
            <h1
              style={{
                margin: "14px 0 0",
                fontFamily: "var(--font-display)",
                fontWeight: 900,
                fontSize: "clamp(40px,7vw,92px)",
                lineHeight: 0.86,
                letterSpacing: "-0.02em",
                textTransform: "uppercase",
              }}
            >
              The Asset
              <br />
              Everyone Wants
            </h1>
            <p
              style={{
                margin: "20px 0 0",
                fontFamily: "var(--font-interface)",
                fontSize: "clamp(16px,1.4vw,20px)",
                lineHeight: 1.6,
                color: "#b9bcc4",
                maxWidth: 480,
              }}
            >
              You’re the GM. Across three rounds, decide what your young star is really worth — and what you’re willing to
              give up to win now.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 22, marginTop: 26 }}>
              {[
                ["Your Role", "General Manager"],
                ["Decisions", "3 rounds"],
                ["Runtime", "6–9 min"],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <span
                    style={{
                      fontFamily: "var(--font-data)",
                      fontSize: 11,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "#6d7078",
                    }}
                  >
                    {k}
                  </span>
                  <span style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 16 }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 30 }}>
              <Button variant="primary" size="lg" onClick={onBegin}>
                Enter the Simulation
              </Button>
              <Button
                href="/lessons"
                variant="secondary"
                size="lg"
                style={{ color: "#fff", borderColor: "var(--bow-dark-border)" }}
              >
                Review the Concepts
              </Button>
            </div>
          </div>

          <div style={{ border: "1px solid var(--bow-dark-border)", background: "var(--bow-dark-surface)" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--bow-dark-border)" }}>
              <span
                style={{
                  fontFamily: "var(--font-data)",
                  fontSize: 11,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "#6d7078",
                }}
              >
                Metrics that will matter
              </span>
            </div>
            {entryMetrics.map((em) => (
              <div
                key={em.label}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  padding: "16px 20px",
                  borderBottom: "1px solid var(--bow-dark-border)",
                }}
              >
                <span style={{ width: 8, height: 8, background: em.dot, marginTop: 5, flex: "0 0 8px" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 700,
                      fontSize: 16,
                      textTransform: "uppercase",
                      letterSpacing: "0.01em",
                    }}
                  >
                    {em.label}
                  </span>
                  <span style={{ fontFamily: "var(--font-interface)", fontSize: 13.5, lineHeight: 1.45, color: "#9a9da6" }}>
                    {em.desc}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ===================== ACTIVE ===================== */
function ActiveScreen({
  step,
  choices,
  revealed,
  onSubmit,
  onAdvance,
  onReviewBrief,
}: {
  step: number;
  choices: Choices;
  revealed: boolean;
  onSubmit: (id: string) => void;
  onAdvance: () => void;
  onReviewBrief: () => void;
}) {
  const dec = SIM[step] ?? SIM[0];
  const choiceNow = choices[step] ?? null;
  const detailNow = revealed && choiceNow ? dec.detail[choiceNow] : null;
  const chosenLabel = choiceNow ? dec.options.find((o) => o.id === choiceNow)?.label ?? "" : "";

  const { m, lastDelta } = useMemo(
    () => computeMetrics(choices, revealed ? step : step - 1),
    [choices, revealed, step],
  );

  const metricItems: DataItem[] = [
    { label: "Win-Now", value: String(m.winNow), tone: tone(lastDelta.winNow) },
    { label: "Future Assets", value: String(m.future), tone: tone(lastDelta.future) },
    { label: "Cap Flex", value: String(m.cap), tone: tone(lastDelta.cap) },
    { label: "Fan Buzz", value: String(m.fans), tone: tone(lastDelta.fans) },
  ];

  const isLast = step >= SIM.length - 1;
  const advanceLabel = isLast ? "See the Final Result" : "Next Decision";

  const progress = SIM.map((d, i) => {
    const done = i < step || (i === step && revealed);
    const isActive = i === step;
    return {
      n: String(i + 1).padStart(2, "0"),
      label: d.round.split("·")[0].replace(/Round\s*/i, "").trim(),
      dot: done ? "var(--bow-positive)" : isActive ? "var(--bow-blue)" : "#3a3a42",
      col: done || isActive ? "#fff" : "#6d7078",
    };
  });

  return (
    <section style={{ padding: "clamp(20px,3vw,32px) clamp(18px,4vw,40px) clamp(48px,7vw,80px)" }}>
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        {/* progress */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 22 }}>
          {progress.map((p) => (
            <div key={p.n} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 9, height: 9, borderRadius: 999, background: p.dot }} />
              <span
                style={{
                  fontFamily: "var(--font-data)",
                  fontSize: 11,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: p.col,
                }}
              >
                {p.n} {p.label}
              </span>
            </div>
          ))}
        </div>

        {/* running metrics */}
        <div
          style={{
            marginBottom: 8,
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 11,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#6d7078",
            }}
          >
            Front Office Index · Decision {String(step + 1).padStart(2, "0")} of {String(SIM.length).padStart(2, "0")}
          </span>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "#6d7078" }}>
            0–99 scale · updates with each call
          </span>
        </div>
        <DataStrip dark items={metricItems} style={{ marginBottom: 26 }} />

        {/* situation */}
        <div id="sim-situation" style={{ borderLeft: "4px solid var(--bow-orange)", paddingLeft: 18, marginBottom: 26, scrollMarginTop: 80 }}>
          <span
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 11,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--bow-orange)",
            }}
          >
            {dec.round}
          </span>
          <h2
            style={{
              margin: "8px 0 0",
              fontFamily: "var(--font-display)",
              fontWeight: 900,
              fontSize: "clamp(26px,4vw,44px)",
              lineHeight: 0.95,
              letterSpacing: "-0.01em",
              textTransform: "uppercase",
            }}
          >
            {dec.question}
          </h2>
        </div>

        {/* decision card — remounts per step so its internal state resets */}
        {!revealed && (
          <DecisionCard
            key={`sim-${step}`}
            desk="Decision Desk"
            round={dec.round}
            prompt={dec.prompt}
            facts={dec.facts}
            unknowns={dec.unknowns}
            options={dec.options}
            onSubmit={onSubmit}
            onSecondary={onReviewBrief}
            primaryLabel="Make the Call"
            secondaryLabel="Re-read the Brief"
          />
        )}

        {/* recap + rich consequence detail + advance */}
        {revealed && detailNow && (
          <>
            <div
              style={{
                border: "1px solid var(--bow-dark-border)",
                borderTop: "4px solid var(--bow-blue)",
                background: "var(--bow-ink)",
                borderRadius: "var(--radius-card)",
                padding: 24,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <h3 style={{ margin: 0, fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: 22, lineHeight: 1.2 }}>{dec.prompt}</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6d7078" }}>Your Call</span>
                <span style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 16, color: "#fff" }}>{chosenLabel}</span>
              </div>
            </div>
            <div style={{ marginTop: 24, border: "1px solid var(--bow-dark-border)", background: "var(--bow-dark-surface)" }}>
              <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--bow-dark-border)" }}>
                <span
                  style={{
                    fontFamily: "var(--font-data)",
                    fontSize: 11,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "#6d7078",
                  }}
                >
                  What your call set in motion
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
                <DetailCell
                  label="+ Upside"
                  labelColor="var(--bow-positive)"
                  text={detailNow.positive}
                  borderBottom
                  borderRight
                />
                <DetailCell label="− Tradeoff" labelColor="var(--bow-negative)" text={detailNow.negative} borderBottom />
                <DetailCell
                  label="Front Office"
                  labelColor="#6f8bff"
                  text={detailNow.reaction}
                  italic
                  borderRight
                />
                <DetailCell label="New Problem" labelColor="var(--bow-warning)" text={detailNow.newProblem} />
              </div>
            </div>
            <div style={{ marginTop: 22, display: "flex", justifyContent: "flex-end" }}>
              <Button variant="emphasis" size="lg" onClick={onAdvance}>
                {advanceLabel} →
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function DetailCell({
  label,
  labelColor,
  text,
  italic = false,
  borderBottom = false,
  borderRight = false,
}: {
  label: string;
  labelColor: string;
  text: string;
  italic?: boolean;
  borderBottom?: boolean;
  borderRight?: boolean;
}) {
  return (
    <div
      style={{
        padding: "20px 22px",
        borderBottom: borderBottom ? "1px solid var(--bow-dark-border)" : undefined,
        borderRight: borderRight ? "1px solid var(--bow-dark-border)" : undefined,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: labelColor,
        }}
      >
        {label}
      </span>
      <p
        style={{
          margin: "8px 0 0",
          fontFamily: "var(--font-interface)",
          fontSize: 14.5,
          lineHeight: 1.55,
          fontStyle: italic ? "italic" : "normal",
          color: "#d6d8dd",
        }}
      >
        {text}
      </p>
    </div>
  );
}

/* ===================== COMPLETED ===================== */
function CompletedScreen({ choices, onReplay, footer }: { choices: Choices; onReplay: () => void; footer?: React.ReactNode }) {
  const axisSum = Object.keys(choices).reduce(
    (a, k) => a + ((SIM_AXIS[Number(k)] && SIM_AXIS[Number(k)][choices[Number(k)]]) || 0),
    0,
  );
  const { identity, identityBody } = identityForAxis(axisSum);
  const otherExec = otherExecForAxis(axisSum);

  const finalM = computeMetrics(choices, null).m;
  const strongKey = METRIC_KEYS.reduce((a, b) => (finalM[b] > finalM[a] ? b : a), METRIC_KEYS[0]);
  const weakKey = METRIC_KEYS.reduce((a, b) => (finalM[b] < finalM[a] ? b : a), METRIC_KEYS[0]);

  const decisionsMade = SIM.map((d, i) => {
    const ch = choices[i];
    const opt = d.options.find((o) => o.id === ch);
    return { round: d.round, choice: opt ? opt.label : "—", n: String(i + 1).padStart(2, "0") };
  });

  const finalMetricItems: DataItem[] = METRIC_KEYS.map((k) => ({
    label: METRIC_META[k].name,
    value: String(finalM[k]),
  }));

  return (
    <section
      style={{
        padding: "clamp(28px,4vw,48px) clamp(18px,4vw,40px) clamp(48px,7vw,96px)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          right: -40,
          bottom: -80,
          fontFamily: "var(--font-display)",
          fontWeight: 900,
          fontSize: "clamp(160px,24vw,360px)",
          lineHeight: 0.7,
          color: "rgba(255,255,255,0.05)",
          pointerEvents: "none",
        }}
      >
        GM
      </div>
      <div style={{ maxWidth: "var(--content-max)", margin: "0 auto", position: "relative" }}>
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 12,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--bow-orange)",
          }}
        >
          Simulation Complete · Your Front Office, Debriefed
        </span>
        <h1
          style={{
            margin: "14px 0 0",
            fontFamily: "var(--font-display)",
            fontWeight: 900,
            fontSize: "clamp(38px,6vw,84px)",
            lineHeight: 0.88,
            letterSpacing: "-0.02em",
            textTransform: "uppercase",
          }}
        >
          You ran it as a
          <br />
          <span style={{ color: "#6f8bff" }}>{identity}</span>
        </h1>
        <p
          style={{
            margin: "20px 0 0",
            fontFamily: "var(--font-interface)",
            fontSize: "clamp(16px,1.4vw,20px)",
            lineHeight: 1.6,
            color: "#b9bcc4",
            maxWidth: 600,
          }}
        >
          {identityBody}
        </p>

        {/* decisions made */}
        <div style={{ marginTop: 36, border: "1px solid var(--bow-dark-border)", background: "var(--bow-dark-surface)" }}>
          <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--bow-dark-border)" }}>
            <span
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 11,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#6d7078",
              }}
            >
              The Decisions You Made
            </span>
          </div>
          {decisionsMade.map((d) => (
            <div
              key={d.n}
              style={{
                display: "grid",
                gridTemplateColumns: "44px 1fr",
                gap: 14,
                alignItems: "center",
                padding: "16px 22px",
                borderBottom: "1px solid var(--bow-dark-border)",
              }}
            >
              <span style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: 14, color: "#6f8bff" }}>{d.n}</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                <span
                  style={{
                    fontFamily: "var(--font-data)",
                    fontSize: 11,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "#6d7078",
                  }}
                >
                  {d.round}
                </span>
                <span style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 16 }}>{d.choice}</span>
              </div>
            </div>
          ))}
        </div>

        {/* final metrics */}
        <div style={{ marginTop: 28 }}>
          <span
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 11,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#6d7078",
              display: "block",
              marginBottom: 10,
            }}
          >
            Final Front Office Index
          </span>
          <DataStrip dark items={finalMetricItems} />
        </div>

        {/* analysis */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 1,
            background: "var(--bow-dark-border)",
            border: "1px solid var(--bow-dark-border)",
            marginTop: 28,
          }}
        >
          <AnalysisCell label="Strongest Decision" labelColor="var(--bow-positive)" text={METRIC_META[strongKey].strong} />
          <AnalysisCell label="Biggest Tradeoff" labelColor="var(--bow-warning)" text={METRIC_META[weakKey].weak} />
          <AnalysisCell label="Another Exec Would Say" labelColor="#6f8bff" text={otherExec} />
        </div>

        {footer ? (
          <div style={{ marginTop: 32 }}>{footer}</div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 32 }}>
            <Button href="/lessons" variant="primary" size="lg">
              Return to the Lesson
            </Button>
            <Button href="/lessons" variant="emphasis" size="lg">
              Continue to Lesson 3
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={onReplay}
              style={{ color: "#fff", borderColor: "var(--bow-dark-border)" }}
            >
              Replay Simulation
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

function AnalysisCell({ label, labelColor, text }: { label: string; labelColor: string; text: string }) {
  return (
    <div style={{ background: "var(--bow-ink)", padding: 22 }}>
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: labelColor,
        }}
      >
        {label}
      </span>
      <p style={{ margin: "8px 0 0", fontFamily: "var(--font-interface)", fontSize: 15.5, lineHeight: 1.55, color: "#d6d8dd" }}>
        {text}
      </p>
    </div>
  );
}
