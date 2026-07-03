"use client";

import { useId, useState } from "react";
import {
  ASSUMPTION_BOUNDS,
  DEFAULT_ASSUMPTIONS,
  fmtMillions,
  type Assumptions,
} from "@/lib/aasv";

interface SliderRowProps {
  label: string;
  detail: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}

function SliderRow({ label, detail, value, min, max, step, format, onChange }: SliderRowProps) {
  const id = useId();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <label
          htmlFor={id}
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "var(--bow-ink)",
          }}
        >
          {label}
        </label>
        <span style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: 14, color: "var(--bow-blue)", fontVariantNumeric: "tabular-nums" }}>
          {format(value)}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "var(--bow-blue)", cursor: "pointer" }}
      />
      <span style={{ fontFamily: "var(--font-interface)", fontSize: 12, lineHeight: 1.45, color: "var(--bow-slate)" }}>{detail}</span>
    </div>
  );
}

/**
 * The model's control surface. Every assumption AASV uses is a slider
 * here — the point of the metric is that it reflects YOUR judgment of
 * what wins cost and how much the aprons hurt, not our defaults.
 */
export default function SliderPanel({
  assumptions,
  onChange,
  onReset,
}: {
  assumptions: Assumptions;
  onChange: (a: Assumptions) => void;
  onReset: () => void;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const a = assumptions;
  const b = ASSUMPTION_BOUNDS;
  const isDefault = JSON.stringify(a) === JSON.stringify(DEFAULT_ASSUMPTIONS);

  return (
    <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", padding: "clamp(18px,2.4vw,26px)" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
          Model Assumptions
        </span>
        {!isDefault && (
          <button
            type="button"
            onClick={onReset}
            style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--bow-blue)", padding: 0 }}
          >
            Reset to defaults
          </button>
        )}
      </div>
      <p style={{ margin: "0 0 18px", fontFamily: "var(--font-interface)", fontSize: 13, lineHeight: 1.5, color: "var(--bow-slate)" }}>
        AASV = wins × $/win − cap hit × apron multiplier. Set the knobs to your own front-office judgment — every number on this page updates live.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <SliderRow
          label="Price of a win"
          detail="What one marginal win costs on the open market."
          value={a.dollarsPerWin}
          min={b.dollarsPerWin.min}
          max={b.dollarsPerWin.max}
          step={b.dollarsPerWin.step}
          format={fmtMillions}
          onChange={(v) => onChange({ ...a, dollarsPerWin: v })}
        />
        <SliderRow
          label="First-apron multiplier"
          detail="How much a first-apron team's dollar really costs (tax bill, shrinking roster tools)."
          value={a.apronMultipliers.first}
          min={b.apronFirst.min}
          max={b.apronFirst.max}
          step={b.apronFirst.step}
          format={(v) => `${v.toFixed(2)}×`}
          onChange={(v) => onChange({ ...a, apronMultipliers: { ...a.apronMultipliers, first: v } })}
        />
        <SliderRow
          label="Second-apron multiplier"
          detail="The punitive tier — frozen picks, no salary aggregation, repeater tax."
          value={a.apronMultipliers.second}
          min={b.apronSecond.min}
          max={b.apronSecond.max}
          step={b.apronSecond.step}
          format={(v) => `${v.toFixed(2)}×`}
          onChange={(v) => onChange({ ...a, apronMultipliers: { ...a.apronMultipliers, second: v } })}
        />
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        aria-expanded={showAdvanced}
        style={{
          marginTop: 18,
          background: "none",
          border: "none",
          borderTop: "1px solid var(--border-rule)",
          width: "100%",
          textAlign: "left",
          padding: "12px 0 0",
          cursor: "pointer",
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: 12,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--bow-slate)",
        }}
      >
        {showAdvanced ? "− Hide" : "+ Show"} advanced assumptions
      </button>

      {showAdvanced && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 14 }}>
          <SliderRow
            label="Below-apron multiplier"
            detail="Usually 1.0× — a non-apron dollar is just a dollar. Raise it if you think all spending carries hidden cost."
            value={a.apronMultipliers.below}
            min={b.apronBelow.min}
            max={b.apronBelow.max}
            step={b.apronBelow.step}
            format={(v) => `${v.toFixed(2)}×`}
            onChange={(v) => onChange({ ...a, apronMultipliers: { ...a.apronMultipliers, below: v } })}
          />
          <SliderRow
            label="Replacement level"
            detail="Impact (per 100 possessions) of a freely available player. Production is credited above this line."
            value={a.replacementLevel}
            min={b.replacementLevel.min}
            max={b.replacementLevel.max}
            step={b.replacementLevel.step}
            format={(v) => v.toFixed(1)}
            onChange={(v) => onChange({ ...a, replacementLevel: v })}
          />
          <SliderRow
            label="Points per win"
            detail="Season-long net points that buy one marginal win (~30.5 historically)."
            value={a.pointsPerWin}
            min={b.pointsPerWin.min}
            max={b.pointsPerWin.max}
            step={b.pointsPerWin.step}
            format={(v) => v.toFixed(1)}
            onChange={(v) => onChange({ ...a, pointsPerWin: v })}
          />
        </div>
      )}
    </div>
  );
}
