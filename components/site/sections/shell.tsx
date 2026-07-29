/* ============================================================
 * Section shell — the surface, container, and intro every section shares.
 *
 * This is the join between database content and the existing design system.
 * Sections carry words and a `tone`; this file maps `tone` onto the same
 * `bow-section-*` classes the hand-written pages already used, so a page moved
 * into the CMS renders identically to the one it replaced.
 *
 * Nothing here reads from the database and nothing takes free-form styling
 * from content — the founder cannot author a colour, a spacing value, or a
 * class name, only choose from the named surfaces below.
 * ============================================================ */

import type { CSSProperties, ReactNode } from "react";
import type { Tone } from "@/lib/cms/sections";

const SURFACE: Record<Tone, string> = {
  paper: "bow-section bow-section-paper",
  white: "bow-section",
  raised: "bow-section bow-section-raised",
  ink: "bow-section bow-section-ink bow-front-office",
  blue: "bow-section",
};

/** Blue is a campaign surface rather than a token class; it stays inline. */
const BLUE_STYLE: CSSProperties = {
  background: "var(--bow-blue)",
  color: "#fff",
  position: "relative",
  overflow: "hidden",
};

export function SectionSurface({
  tone,
  id,
  children,
  wide = false,
  ghostText,
}: {
  tone: Tone;
  id?: string;
  children: ReactNode;
  wide?: boolean;
  ghostText?: string;
}) {
  return (
    <section id={id} className={SURFACE[tone]} style={tone === "blue" ? BLUE_STYLE : undefined}>
      {ghostText ? (
        <div
          className={`bow-ghost bow-para-upbig${tone === "blue" || tone === "ink" ? " bow-ghost-light" : ""}`}
          aria-hidden
          style={{ right: -40, bottom: -80, fontSize: "clamp(200px,28vw,460px)" }}
        >
          {ghostText}
        </div>
      ) : null}
      <div className={wide ? "bow-container-wide" : "bow-container"} style={{ position: "relative" }}>
        {children}
      </div>
    </section>
  );
}

/** Muted body colour that stays readable on both light and ink surfaces. */
export function mutedColor(tone: Tone): string {
  return tone === "ink" ? "var(--bow-on-ink-subtle)" : tone === "blue" ? "rgba(255,255,255,0.82)" : "var(--text-secondary)";
}

export function accentColor(tone: Tone): string {
  return tone === "ink" ? "var(--bow-blue)" : tone === "blue" ? "#fff" : "var(--bow-blue)";
}

export function SectionIntro({
  eyebrow,
  headline,
  body,
  tone,
  headingLevel = "h2",
  variant = "display",
  marginBottom = "clamp(28px,3.5vw,44px)",
}: {
  eyebrow?: string;
  headline?: string;
  body?: string;
  tone: Tone;
  headingLevel?: "h1" | "h2";
  variant?: "display" | "headline";
  marginBottom?: string | number;
}) {
  if (!eyebrow && !headline && !body) return null;
  const Heading = headingLevel;
  return (
    <div className="bow-section-intro bow-reveal" style={{ marginBottom }}>
      {eyebrow ? (
        <span className="bow-eyebrow" style={{ color: accentColor(tone) }}>
          {eyebrow}
        </span>
      ) : null}
      {headline ? (
        <Heading className={variant === "display" ? "bow-display" : "bow-headline"}>{headline}</Heading>
      ) : null}
      {body ? (
        <p className="bow-lead" style={tone === "blue" ? { color: "rgba(255,255,255,0.92)" } : undefined}>
          {body}
        </p>
      ) : null}
    </div>
  );
}

/** Paragraphs authored as blank-line-separated text render as real paragraphs. */
export function Paragraphs({
  text,
  className,
  style,
}: {
  text: string;
  className?: string;
  style?: CSSProperties;
}) {
  const blocks = text.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  if (blocks.length === 0) return null;
  return (
    <>
      {blocks.map((block, index) => (
        <p key={index} className={className} style={index === 0 ? style : { ...style, marginTop: "var(--space-4)" }}>
          {block}
        </p>
      ))}
    </>
  );
}
