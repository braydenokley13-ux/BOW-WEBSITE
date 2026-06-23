"use client";

import { useState } from "react";

/**
 * Copies the student's public profile URL to the clipboard. The absolute URL is
 * built at click time from the current origin so it works on any deployment.
 */
export default function ShareButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  const onShare = async () => {
    const url = typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      // Clipboard blocked — fall back to a prompt the student can copy from.
      window.prompt("Copy your public profile link:", url);
    }
  };

  return (
    <button
      onClick={onShare}
      style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13.5, letterSpacing: "0.05em", textTransform: "uppercase", padding: "11px 20px", border: "1px solid var(--border-strong)", background: copied ? "var(--bow-ink)" : "transparent", color: copied ? "#fff" : "var(--bow-ink)", borderRadius: 4, cursor: "pointer" }}
    >
      {copied ? "✓ Link Copied" : "Share Profile"}
    </button>
  );
}
