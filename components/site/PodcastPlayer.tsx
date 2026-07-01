"use client";

import { useEffect, useRef, useState } from "react";
import type { PodTakeaway } from "@/lib/podcast";

interface PodcastPlayerProps {
  /** Episode label, e.g. "EP 08". */
  episode: string;
  /** Eyebrow above the title, e.g. "Revenue Economics · Latest episode". */
  eyebrow: string;
  /** Episode title. */
  title: string;
  /** Episode description / blurb. */
  desc: string;
  /** Total runtime in seconds (mock). */
  lengthSec: number;
  /** Display string for the total runtime, e.g. "44:00". */
  lengthLabel: string;
  /** Transcript / key-takeaways list. */
  takeaways: PodTakeaway[];
  /** Optional: fired with the played fraction (0–1) as playback advances. */
  onProgress?: (fraction: number) => void;
}

const TICK_MS = 500;
const STEP_SEC = 5;

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Full episode audio isn't produced yet — this player runs an honest
// engagement timer (no faked waveform/scrubbing) that still reports played
// fraction to the lesson auto-unlock, and says so plainly in the UI.
export default function PodcastPlayer({
  episode,
  eyebrow,
  title,
  desc,
  lengthSec,
  lengthLabel,
  takeaways,
  onProgress,
}: PodcastPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [sec, setSec] = useState(0);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Report the played fraction as it changes (used by the lesson auto-unlock).
  useEffect(() => {
    onProgress?.(lengthSec > 0 ? Math.min(1, sec / lengthSec) : 0);
    // onProgress intentionally omitted from deps: callers pass a stable callback
    // and we only want to fire on a real time change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sec, lengthSec]);

  useEffect(() => {
    if (!playing) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setSec((prev) => {
        const next = prev + STEP_SEC;
        if (next >= lengthSec) {
          setPlaying(false);
          return lengthSec;
        }
        return next;
      });
    }, TICK_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [playing, lengthSec]);

  const togglePod = () => setPlaying((p) => !p);
  const toggleTranscript = () => setTranscriptOpen((t) => !t);

  const podIcon = playing ? "❚❚" : "▶";
  const podIconPad = playing ? "0px" : "3px";
  const podBtnLabel = playing ? "Pause" : sec > 0 ? "Resume Preview" : "Start Preview";
  const podPct = `${(sec / lengthSec) * 100}%`;
  const transcriptLabel = transcriptOpen ? "Hide takeaways" : "Key takeaways";

  return (
    <div style={{ border: "1px solid var(--bow-dark-border)", background: "var(--bow-dark-surface)", display: "grid", gridTemplateColumns: "132px 1fr", alignItems: "stretch" }}>
      <button onClick={togglePod} aria-label="Start episode preview timer" style={{ border: "none", cursor: "pointer", background: "var(--bow-ink)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", borderRight: "1px solid var(--bow-dark-border)" }}>
        <span style={{ width: 52, height: 52, borderRadius: 999, background: "var(--bow-blue)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "#fff", fontSize: 18, marginLeft: podIconPad }}>{podIcon}</span>
        </span>
        <span style={{ position: "absolute", bottom: 10, left: 0, right: 0, textAlign: "center", fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", color: "#9a9da6" }}>{episode}</span>
      </button>
      <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-orange)" }}>{eyebrow}</span>
        <h3 style={{ margin: 0, fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(20px,2.4vw,26px)", lineHeight: 1.15 }}>{title}</h3>
        <p style={{ margin: "4px 0 0", fontFamily: "var(--font-interface)", fontSize: 14.5, lineHeight: 1.55, color: "#b9bcc4", maxWidth: 560 }}>{desc}</p>
        {/* progress */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "#9a9da6" }}>{fmtTime(sec)}</span>
          <div style={{ flex: 1, height: 4, background: "#2a2a2f", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ height: "100%", width: podPct, background: "var(--bow-blue)", transition: "width 0.3s linear" }} />
          </div>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "#9a9da6" }}>{lengthLabel}</span>
        </div>
        <p style={{ margin: "2px 0 0", fontFamily: "var(--font-data)", fontSize: 11.5, letterSpacing: "0.02em", color: "#6d7078" }}>
          Full episode audio is coming soon — this is a timed preview, not live playback.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 10 }}>
          <button onClick={togglePod} style={{ background: "transparent", border: "none", cursor: "pointer", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase", color: "#fff" }}>{podBtnLabel}</button>
          <button onClick={toggleTranscript} aria-expanded={transcriptOpen} style={{ background: "transparent", border: "none", cursor: "pointer", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6f8bff" }}>{transcriptLabel}</button>
        </div>
        {transcriptOpen && (
          <div style={{ marginTop: 8, borderTop: "1px solid var(--bow-dark-border)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6d7078" }}>Key Takeaways</span>
            {takeaways.map((t) => (
              <div key={t.n} style={{ display: "flex", gap: 10, fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.5, color: "#c8cad0" }}>
                <span style={{ color: "var(--bow-blue)", fontFamily: "var(--font-data)" }}>{t.n}</span>
                <span>{t.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
