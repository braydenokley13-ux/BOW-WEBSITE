import type { FranchiseIndex, IndexScore } from "@/lib/intelligence-types";

interface IndexScorecardProps {
  index: FranchiseIndex;
  title?: string;
}

type Dimension = Exclude<keyof FranchiseIndex, "overall">;

const DIMENSION_LABELS: Record<Dimension, string> = {
  rosterQuality: "Roster quality",
  capFlexibility: "Cap flexibility",
  assetBase: "Asset base",
  championshipWindow: "Championship window",
  downsideRisk: "Downside risk (inverse — higher is safer)",
  optionality: "Optionality",
};

const DIMENSION_ORDER: Dimension[] = [
  "rosterQuality",
  "capFlexibility",
  "assetBase",
  "championshipWindow",
  "downsideRisk",
  "optionality",
];

const GRADE_COLOR: Record<IndexScore["grade"], string> = {
  A: "var(--bow-positive)",
  B: "var(--bow-blue)",
  C: "var(--bow-warning-text)",
  D: "var(--bow-orange)",
  F: "var(--bow-negative)",
};

function ScoreBar({ label, score, prominent = false }: { label: string; score: IndexScore; prominent?: boolean }) {
  const color = GRADE_COLOR[score.grade];
  const pct = Math.max(0, Math.min(100, score.score));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: prominent ? 700 : 600,
            fontSize: prominent ? 15 : 13,
            letterSpacing: "0.03em",
            textTransform: "uppercase",
            color: "var(--bow-ink)",
          }}
        >
          {label}
        </span>
        <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
          <span
            style={{
              fontFamily: "var(--font-data)",
              fontSize: prominent ? 15 : 13,
              fontWeight: prominent ? 700 : 400,
              fontVariantNumeric: "tabular-nums",
              color: "var(--bow-slate)",
            }}
          >
            {score.score}/100
          </span>
          <span style={{ fontFamily: "var(--font-data)", fontWeight: 700, fontSize: prominent ? 16 : 14, color }}>{score.grade}</span>
        </span>
      </div>
      <div
        role="img"
        aria-label={`${label}: ${score.score} out of 100, grade ${score.grade}`}
        style={{ height: prominent ? 10 : 8, background: "var(--bow-border)", overflow: "hidden" }}
      >
        <div style={{ height: "100%", width: `${pct}%`, background: color }} />
      </div>
      <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 13.5, lineHeight: 1.5, color: "var(--bow-slate)" }}>{score.driver}</p>
    </div>
  );
}

/**
 * IndexScorecard — the six FranchiseIndex dimensions plus the overall
 * score, rendered as horizontal bars with letter grades and one-sentence
 * drivers. A financial-report reading, not a gamer dashboard: no chart
 * library, just divs.
 */
export default function IndexScorecard({ index, title = "Franchise Index" }: IndexScorecardProps) {
  return (
    <section
      style={{
        background: "var(--bow-white)",
        border: "1px solid var(--border-rule)",
        borderRadius: "var(--radius-card)",
        padding: "clamp(20px,2.6vw,28px)",
        display: "flex",
        flexDirection: "column",
        gap: 22,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 18, borderBottom: "1px solid var(--border-rule)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span
            style={{
              fontFamily: "var(--font-data)",
              fontWeight: 600,
              fontSize: 12,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--bow-slate)",
            }}
          >
            {title}
          </span>
          <span
            title="This index has not yet been backtested against outcomes — read it as a model, not a track record."
            style={{
              display: "inline-flex",
              alignItems: "center",
              fontFamily: "var(--font-data)",
              fontWeight: 600,
              fontSize: 9.5,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              border: "1px solid var(--bow-warning-text)",
              color: "var(--bow-warning-text)",
              borderRadius: 2,
              padding: "2px 7px",
              cursor: "help",
              whiteSpace: "nowrap",
            }}
          >
            Experimental
          </span>
        </div>
        <ScoreBar label="Overall" score={index.overall} prominent />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {DIMENSION_ORDER.map((dim) => (
          <ScoreBar key={dim} label={DIMENSION_LABELS[dim]} score={index[dim]} />
        ))}
      </div>
    </section>
  );
}
