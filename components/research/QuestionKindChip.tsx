import type { CSSProperties } from "react";
import { QUESTION_KIND_LABELS, type QuestionKind } from "@/lib/research-types";

/* ============================================================
 * QuestionKindChip — the docket's kind chip.
 *
 * Same color-dot-plus-label idiom as ApronBadge / VerdictBadge, and the
 * seven accent colors are the SAME tokens those badges already draw
 * from (see lib/aasv's APRON_COLORS and lib/intelligence-types's
 * VERDICT_COLORS / RISK_COLORS / TRADE_SIDE_COLORS) — one semantic
 * color per docket kind, nothing invented:
 *
 *   knife-edge             — ScenarioRange's own "verdict flips" caution color
 *   lens-split              — franchise blue: no single right answer, pick a lens
 *   price-production-gap   — signal orange: an editorial pricing call
 *   aging-cliff             — risk red: decline + forward exposure
 *   metric-disagreement    — neutral inactive-grey: trackers disagree, no verdict either way
 *   mutual-gain-trade       — surplus green: mirrors TRADE_SIDE_COLORS "wins"
 *   window-contradiction    — secondary slate: two neutral facts in tension
 * ============================================================ */

export const QUESTION_KIND_COLORS: Record<QuestionKind, string> = {
  "knife-edge": "var(--bow-warning-text)",
  "lens-split": "var(--bow-blue)",
  "price-production-gap": "var(--bow-orange)",
  "aging-cliff": "var(--bow-negative)",
  "metric-disagreement": "var(--bow-inactive)",
  "mutual-gain-trade": "var(--bow-positive)",
  "window-contradiction": "var(--bow-slate)",
};

/** One-line, compressed from the header comments in lib/tensions.ts — used by the docket's legend strip. */
export const QUESTION_KIND_EXPLANATIONS: Record<QuestionKind, string> = {
  "knife-edge": "The bear/bull band doesn't just move the number — it moves the verdict itself.",
  "lens-split": "Every preset worldview is legitimate; when the extremes land two-plus tiers apart, naming the lens you trust is the argument.",
  "price-production-gap": "Salary rank is a bet made in advance; production rank is what showed up. Far enough apart, that gap is a real question.",
  "aging-cliff": "No ages in the data — a trend-plus-exposure proxy. A decline only becomes a question once real money is riding on whether it's real.",
  "metric-disagreement": "The model defaults to est. net impact over BPM. When the two trackers disagree hard enough, that default stops being invisible.",
  "mutual-gain-trade": "The apron multiplier belongs to the receiving team, not the player — sometimes repricing lets both sides win, and nobody's made the call.",
  "window-contradiction": "A team's stated window and its cap posture can argue with each other — that tension is the story, not a bug in either read.",
};

interface QuestionKindChipProps {
  kind: QuestionKind;
  style?: CSSProperties;
}

export default function QuestionKindChip({ kind, style }: QuestionKindChipProps) {
  const color = QUESTION_KIND_COLORS[kind];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontFamily: "var(--font-data)",
        fontWeight: 600,
        fontSize: 11,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "var(--bow-ink)",
        border: "1px solid var(--border-rule)",
        background: "var(--bow-white)",
        padding: "3px 9px",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, background: color, flexShrink: 0 }} />
      {QUESTION_KIND_LABELS[kind]}
    </span>
  );
}
