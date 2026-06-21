"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  unstable_retry?: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const retry = () => (unstable_retry ?? reset)?.();
  return (
    // global-error must include its own html and body tags.
    <html lang="en">
      <body style={{ margin: 0, background: "#0a0a0b", color: "#fff" }}>
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            padding: "clamp(48px,8vw,120px) clamp(18px,4vw,40px)",
            fontFamily: "Inter, system-ui, -apple-system, sans-serif",
          }}
        >
          <div style={{ width: "100%", maxWidth: 720, margin: "0 auto" }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "#ff5a36" }}>
              BOW Sports Capital · System Error
            </span>
            <h1 style={{ margin: "14px 0 0", fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif", fontWeight: 900, fontSize: "clamp(40px,9vw,96px)", lineHeight: 0.88, letterSpacing: "-0.02em", textTransform: "uppercase" }}>
              The front office went dark.
            </h1>
            <p style={{ margin: "20px 0 28px", fontSize: "clamp(16px,1.5vw,20px)", lineHeight: 1.55, color: "#b9bcc4", maxWidth: 520 }}>
              An unexpected error took down the whole page. Try reloading — if it keeps happening, come back in a bit.
            </p>
            <button
              onClick={retry}
              style={{ fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif", fontWeight: 700, fontSize: 15, letterSpacing: "0.05em", textTransform: "uppercase", padding: "15px 28px", border: "none", background: "#3157ff", color: "#fff", borderRadius: 4, cursor: "pointer" }}
            >
              Try Again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
