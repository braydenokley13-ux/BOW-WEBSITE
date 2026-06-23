"use client";

import { Button, CapLine } from "@/components/ds";

/**
 * Shared front-office error surface for route-level error boundaries
 * (Features 1 & 2). Each segment's error.tsx renders this with a retry
 * handler and a sensible "back to" destination.
 */
export default function RouteError({
  eyebrow = "Turnover on Downs",
  heading = "Something went wrong.",
  body = "The play broke down on our end — not yours. Run it back, or head home and pick another move.",
  onRetry,
  homeHref = "/",
  homeLabel = "Back to Home",
}: {
  eyebrow?: string;
  heading?: string;
  body?: string;
  onRetry?: () => void;
  homeHref?: string;
  homeLabel?: string;
}) {
  return (
    <section
      className="bow-front-office"
      style={{
        background: "var(--bow-ink)",
        color: "#fff",
        minHeight: "70vh",
        display: "flex",
        alignItems: "center",
        padding: "clamp(48px,8vw,120px) clamp(18px,4vw,40px)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 760, margin: "0 auto" }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 12, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
          {eyebrow}
        </span>
        <h1 style={{ margin: "14px 0 0", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(36px,7vw,84px)", lineHeight: 0.9, letterSpacing: "-0.02em", textTransform: "uppercase" }}>
          {heading}
        </h1>
        <CapLine weight={7} step={18} stepAt={0.4} style={{ maxWidth: 320, margin: "20px 0" }} />
        <p style={{ margin: "0 0 28px", fontFamily: "var(--font-interface)", fontSize: "clamp(16px,1.5vw,20px)", lineHeight: 1.55, color: "#b9bcc4", maxWidth: 520 }}>
          {body}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {onRetry && (
            <Button onClick={onRetry} variant="primary" size="lg">
              Try Again
            </Button>
          )}
          <Button href={homeHref} variant="secondary" size="lg" style={{ color: "#fff", borderColor: "var(--bow-dark-border)" }}>
            {homeLabel}
          </Button>
        </div>
      </div>
    </section>
  );
}
