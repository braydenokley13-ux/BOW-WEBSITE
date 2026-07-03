"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  APRON_COLORS,
  APRON_LABELS,
  fmtMillions,
  fmtSignedMillions,
  valuate,
  type AnalyticsPlayer,
  type ApronStatus,
  type Assumptions,
} from "@/lib/aasv";

/**
 * Value vs. contract scatter. X = true (apron-adjusted) contract cost,
 * Y = production value — both in dollars, so the y = x diagonal IS the
 * fair-value line: above it a player out-produces his true cost,
 * below it the contract eats the team alive.
 *
 * Encoding follows the dataviz method: apron tier carries color (the
 * palette is validated for CVD + contrast on white), a legend + text
 * labels back the color up, dots wear a 2px surface ring, gridlines
 * are solid hairlines, and only the extremes get direct labels. The
 * sortable table beside/below the chart is the accessible twin.
 */

interface Point {
  p: AnalyticsPlayer;
  x: number; // true cost $
  y: number; // production value $
  aasv: number;
  cx: number;
  cy: number;
}

const APRON_ORDER: ApronStatus[] = ["below", "first", "second"];

function niceCeil(v: number): number {
  if (v <= 0) return 20e6;
  const step = 20e6;
  return Math.ceil(v / step) * step;
}

export default function ValueScatter({
  players,
  assumptions,
  height = 460,
  labelCount = 3,
  title,
}: {
  players: AnalyticsPlayer[];
  assumptions: Assumptions;
  height?: number;
  /** How many top/bottom AASV extremes get direct name labels. */
  labelCount?: number;
  title?: string;
}) {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  // px/py are client pixels; flip mirrors the tooltip when the dot sits
  // in the right quarter of the plot (computed in the event, not render).
  const [pointer, setPointer] = useState<{ px: number; py: number; flip: boolean } | null>(null);

  const W = 720;
  const H = height;
  const M = { top: 18, right: 20, bottom: 46, left: 58 };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;

  const { points, max, ticks } = useMemo(() => {
    const valued = players.map((p) => {
      const v = valuate(p, assumptions);
      return { p, x: v.trueCost, y: v.productionValue, aasv: v.aasv };
    });
    const rawMax = Math.max(20e6, ...valued.map((d) => Math.max(d.x, d.y)));
    const max = niceCeil(rawMax * 1.05);
    const sx = (v: number) => M.left + (v / max) * plotW;
    const sy = (v: number) => M.top + plotH - (v / max) * plotH;
    const points: Point[] = valued.map((d) => ({ ...d, cx: sx(d.x), cy: sy(d.y) }));
    const tickStep = max > 120e6 ? 40e6 : 20e6;
    const ticks: number[] = [];
    for (let t = 0; t <= max; t += tickStep) ticks.push(t);
    return { points, max, ticks };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, assumptions, plotW, plotH]);

  // Direct labels: the biggest surpluses and biggest holes only.
  const labeled = useMemo(() => {
    const sorted = [...points].sort((a, b) => b.aasv - a.aasv);
    const chosen = new Set<string>();
    sorted.slice(0, labelCount).forEach((d) => chosen.add(d.p.slug));
    sorted.slice(-labelCount).forEach((d) => chosen.add(d.p.slug));
    return chosen;
  }, [points, labelCount]);

  const scaleFor = (el: HTMLDivElement) => W / el.getBoundingClientRect().width;

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const k = scaleFor(wrap);
    const mx = (e.clientX - rect.left) * k;
    const my = (e.clientY - rect.top) * k;
    let best = -1;
    let bestDist = Infinity;
    points.forEach((d, i) => {
      const dist = Math.hypot(d.cx - mx, d.cy - my);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    // Generous nearest-point radius (~24px hit area) instead of pinpoint dots.
    if (best >= 0 && bestDist <= 26) {
      setHover(best);
      setPointer({ px: points[best].cx / k, py: points[best].cy / k, flip: points[best].cx > W * 0.72 });
    } else {
      setHover(null);
      setPointer(null);
    }
  };

  const open = (slug: string) => router.push(`/analytics/players/${slug}`);
  const hovered = hover != null ? points[hover] : null;

  return (
    <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", padding: "clamp(16px,2vw,22px)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-blue)" }}>
          {title ?? "Production vs. true contract cost"}
        </span>
        {/* Legend — identity never rides on color alone */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
          {APRON_ORDER.map((s) => (
            <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
              <span aria-hidden style={{ width: 9, height: 9, borderRadius: 999, background: APRON_COLORS[s], border: "2px solid var(--bow-white)", boxShadow: "0 0 0 1px var(--border-rule)" }} />
              {APRON_LABELS[s]}
            </span>
          ))}
        </div>
      </div>

      <div ref={wrapRef} style={{ position: "relative" }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: "100%", height: "auto", display: "block" }}
          role="img"
          aria-label="Scatter plot of production value against apron-adjusted contract cost. Players above the diagonal fair-value line produce a surplus; players below it are overpaid. The table on this page carries the same data."
          onMouseMove={handleMove}
          onMouseLeave={() => {
            setHover(null);
            setPointer(null);
          }}
        >
          {/* gridlines — solid hairlines, one step off the surface */}
          {ticks.map((t) => {
            const x = M.left + (t / max) * plotW;
            const y = M.top + plotH - (t / max) * plotH;
            return (
              <g key={t}>
                <line x1={x} y1={M.top} x2={x} y2={M.top + plotH} stroke="#eceae4" strokeWidth={1} />
                <line x1={M.left} y1={y} x2={M.left + plotW} y2={y} stroke="#eceae4" strokeWidth={1} />
                <text x={x} y={M.top + plotH + 18} textAnchor="middle" style={{ fontFamily: "var(--font-data)", fontSize: 11, fill: "var(--bow-slate)" }}>
                  {t / 1e6}
                </text>
                <text x={M.left - 8} y={y + 4} textAnchor="end" style={{ fontFamily: "var(--font-data)", fontSize: 11, fill: "var(--bow-slate)" }}>
                  {t / 1e6}
                </text>
              </g>
            );
          })}

          {/* axes */}
          <line x1={M.left} y1={M.top + plotH} x2={M.left + plotW} y2={M.top + plotH} stroke="var(--border-rule)" strokeWidth={1} />
          <line x1={M.left} y1={M.top} x2={M.left} y2={M.top + plotH} stroke="var(--border-rule)" strokeWidth={1} />
          <text x={M.left + plotW / 2} y={H - 8} textAnchor="middle" style={{ fontFamily: "var(--font-data)", fontSize: 11.5, letterSpacing: "0.05em", fill: "var(--bow-ink)" }}>
            TRUE CONTRACT COST ($M, APRON-ADJUSTED)
          </text>
          <text x={14} y={M.top + plotH / 2} textAnchor="middle" transform={`rotate(-90 14 ${M.top + plotH / 2})`} style={{ fontFamily: "var(--font-data)", fontSize: 11.5, letterSpacing: "0.05em", fill: "var(--bow-ink)" }}>
            PRODUCTION VALUE ($M)
          </text>

          {/* fair-value diagonal — y = x in DATA space: (0,0) → (max,max) */}
          <line x1={M.left} y1={M.top + plotH} x2={M.left + plotW} y2={M.top} stroke="var(--bow-slate)" strokeWidth={1.5} />
          <text
            x={M.left + plotW * 0.85}
            y={M.top + plotH - plotH * 0.85 - 9}
            textAnchor="middle"
            style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.08em", fill: "var(--bow-slate)" }}
          >
            FAIR VALUE
          </text>
          <text x={M.left + 12} y={M.top + 16} style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.08em", fill: "#158a55" }}>
            ↑ SURPLUS
          </text>
          <text x={M.left + plotW - 12} y={M.top + plotH - 10} textAnchor="end" style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.08em", fill: "#d63b3b" }}>
            OVERPAID ↓
          </text>

          {/* dots — 2px surface ring, keyboard focusable, click → player page */}
          {points.map((d, i) => (
            <circle
              key={d.p.slug}
              cx={d.cx}
              cy={d.cy}
              r={hover === i ? 7 : 5.5}
              fill={APRON_COLORS[d.p.apronStatus]}
              stroke="var(--bow-white)"
              strokeWidth={2}
              tabIndex={0}
              role="link"
              aria-label={`${d.p.name}, ${d.p.team}. ${APRON_LABELS[d.p.apronStatus]}. True cost ${fmtMillions(d.x)}, production ${fmtMillions(d.y)}, surplus ${fmtSignedMillions(d.aasv)}. Open player breakdown.`}
              style={{ cursor: "pointer", outlineColor: "var(--bow-blue)" }}
              onClick={() => open(d.p.slug)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") open(d.p.slug);
              }}
              onFocus={() => {
                setHover(i);
                const wrap = wrapRef.current;
                if (wrap) {
                  const k = scaleFor(wrap);
                  setPointer({ px: d.cx / k, py: d.cy / k, flip: d.cx > W * 0.72 });
                }
              }}
              onBlur={() => {
                setHover(null);
                setPointer(null);
              }}
            />
          ))}

          {/* selective direct labels — extremes only, in text ink */}
          {points.map((d) =>
            labeled.has(d.p.slug) ? (
              <text
                key={`lbl-${d.p.slug}`}
                x={d.cx}
                y={d.cy - 10}
                textAnchor="middle"
                style={{ fontFamily: "var(--font-data)", fontSize: 10.5, fontWeight: 600, fill: "var(--bow-ink)", paintOrder: "stroke", stroke: "var(--bow-white)", strokeWidth: 3 }}
              >
                {d.p.name.split(" ").slice(-1)[0]}
              </text>
            ) : null,
          )}
        </svg>

        {/* tooltip */}
        {hovered && pointer && (
          <div
            style={{
              position: "absolute",
              left: pointer.px,
              top: pointer.py,
              transform: `translate(${pointer.flip ? "-104%" : "12px"}, -50%)`,
              background: "var(--bow-ink)",
              color: "#fff",
              padding: "10px 12px",
              minWidth: 180,
              pointerEvents: "none",
              zIndex: 5,
              border: "1px solid var(--bow-dark-border)",
            }}
          >
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, textTransform: "uppercase", letterSpacing: "0.03em" }}>
              {hovered.p.name}
            </div>
            <div style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9a9da6", margin: "2px 0 8px" }}>
              {hovered.p.team} · {APRON_LABELS[hovered.p.apronStatus]}
            </div>
            {[
              ["Cap hit", fmtMillions(hovered.p.capHit)],
              ["True cost", fmtMillions(hovered.x)],
              ["Production", fmtMillions(hovered.y)],
            ].map(([l, v]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", gap: 16, fontFamily: "var(--font-data)", fontSize: 12, lineHeight: 1.6 }}>
                <span style={{ color: "#9a9da6" }}>{l}</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{v}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, fontFamily: "var(--font-data)", fontSize: 12.5, fontWeight: 700, lineHeight: 1.8, borderTop: "1px solid var(--bow-dark-border)", marginTop: 4, paddingTop: 4 }}>
              <span style={{ color: "#9a9da6" }}>AASV</span>
              <span style={{ fontVariantNumeric: "tabular-nums", color: hovered.aasv >= 0 ? "#3ddc97" : "#ff7a6e" }}>
                {fmtSignedMillions(hovered.aasv)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
