"use client";

/* ============================================================
 * components/learn/player/blocks/MediaBlock.tsx — image/video/audio/podcast.
 *
 * `completion` gates when the Continue control unlocks: none (always),
 * started (played at least once), percent(n) (tracked fraction >= n),
 * finished (ended). Podcast reuses components/site/PodcastPlayer per the
 * Stage 0 audit — its onProgress fraction feeds the same completion logic
 * as real audio/video, and its "simulated timer" caveat carries over
 * unchanged (docs/learn/stage0-audit.md §4).
 * ============================================================ */

import { useState } from "react";
import PodcastPlayer from "@/components/site/PodcastPlayer";
import Button from "@/components/ds/Button";
import type { BlockPlayerProps } from "../types";
import type { Block } from "@/lib/learn/types";

type MediaBlockT = Extract<Block, { type: "media" }>;

function completionSatisfied(block: MediaBlockT, playedFraction: number, started: boolean, ended: boolean): boolean {
  switch (block.completion.mode) {
    case "none":
      return true;
    case "started":
      return started;
    case "percent":
      return playedFraction >= block.completion.threshold;
    case "finished":
      return ended;
    default:
      return true;
  }
}

export default function MediaBlockPlayer({ block, committed, value, onChange, onCommit }: BlockPlayerProps<MediaBlockT>) {
  const [started, setStarted] = useState(Boolean(value));
  const [ended, setEnded] = useState(false);
  const playedFraction = typeof value === "number" ? value : 0;
  const satisfied = committed || completionSatisfied(block, playedFraction, started, ended);

  const reportProgress = (fraction: number) => {
    onChange(fraction);
    if (!started) setStarted(true);
    if (fraction >= 0.999) setEnded(true);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {block.title && (
        <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, margin: 0 }}>{block.title}</h3>
      )}

      {block.kind === "podcast" && (
        <PodcastPlayer
          episode="Lesson audio"
          eyebrow="Media"
          title={block.title ?? "Audio"}
          desc=""
          lengthSec={300}
          lengthLabel="5:00"
          takeaways={[]}
          onProgress={reportProgress}
        />
      )}

      {block.kind === "audio" && (
        <audio
          controls
          src={block.src}
          style={{ width: "100%" }}
          onPlay={() => reportProgress(Math.max(playedFraction, 0.01))}
          onTimeUpdate={(e) => {
            const el = e.currentTarget;
            if (el.duration > 0) reportProgress(el.currentTime / el.duration);
          }}
          onEnded={() => reportProgress(1)}
        />
      )}

      {block.kind === "video" && (
        <video
          controls
          src={block.src}
          style={{ width: "100%", borderRadius: 4, background: "#000" }}
          onPlay={() => reportProgress(Math.max(playedFraction, 0.01))}
          onTimeUpdate={(e) => {
            const el = e.currentTarget;
            if (el.duration > 0) reportProgress(el.currentTime / el.duration);
          }}
          onEnded={() => reportProgress(1)}
        />
      )}

      {block.kind === "image" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={block.src}
          alt={block.title ?? "Lesson media"}
          style={{ maxWidth: "100%", borderRadius: 4, display: "block" }}
          onLoad={() => reportProgress(1)}
        />
      )}

      <Button
        variant="primary"
        disabled={committed || !satisfied}
        onClick={onCommit}
        aria-label="Continue"
      >
        {satisfied ? "Continue" : "Keep watching to continue"}
      </Button>
    </div>
  );
}
