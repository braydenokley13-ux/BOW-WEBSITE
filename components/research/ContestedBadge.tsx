"use client";

/* ============================================================
 * ContestedBadge — a verdict that doesn't survive every worldview.
 *
 * Pure and cheap: buildLensSplit(player) reruns valuate() under all
 * five preset lenses and reports how far the verdicts spread. The
 * badge only appears when verdicts land at least TWO tiers apart —
 * the same bar the docket's lens-split detector uses. One tier of
 * drift across five deliberately different worldviews is normal
 * (59% of the tracked slate); two-plus tiers is a genuine fight
 * (~36%), and that's the only kind worth a badge.
 * ============================================================ */

import type { CSSProperties } from "react";
import type { AnalyticsPlayer } from "@/lib/aasv";
import { VERDICT_LABELS } from "@/lib/intelligence-types";
import { buildLensSplit, PRESET_LENSES } from "@/lib/lenses";

export interface ContestedBadgeProps {
  player: AnalyticsPlayer;
  style?: CSSProperties;
}

const CONTESTED_COLOR = "#c07f0a";

const badgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  fontFamily: "var(--font-data)",
  fontWeight: 600,
  fontSize: 11,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  border: `1px solid ${CONTESTED_COLOR}`,
  color: CONTESTED_COLOR,
  borderRadius: 2,
  padding: "3px 8px",
  whiteSpace: "nowrap",
};

export default function ContestedBadge({ player, style }: ContestedBadgeProps) {
  const split = buildLensSplit(player);
  if (split.span < 2) return null;

  const title = PRESET_LENSES.map((lens) => `${lens.name}: ${VERDICT_LABELS[split.verdicts[lens.id]]}`).join(" · ");

  return (
    <span title={title} style={{ ...badgeStyle, ...style }}>
      Contested · spans {split.span} tier{split.span === 1 ? "" : "s"}
    </span>
  );
}
