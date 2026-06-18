"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import Eyebrow from "./Eyebrow";

interface StoryCardProps {
  category?: string;
  categoryColor?: "blue" | "orange" | "positive" | "slate" | "inherit";
  image?: string;
  headline: string;
  deck?: string;
  byline?: string;
  meta?: string;
  size?: "default" | "lead" | "compact";
  href?: string;
  style?: CSSProperties;
}

/** StoryCard — the editorial workhorse. Eyebrow, image, serif headline, deck, byline. */
export default function StoryCard({
  category,
  categoryColor = "blue",
  image,
  headline,
  deck,
  byline,
  meta,
  size = "default",
  href = "#",
  style,
}: StoryCardProps) {
  const isLead = size === "lead";
  const isCompact = size === "compact";
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        flexDirection: isLead ? "column" : isCompact ? "row" : "column",
        gap: isLead ? 20 : 16,
        textDecoration: "none",
        color: "var(--text-primary)",
        transition: "opacity var(--dur-hover) var(--ease-out)",
        ...style,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.86")}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
    >
      {image && (
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            flex: isCompact ? "0 0 132px" : "none",
            aspectRatio: isLead ? "16 / 9" : isCompact ? "1 / 1" : "3 / 2",
            background: "var(--bow-border)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transition: "transform var(--dur-card) var(--ease-out)" }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.04)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          />
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: isLead ? 14 : 8, minWidth: 0 }}>
        {category && <Eyebrow color={categoryColor}>{category}</Eyebrow>}
        <h3
          style={{
            margin: 0,
            fontFamily: "var(--font-editorial)",
            fontWeight: 600,
            letterSpacing: "-0.005em",
            fontSize: isLead ? "var(--type-lead)" : isCompact ? 19 : "var(--type-card)",
            lineHeight: isLead ? "var(--lh-lead)" : "var(--lh-card)",
            textWrap: "balance",
          }}
        >
          {headline}
        </h3>
        {deck && !isCompact && (
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-interface)",
              fontSize: isLead ? "var(--type-body-lead)" : 16,
              lineHeight: 1.5,
              color: "var(--text-secondary)",
              textWrap: "pretty",
            }}
          >
            {deck}
          </p>
        )}
        {(byline || meta) && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 2,
              fontFamily: "var(--font-data)",
              fontSize: 12,
              letterSpacing: "0.02em",
              color: "var(--text-secondary)",
            }}
          >
            {byline && <span style={{ color: "var(--text-primary)" }}>{byline}</span>}
            {byline && meta && <span aria-hidden="true">·</span>}
            {meta && <span>{meta}</span>}
          </div>
        )}
      </div>
    </Link>
  );
}
