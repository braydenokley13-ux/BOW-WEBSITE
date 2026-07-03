"use client";

import { useState } from "react";

/** Copy-link + X share for article pages. No tracking, no SDKs. */
export default function ShareButtons({ title, path }: { title: string; path: string }) {
  const [copied, setCopied] = useState(false);

  const url = () => (typeof window === "undefined" ? path : new URL(path, window.location.origin).toString());

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — nothing sensible to do */
    }
  };

  const btn: React.CSSProperties = {
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: 12,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    padding: "8px 14px",
    border: "1px solid var(--border-rule)",
    background: "var(--bow-white)",
    color: "var(--bow-ink)",
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  };

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)", marginRight: 4 }}>
        Share
      </span>
      <button type="button" onClick={copy} style={btn}>
        {copied ? "✓ Copied" : "Copy link"}
      </button>
      <a
        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url())}`}
        target="_blank"
        rel="noopener noreferrer"
        style={btn}
        onClick={(e) => {
          // Build the URL at click time so it carries the real origin.
          e.currentTarget.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url())}`;
        }}
      >
        Post on X
      </a>
    </div>
  );
}
