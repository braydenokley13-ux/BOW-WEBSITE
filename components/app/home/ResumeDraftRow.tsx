"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ds";
import type { ClassDraftSummary } from "@/lib/class-draft";
import { discardDraft } from "@/app/actions/post-class";

/**
 * The unfinished class, offered back as a quiet row rather than a modal.
 *
 * A dialog on load would interrupt someone who came to Home for something
 * else entirely. Discard asks once, because the draft is the only copy.
 */
export default function ResumeDraftRow({ draft }: { draft: ClassDraftSummary }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const saved = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(draft.updatedAt);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        flexWrap: "wrap",
        padding: "12px 16px",
        marginBottom: 26,
        background: "var(--bow-white)",
        border: "1px dashed var(--border-rule)",
        borderRadius: "var(--radius-card)",
      }}
    >
      <span style={{ flex: "1 1 260px", minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--bow-ink)" }}>
          Draft — {draft.title}
        </span>
        <span
          style={{
            display: "block",
            marginTop: 3,
            fontFamily: "var(--font-data)",
            fontSize: 10.5,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--bow-slate)",
          }}
        >
          Saved {saved}
          {draft.courseTitle ? ` · ${draft.courseTitle}` : ""}
          {draft.hasSchedule ? " · schedule set" : ""}
        </span>
      </span>
      <span style={{ display: "flex", gap: 8, flex: "none" }}>
        <Button href="/app/post-class" variant="secondary" size="sm">
          Resume
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => {
            if (!confirming) {
              setConfirming(true);
              return;
            }
            void discardDraft().then(() => startTransition(() => router.refresh()));
          }}
        >
          {confirming ? "Discard for good?" : "Discard"}
        </Button>
      </span>
    </div>
  );
}
