"use client";

import Link from "next/link";
import type { CareerMapSectionView, CareerMapNodeView } from "@/lib/learn/home";

/**
 * Vertical department floors — the comp chosen after the 3-treatment
 * exercise (docs/learn/stage7-progression.md): each learn_map_section is a
 * franchise "department floor" (theme-colored header), nodes stack
 * top-to-bottom in sort order inside it. Chosen over horizontal season-lane
 * (poor at 390px — forces sideways scroll for a primary surface) and
 * card-grid-with-dividers (obscures linear progression order, the thing
 * students most need to read at a glance).
 */

const STATE_STYLES: Record<CareerMapNodeView["state"], { bg: string; border: string; label: string }> = {
  locked: { bg: "var(--surface-page)", border: "var(--border-rule)", label: "Locked" },
  available: { bg: "var(--surface-page)", border: "var(--bow-orange)", label: "Available" },
  in_progress: { bg: "var(--bow-orange-tint, #ffe6e0)", border: "var(--bow-orange)", label: "In Progress" },
  completed: { bg: "var(--surface-page)", border: "var(--bow-positive, #3aa76d)", label: "Completed" },
};

const KIND_ICON: Record<CareerMapNodeView["kind"], string> = {
  lesson: "📘",
  bonus_challenge: "⭐",
  checkpoint: "🚩",
  reward: "🎁",
};

function Stars({ count }: { count: number }) {
  return (
    <span aria-label={`${count} of 3 stars`} style={{ letterSpacing: 1 }}>
      {"★★★".split("").map((_, i) => (
        <span key={i} style={{ color: i < count ? "var(--bow-orange)" : "var(--border-rule)" }}>★</span>
      ))}
    </span>
  );
}

function NodeCard({ node }: { node: CareerMapNodeView }) {
  const style = STATE_STYLES[node.state];
  const isPlayable = node.state === "available" || node.state === "in_progress";
  const body = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: style.bg,
        border: `1.5px solid ${style.border}`,
        borderRadius: 12,
        padding: "12px 14px",
        opacity: node.state === "locked" ? 0.7 : 1,
        cursor: isPlayable ? "pointer" : "default",
      }}
    >
      <span style={{ fontSize: 22, flexShrink: 0 }} aria-hidden>
        {node.state === "locked" ? "🔒" : KIND_ICON[node.kind]}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "var(--font-interface)", fontWeight: 700, fontSize: 14.5, color: "var(--text-primary)" }}>
          {node.title}
        </div>
        {node.state === "locked" && node.lockReason && (
          <div style={{ fontFamily: "var(--font-data)", fontSize: 11.5, color: "var(--text-secondary, var(--bow-slate))", marginTop: 2 }}>
            {node.lockReason}
          </div>
        )}
        {node.state === "completed" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
            <Stars count={node.bestStars ?? 0} />
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11.5, color: "var(--text-secondary, var(--bow-slate))" }}>
              Best {node.bestScore}%
            </span>
          </div>
        )}
        {node.estMinutes != null && node.state !== "completed" && (
          <div style={{ fontFamily: "var(--font-data)", fontSize: 11.5, color: "var(--text-secondary, var(--bow-slate))", marginTop: 2 }}>
            ~{node.estMinutes} min
          </div>
        )}
      </div>
    </div>
  );

  if (isPlayable && node.lessonId) {
    return (
      <Link href={`/dashboard/lesson/${node.lessonId}`} style={{ textDecoration: "none" }}>
        {body}
      </Link>
    );
  }
  return body;
}

export default function CareerMap({ sections }: { sections: CareerMapSectionView[] }) {
  if (sections.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "var(--bow-slate)", fontFamily: "var(--font-interface)" }}>
        The career map isn&apos;t set up yet — check back soon.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {sections.map((section) => {
        const themeColor = (section.theme?.color as string) || "var(--bow-orange)";
        return (
          <div key={section.id}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                borderLeft: `4px solid ${themeColor}`,
                paddingLeft: 12,
                marginBottom: 10,
              }}
            >
              <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(18px,2.6vw,24px)", textTransform: "uppercase", color: "var(--text-primary)" }}>
                {section.title}
              </h3>
              {section.subtitle && (
                <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)" }}>{section.subtitle}</span>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {section.nodes.map((node) => (
                <NodeCard key={node.id} node={node} />
              ))}
              {section.nodes.length === 0 && (
                <div style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)", padding: "4px 0" }}>No lessons in this department yet.</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
