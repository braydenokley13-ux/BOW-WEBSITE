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

    default:
      return null;
  }
}

export function isContentBlock(block: Block): boolean {
  return ["text", "heading", "callout", "stat", "comparison", "image"].includes(block.type);
}
