"use client";

/* ============================================================
 * components/learn/player/blocks/ContentBlock.tsx — content-category blocks.
 *
 * Covers text/heading/callout (Stage 2's required content renderer) plus
 * stat/comparison/image, which share the same "no response, just Continue"
 * shape and are cheap to support here rather than crashing the player on a
 * doc that happens to use them.
 * ============================================================ */

import type { CSSProperties } from "react";
import type { Block } from "@/lib/learn/types";
import type { BlockPlayerProps } from "../types";

const toneStyle: Record<string, CSSProperties> = {
  positive: { borderColor: "var(--bow-positive)", background: "rgba(50,140,90,0.08)" },
  warning: { borderColor: "var(--bow-warning)", background: "rgba(180,130,20,0.08)" },
  negative: { borderColor: "var(--bow-negative)", background: "rgba(180,40,40,0.08)" },
  info: { borderColor: "var(--bow-blue)", background: "rgba(30,90,180,0.08)" },
};

function resolveDisplayValue(value: unknown): string {
  if (typeof value === "object" && value !== null && "kind" in (value as Record<string, unknown>)) {
    return ""; // unresolved Ref — Stage 2 player doesn't bind live variable refs into content blocks yet
  }
  return String(value);
}

export default function ContentBlock({ block }: BlockPlayerProps) {
  switch (block.type) {
    case "text":
      return (
        <p style={{ fontFamily: "var(--font-body)", fontSize: 16, lineHeight: 1.6, color: "var(--text-primary)" }}>
          {block.body}
        </p>
      );

    case "heading": {
      const Tag = (`h${block.level}` as unknown) as "h1" | "h2" | "h3";
      return (
        <Tag
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            letterSpacing: "0.01em",
            color: "var(--text-primary)",
            margin: 0,
          }}
        >
          {block.text}
        </Tag>
      );
    }

    case "callout":
      return (
        <div
          role="note"
          style={{
            border: "1px solid",
            borderRadius: 4,
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            ...(toneStyle[block.tone] ?? toneStyle.info),
          }}
        >
          {block.title && (
            <strong style={{ fontFamily: "var(--font-display)", fontSize: 13, letterSpacing: "0.04em", textTransform: "uppercase" }}>
              {block.title}
            </strong>
          )}
          <span style={{ fontFamily: "var(--font-body)", fontSize: 15, lineHeight: 1.55 }}>{block.body}</span>
        </div>
      );

    case "stat":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
            {block.label}
          </span>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 28 }}>
            {resolveDisplayValue(block.value)}
          </span>
        </div>
      );

    case "comparison":
      return (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(block.items.length, 3)}, 1fr)`, gap: 12 }}>
          {block.items.map((item, i) => (
            <div key={i} style={{ border: "1px solid var(--border-rule)", borderRadius: 4, padding: 12 }}>
              <div style={{ fontSize: 12, color: "var(--bow-slate)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{item.label}</div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20 }}>{resolveDisplayValue(item.value)}</div>
              {item.note && <div style={{ fontSize: 13, color: "var(--bow-slate)", marginTop: 4 }}>{item.note}</div>}
            </div>
          ))}
        </div>
      );

    case "image":
      return (
        <figure style={{ margin: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={block.src} alt={block.alt} style={{ maxWidth: "100%", borderRadius: 4, display: "block" }} />
          {block.caption && (
            <figcaption style={{ fontSize: 13, color: "var(--bow-slate)", marginTop: 6 }}>{block.caption}</figcaption>
          )}
        </figure>
      );

    case "table":
      return (
        <figure style={{ margin: 0, overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 14 }}>
            <thead>
              <tr>
                {block.columns.map((col) => (
                  <th key={col.key} style={{ textAlign: "left", padding: "6px 10px", borderBottom: "1px solid var(--border-rule)", color: "var(--bow-slate)" }}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i}>
                  {block.columns.map((col) => (
                    <td key={col.key} style={{ padding: "6px 10px", borderBottom: "1px solid var(--border-rule)" }}>
                      {row[col.key] ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {block.caption && <figcaption style={{ fontSize: 13, color: "var(--bow-slate)", marginTop: 6 }}>{block.caption}</figcaption>}
        </figure>
      );

    case "chart":
      return <ChartSvg block={block} />;

    case "timeline":
      return (
        <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 14 }}>
          {block.events.map((event, i) => (
            <li key={i} style={{ display: "flex", gap: 12, borderLeft: "2px solid var(--bow-blue)", paddingLeft: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: "var(--bow-slate)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{event.when}</div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15 }}>{event.label}</div>
                {event.description && <div style={{ fontSize: 13, color: "var(--bow-slate)", marginTop: 2 }}>{event.description}</div>}
              </div>
            </li>
          ))}
        </ol>
      );

    default:
      return null;
  }
}

/** Simple SVG bar/line chart bound to static data — no chart library, per BOW dataviz restraint. */
function ChartSvg({ block }: { block: Extract<Block, { type: "chart" }> }) {
  const width = 400;
  const height = 200;
  const padding = 24;
  const points = block.series.map((s) => (typeof s.value === "number" ? s.value : 0));
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;

  return (
    <figure style={{ margin: 0 }}>
      {block.title && (
        <figcaption style={{ fontSize: 13, color: "var(--bow-slate)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {block.title}
        </figcaption>
      )}
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ maxWidth: width, display: "block" }} role="img" aria-label={block.title ?? "Chart"}>
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="var(--border-rule)" />
        {block.chartKind === "bar" &&
          block.series.map((s, i) => {
            const v = typeof s.value === "number" ? s.value : 0;
            const barWidth = (width - padding * 2) / block.series.length - 10;
            const barHeight = ((v - min) / range) * (height - padding * 2);
            const x = padding + i * ((width - padding * 2) / block.series.length) + 5;
            const y = height - padding - barHeight;
            return (
              <g key={i}>
                <rect x={x} y={y} width={barWidth} height={barHeight} fill="var(--bow-blue)" rx={2} />
                <text x={x + barWidth / 2} y={height - padding + 14} textAnchor="middle" fontSize={10} fill="var(--bow-slate)">
                  {s.label}
                </text>
              </g>
            );
          })}
        {block.chartKind === "line" && (
          <polyline
            fill="none"
            stroke="var(--bow-blue)"
            strokeWidth={2}
            points={block.series
              .map((s, i) => {
                const v = typeof s.value === "number" ? s.value : 0;
                const x = padding + i * ((width - padding * 2) / Math.max(block.series.length - 1, 1));
                const y = height - padding - ((v - min) / range) * (height - padding * 2);
                return `${x},${y}`;
              })
              .join(" ")}
          />
        )}
      </svg>
    </figure>
  );
}

export function isContentBlock(block: Block): boolean {
  return ["text", "heading", "callout", "stat", "comparison", "image", "table", "chart", "timeline"].includes(block.type);
}
