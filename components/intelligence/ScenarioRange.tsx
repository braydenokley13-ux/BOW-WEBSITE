import { fmtSignedMillions } from "@/lib/aasv";
import type { ScenarioBand } from "@/lib/intelligence-types";

interface ScenarioRangeProps {
  band: ScenarioBand;
  label?: string;
}

function pct(v: number, min: number, max: number): number {
  if (max === min) return 50;
  return ((v - min) / (max - min)) * 100;
}

const MARKERS = [
  { key: "bear" as const, name: "Bear", color: "var(--bow-negative)" },
  { key: "base" as const, name: "Base", color: "var(--bow-blue)" },
  { key: "bull" as const, name: "Bull", color: "var(--bow-positive)" },
];

/**
 * ScenarioRange — bear / base / bull AASV rendered as a horizontal min→max
 * range strip with the three markers, plus a caution line when the verdict
 * flips somewhere across the band.
 */
export default function ScenarioRange({ band, label = "Scenario sensitivity" }: ScenarioRangeProps) {
  const values = { bear: band.bear.aasv, base: band.base.aasv, bull: band.bull.aasv };
  const min = Math.min(values.bear, values.base, values.bull);
  const max = Math.max(values.bear, values.base, values.bull);
  const zeroPct = min < 0 && max > 0 ? pct(0, min, max) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontWeight: 600,
            fontSize: 12,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--bow-slate)",
          }}
        >
          {label}
        </span>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 12, fontVariantNumeric: "tabular-nums", color: "var(--bow-slate)" }}>
          {fmtSignedMillions(min)} &rarr; {fmtSignedMillions(max)}
        </span>
      </div>

      <div
        role="img"
        aria-label={`Scenario range: bear ${fmtSignedMillions(values.bear)}, base ${fmtSignedMillions(values.base)}, bull ${fmtSignedMillions(values.bull)}`}
        style={{ position: "relative", height: 6, background: "var(--bow-border)", margin: "22px 6px 0" }}
      >
        {zeroPct != null && (
          <div
            aria-hidden="true"
            style={{ position: "absolute", left: `${zeroPct}%`, top: -8, bottom: -8, width: 1, background: "var(--bow-ink)", opacity: 0.35 }}
          />
        )}
        {MARKERS.map((m) => (
          <div
            key={m.key}
            aria-hidden="true"
            style={{ position: "absolute", left: `${pct(values[m.key], min, max)}%`, top: "50%", transform: "translate(-50%, -50%)" }}
          >
            <div style={{ width: 13, height: 13, borderRadius: 999, background: m.color, border: "2px solid var(--bow-white)", boxShadow: "0 0 0 1px var(--border-rule)" }} />
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        {MARKERS.map((m) => (
          <div key={m.key} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                fontSize: 11,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: m.color,
              }}
            >
              {m.name}
            </span>
            <span style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: 16, fontVariantNumeric: "tabular-nums", color: "var(--bow-ink)" }}>
              {fmtSignedMillions(values[m.key])}
            </span>
          </div>
        ))}
      </div>

      {band.verdictFlips && (
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-interface)",
            fontSize: 13,
            lineHeight: 1.5,
            color: "var(--bow-warning-text)",
            borderLeft: "3px solid var(--bow-warning)",
            paddingLeft: 10,
          }}
        >
          Caution — the verdict flips somewhere across bear/base/bull assumptions. This call is assumption-sensitive, not settled.
        </p>
      )}
    </div>
  );
}
