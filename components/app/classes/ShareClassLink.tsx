"use client";

import { useState } from "react";

/**
 * The public address of a class, always visible on its record.
 *
 * Quiet by design: sharing is the loudest action only while there are seats to
 * fill, so once the class is full or a session is imminent this stays a fact on
 * the page rather than a call to action.
 */
export default function ShareClassLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
        marginTop: 16,
        padding: "9px 13px",
        background: "var(--bow-white)",
        border: "1px solid var(--border-rule)",
        borderRadius: "var(--radius-control)",
      }}
    >
      <code
        style={{
          flex: "1 1 220px",
          minWidth: 0,
          overflowWrap: "anywhere",
          fontFamily: "var(--font-data)",
          fontSize: 12,
          color: "var(--bow-slate)",
        }}
      >
        {url.replace(/^https?:\/\//, "")}
      </code>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          } catch {
            /* Selecting the text by hand still works. */
          }
        }}
        style={{
          flex: "none",
          minHeight: 32,
          padding: "5px 11px",
          borderRadius: "var(--radius-control)",
          border: "1px solid var(--border-rule)",
          background: "transparent",
          color: copied ? "var(--bow-positive)" : "var(--bow-ink)",
          fontFamily: "var(--font-data)",
          fontSize: 10.5,
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          cursor: "pointer",
        }}
      >
        {copied ? "Copied ✓" : "Copy"}
      </button>
    </div>
  );
}
