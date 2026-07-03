"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fmtMillions } from "@/lib/aasv";

/**
 * CapStackBar — a single horizontal bar of stacked rectangles, one per
 * contract, width proportional to value. It's the team-page cousin of
 * CapLine's "thick rule with a sharp step" motif: no rounded corners,
 * no gradients, just hard-edged blocks a reader can scan left to right
 * and click into. Built as raw SVG (no chart lib) to match the rest of
 * /analytics.
 */

export interface CapStackSegment {
  slug: string;
  label: string;
  value: number;
  color: string;
}

export default function CapStackBar({
  segments,
  total,
  height = 56,
}: {
  segments: CapStackSegment[];
  /** Denominator for widths; defaults to the sum of segment values. */
  total?: number;
  height?: number;
}) {
  const router = useRouter();
  const [hover, setHover] = useState<number | null>(null);

  const W = 720;
  const H = height;

  const { blocks, denom } = useMemo(() => {
    const sum = segments.reduce((s, seg) => s + Math.max(0, seg.value), 0);
    const denom = total ?? sum;
    let x = 0;
    const blocks = segments.map((seg) => {
      const w = denom > 0 ? (Math.max(0, seg.value) / denom) * W : 0;
      const block = { seg, x, w };
      x += w;
      return block;
    });
    return { blocks, denom };
  }, [segments, total]);

  const open = (slug: string) => router.push(`/analytics/players/${slug}`);
  const hovered = hover != null ? blocks[hover] : null;

  if (segments.length === 0 || denom <= 0) {
    return (
      <p style={{ fontFamily: "var(--font-interface)", fontSize: 13, color: "var(--bow-slate)" }}>
        No tracked cap hits to chart.
      </p>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}
        role="img"
        aria-label="Stacked bar of tracked cap hits by player, widest to smallest. Each block opens that player's breakdown."
      >
        {blocks.map((b, i) => (
          <rect
            key={b.seg.slug}
            x={b.x}
            y={0}
            width={Math.max(b.w, 0.5)}
            height={H}
            fill={b.seg.color}
            stroke="var(--bow-white)"
            strokeWidth={b.w > 4 ? 2 : 0}
            tabIndex={0}
            role="link"
            aria-label={`${b.seg.label}, ${fmtMillions(b.seg.value)}. Open player breakdown.`}
            style={{ cursor: "pointer", outlineColor: "var(--bow-blue)" }}
            onClick={() => open(b.seg.slug)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") open(b.seg.slug);
            }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover((h) => (h === i ? null : h))}
            onFocus={() => setHover(i)}
            onBlur={() => setHover((h) => (h === i ? null : h))}
          />
        ))}
      </svg>

      {hovered && (
        <div
          style={{
            position: "absolute",
            left: `${Math.min(96, (hovered.x + hovered.w / 2) / W * 100)}%`,
            top: H + 8,
            transform: "translateX(-50%)",
            background: "var(--bow-ink)",
            color: "#fff",
            padding: "6px 10px",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            zIndex: 5,
            border: "1px solid var(--bow-dark-border)",
            fontFamily: "var(--font-data)",
            fontSize: 12,
          }}
        >
          <strong style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>{hovered.seg.label}</strong>
          {"  ·  "}
          {fmtMillions(hovered.seg.value)}
        </div>
      )}
    </div>
  );
}
