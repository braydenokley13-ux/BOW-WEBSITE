"use client";

/* ============================================================
 * LensSwitcher — pick a worldview, everything recomputes.
 *
 * A horizontal rail of the five preset lenses (lib/lenses.ts) plus,
 * once the reader has moved a slider by hand, a sixth "My lens" chip
 * that reflects that custom state. Selecting a preset writes its
 * assumptions into the shared useAssumptions store via useLens — every
 * dashboard, memo, and embed on the site recomputes under it for free.
 * ============================================================ */

import type { CSSProperties } from "react";
import { useLens } from "@/components/research/useLens";
import { PRESET_LENSES } from "@/lib/lenses";
import { CUSTOM_LENS_ID } from "@/lib/research-types";

export interface LensSwitcherProps {
  dark?: boolean;
  compact?: boolean;
}

const railStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
};

const compactRailStyle: CSSProperties = {
  ...railStyle,
  gap: 8,
};

const chipBase: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 6,
  padding: "10px 14px",
  border: "1px solid var(--border-rule)",
  background: "transparent",
  borderRadius: 2,
  cursor: "pointer",
  textAlign: "left",
  minWidth: 168,
};

const compactChipStyle: CSSProperties = {
  padding: "6px 12px",
  minWidth: 0,
};

const nameStyle: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: 13,
  letterSpacing: "0.03em",
  textTransform: "uppercase",
  lineHeight: 1.2,
};

const philosophyStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-interface)",
  fontSize: 12,
  lineHeight: 1.4,
  maxWidth: "28ch",
};

function LensChip({
  name,
  philosophy,
  selected,
  compact,
  dark,
  disabled,
  onClick,
}: {
  name: string;
  philosophy: string;
  selected: boolean;
  compact?: boolean;
  dark?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const mutedColor = dark ? "#9a9da6" : "var(--bow-slate)";
  const inkColor = dark ? "#fff" : "var(--bow-ink)";
  const accent = dark ? "#6f8bff" : "var(--bow-blue)";
  const idleBorder = dark ? "var(--bow-dark-border)" : "var(--border-rule)";

  const style: CSSProperties = {
    ...chipBase,
    ...(compact ? compactChipStyle : null),
    borderColor: selected ? accent : idleBorder,
    color: selected ? inkColor : mutedColor,
    cursor: disabled ? "default" : "pointer",
  };

  return (
    <button type="button" role="radio" aria-checked={selected} disabled={disabled} onClick={onClick} style={style}>
      <span style={{ ...nameStyle, color: selected ? accent : "inherit" }}>{name}</span>
      {!compact && selected && <p style={{ ...philosophyStyle, color: mutedColor }}>{philosophy}</p>}
    </button>
  );
}

/**
 * The reader's worldview picker. `compact` collapses each chip to a
 * name-only pill in one row for tight spots (e.g. above the slider
 * panel); the full rail shows the philosophy line under whichever chip
 * is currently selected.
 */
export default function LensSwitcher({ dark, compact }: LensSwitcherProps) {
  const { lensId, setLens } = useLens();

  return (
    <div role="radiogroup" aria-label="Worldview" style={compact ? compactRailStyle : railStyle}>
      {PRESET_LENSES.map((lens) => (
        <LensChip
          key={lens.id}
          name={lens.name}
          philosophy={lens.philosophy}
          selected={lensId === lens.id}
          compact={compact}
          dark={dark}
          onClick={() => setLens(lens.id)}
        />
      ))}
      {lensId === CUSTOM_LENS_ID && (
        <LensChip
          name="My lens"
          philosophy="Hand-tuned — move any slider and this is where you live."
          selected
          compact={compact}
          dark={dark}
          disabled
          onClick={() => {}}
        />
      )}
    </div>
  );
}
