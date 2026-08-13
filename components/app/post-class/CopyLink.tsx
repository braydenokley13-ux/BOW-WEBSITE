"use client";

import { useState } from "react";

/**
 * The share link, presented as the thing it is: the whole reason to publish.
 *
 * Falls back to selecting the text when the clipboard API is unavailable
 * (older browsers, or any non-secure origin), so the link is never a dead end.
 */
export default function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      const selection = window.getSelection();
      const node = document.getElementById("bow-share-url");
      if (selection && node) {
        const range = document.createRange();
        range.selectNodeContents(node);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        padding: "14px 16px",
        marginBottom: 22,
        background: "var(--bow-white)",
        border: "1px solid var(--border-rule)",
        borderRadius: "var(--radius-card)",
      }}
    >
      <code
        id="bow-share-url"
        style={{
          flex: "1 1 260px",
          minWidth: 0,
          overflowWrap: "anywhere",
          fontFamily: "var(--font-data)",
          fontSize: 13,
          color: "var(--bow-ink)",
        }}
      >
        {url.replace(/^https?:\/\//, "")}
      </code>
      <button
        type="button"
        onClick={() => void copy()}
        style={{
          flex: "none",
          padding: "8px 14px",
          minHeight: 36,
          borderRadius: "var(--radius-control)",
          border: "1px solid var(--bow-ink)",
          background: copied ? "var(--bow-positive)" : "var(--bow-ink)",
          color: "var(--bow-white)",
          fontFamily: "var(--font-data)",
          fontSize: 11,
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          cursor: "pointer",
        }}
      >
        {copied ? "Copied ✓" : "Copy link"}
      </button>
    </div>
  );
}
