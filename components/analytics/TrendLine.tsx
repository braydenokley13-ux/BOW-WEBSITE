"use client";

import { useMemo, useRef, useState } from "react";
import type { SeasonStat } from "@/lib/nba";

/**
 * Multi-season trend line — hand-rolled inline SVG, following ValueScatter's
 * conventions (manual scale fns, hairline gridlines, IBM Plex Mono-style
 * data labels via --font-data). Plots one metric across a player's cached
 * seasons with a PER-POINT fallback: a season missing the preferred metric
 * still plots off the other one (hollow marker), and only a season with
 * neither metric on file breaks the line — never interpolated across.
 */

const METRIC_LABEL: Record<"epm" | "bpm", string> = {
  epm: "EPM (estimated plus-minus)",
  bpm: "BPM (box plus-minus)",
};

interface PlottedPoint {
  season: string;
  value: number;
  source: "epm" | "bpm";
  cx: number;
  cy: number;
}

const num = (v: number) => v.toFixed(1);

export default function TrendLine({
  history,
  metric = "epm",
  height = 220,
  sparkline = false,
  title,
}: {
  history: SeasonStat[];
  metric?: "epm" | "bpm";
  height?: number;
  sparkline?: boolean;
  title?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [pointer, setPointer] = useState<{ px: number; py: number; flip: boolean } | null>(null);

  const W = sparkline ? 160 : 560;
  const H = sparkline ? 28 : height;
  const M = sparkline ? { top: 3, right: 3, bottom: 3, left: 3 } : { top: 14, right: 16, bottom: 28, left: 38 };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;

  const { points, domainMin, domainMax, anyBpm } = useMemo(() => {
    // Per-point fallback: preferred metric first, other metric second,
    // skip (null) only when neither is on file for that season.
    const raw = history.map((h) => {
      const other: "epm" | "bpm" = metric === "epm" ? "bpm" : "epm";
      const preferred = h[metric];
      const fallback = h[other];
      if (preferred != null) return { season: h.season, value: preferred, source: metric };
      if (fallback != null) return { season: h.season, value: fallback, source: other };
      return { season: h.season, value: null as number | null, source: metric };
    });
    const values = raw.map((r) => r.value).filter((v): v is number => v != null);
    const lo = values.length ? Math.min(0, ...values) : 0;
    const hi = values.length ? Math.max(1, ...values) : 1;
    const pad = (hi - lo) * 0.15 || 1;
    const domainMin = lo - pad;
    const domainMax = hi + pad;
    const sx = (i: number) => M.left + (history.length <= 1 ? plotW / 2 : (i / (history.length - 1)) * plotW);
    const sy = (v: number) => M.top + plotH - ((v - domainMin) / (domainMax - domainMin)) * plotH;
    const points: (PlottedPoint | null)[] = raw.map((r, i) =>
      r.value == null ? null : { season: r.season, value: r.value, source: r.source, cx: sx(i), cy: sy(r.value) },
    );
    return { points, domainMin, domainMax, anyBpm: values.length > 0 && raw.some((r) => r.value != null && r.source !== metric) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, metric, plotW, plotH]);

  // Contiguous runs of plotted points — a null (neither metric on file)
  // breaks the line rather than being interpolated across.
  const segments = useMemo(() => {
    const segs: PlottedPoint[][] = [];
    let current: PlottedPoint[] = [];
    for (const p of points) {
      if (p == null) {
        if (current.length) segs.push(current);
        current = [];
      } else {
        current.push(p);
      }
    }
    if (current.length) segs.push(current);
    return segs;
  }, [points]);

  const valid = points.filter((p): p is PlottedPoint => p != null);
  const yTicks = [domainMin, (domainMin + domainMax) / 2, domainMax];

  const ariaLabel = useMemo(() => {
    if (valid.length === 0) return `${METRIC_LABEL[metric]} trend — no seasons on file.`;
    const first = valid[0];
    const last = valid[valid.length - 1];
    const delta = last.value - first.value;
    const dir = delta > 0.05 ? "up" : delta < -0.05 ? "down" : "flat";
    const prefix = title ? `${title}: ` : "";
    return `${prefix}${METRIC_LABEL[metric]} across ${valid.length} season${valid.length === 1 ? "" : "s"}: ${first.season} ${num(first.value)} to ${last.season} ${num(last.value)}, ${dir} ${num(Math.abs(delta))}.`;
  }, [valid, metric, title]);

  const scaleFor = (el: HTMLDivElement) => W / el.getBoundingClientRect().width;

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const wrap = wrapRef.current;
    if (!wrap || valid.length === 0) return;
    const rect = wrap.getBoundingClientRect();
    const k = scaleFor(wrap);
    const mx = (e.clientX - rect.left) * k;
    let best = -1;
    let bestDist = Infinity;
    points.forEach((d, i) => {
      if (!d) return;
      const dist = Math.abs(d.cx - mx);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    if (best >= 0 && bestDist <= 40) {
      const d = points[best]!;
      setHover(best);
      setPointer({ px: d.cx / k, py: d.cy / k, flip: d.cx > W * 0.68 });
    } else {
      setHover(null);
      setPointer(null);
    }
  };

  if (sparkline) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, display: "block" }} aria-hidden>
        {segments.map((seg, i) => (
          <polyline
            key={i}
            points={seg.map((p) => `${p.cx},${p.cy}`).join(" ")}
            fill="none"
            stroke="var(--bow-blue)"
            strokeWidth={1.5}
          />
        ))}
        {valid.map((p) => (
          <circle
            key={p.season}
            cx={p.cx}
            cy={p.cy}
            r={2}
            fill={p.source === metric ? "var(--bow-blue)" : "var(--bow-white)"}
            stroke="var(--bow-blue)"
            strokeWidth={1.2}
          />
        ))}
      </svg>
    );
  }

  const hovered = hover != null ? points[hover] : null;

  return (
    <div>
      {title && (
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-blue)" }}>
          {title}
        </span>
      )}

      <div ref={wrapRef} style={{ position: "relative", marginTop: title ? 10 : 0 }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: "100%", height: "auto", display: "block" }}
          role="img"
          aria-label={ariaLabel}
          onMouseMove={handleMove}
          onMouseLeave={() => {
            setHover(null);
            setPointer(null);
          }}
        >
          {/* gridlines — solid hairlines, one step off the surface */}
          {yTicks.map((t, i) => {
            const y = M.top + plotH - ((t - domainMin) / (domainMax - domainMin)) * plotH;
            return (
              <g key={i}>
                <line x1={M.left} y1={y} x2={M.left + plotW} y2={y} stroke="#eceae4" strokeWidth={1} />
                <text x={M.left - 8} y={y + 4} textAnchor="end" style={{ fontFamily: "var(--font-data)", fontSize: 10.5, fill: "var(--bow-slate)" }}>
                  {num(t)}
                </text>
              </g>
            );
          })}

          {/* axes */}
          <line x1={M.left} y1={M.top + plotH} x2={M.left + plotW} y2={M.top + plotH} stroke="var(--border-rule)" strokeWidth={1} />
          <line x1={M.left} y1={M.top} x2={M.left} y2={M.top + plotH} stroke="var(--border-rule)" strokeWidth={1} />

          {/* season ticks */}
          {history.map((h, i) => {
            const x = M.left + (history.length <= 1 ? plotW / 2 : (i / (history.length - 1)) * plotW);
            return (
              <text key={h.season} x={x} y={M.top + plotH + 18} textAnchor="middle" style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.03em", fill: "var(--bow-slate)" }}>
                {h.season}
              </text>
            );
          })}

          {/* line segments — a gap in the data breaks the line, never interpolated */}
          {segments.map((seg, i) => (
            <polyline
              key={i}
              points={seg.map((p) => `${p.cx},${p.cy}`).join(" ")}
              fill="none"
              stroke="var(--bow-blue)"
              strokeWidth={2}
            />
          ))}

          {/* points — filled when metric-sourced, hollow when fallback-sourced */}
          {valid.map((p) => {
            const idx = points.indexOf(p);
            return (
              <circle
                key={p.season}
                cx={p.cx}
                cy={p.cy}
                r={hover === idx ? 6 : 4.5}
                fill={p.source === metric ? "var(--bow-blue)" : "var(--bow-white)"}
                stroke="var(--bow-blue)"
                strokeWidth={2}
                style={{ cursor: "default" }}
              />
            );
          })}
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
              padding: "8px 10px",
              minWidth: 140,
              pointerEvents: "none",
              zIndex: 5,
              border: "1px solid var(--bow-dark-border)",
            }}
          >
            <div style={{ fontFamily: "var(--font-data)", fontWeight: 700, fontSize: 12.5, letterSpacing: "0.04em" }}>{hovered.season}</div>
            <div style={{ fontFamily: "var(--font-data)", fontSize: 11.5, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
              {hovered.source.toUpperCase()} {num(hovered.value)}
            </div>
          </div>
        )}
      </div>

      {anyBpm && (
        <p style={{ margin: "8px 0 0", display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.02em", color: "var(--bow-slate)" }}>
          <span aria-hidden style={{ display: "inline-block", width: 8, height: 8, borderRadius: 999, background: "var(--bow-white)", border: "2px solid var(--bow-blue)" }} />
          Hollow marker = {METRIC_LABEL[metric === "epm" ? "bpm" : "epm"]} fallback — no{" "}
          {METRIC_LABEL[metric].split(" ")[0]} on file that season.
        </p>
      )}
    </div>
  );
}
