"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import { Button, CapLine } from "@/components/ds";

export default function Error({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  unstable_retry?: () => void;
}) {
  useEffect(() => {
    // In production this would go to an error reporting service.
    console.error(error);
  }, [error]);

  const retry = () => (unstable_retry ?? reset)?.();

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
      <div className="bow-container" style={{ width: "100%", maxWidth: 760, margin: "0 auto" }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 12, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
          Turnover on Downs
        </span>
        <h1 style={{ margin: "14px 0 0", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(40px,9vw,108px)", lineHeight: 0.86, letterSpacing: "-0.02em", textTransform: "uppercase" }}>
          Something
          <br />
          went wrong.
        </h1>
        <CapLine weight={7} step={18} stepAt={0.4} style={{ maxWidth: 320, margin: "20px 0" }} />
        <p style={{ margin: "0 0 28px", fontFamily: "var(--font-interface)", fontSize: "clamp(16px,1.5vw,20px)", lineHeight: 1.55, color: "#b9bcc4", maxWidth: 520 }}>
          The play broke down on our end — not yours. Run it back, or head to the front office and pick another move.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <Button onClick={retry} variant="primary" size="lg">Try Again</Button>
          <Button href="/" variant="secondary" size="lg" style={{ color: "#fff", borderColor: "var(--bow-dark-border)" }}>
            Back to Home
          </Button>
        </div>
      </div>
    </section>
  );
}
