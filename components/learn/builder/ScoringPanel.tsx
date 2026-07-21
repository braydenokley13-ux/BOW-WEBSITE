"use client";

/* ============================================================
 * components/learn/builder/ScoringPanel.tsx — star thresholds (3 ascending
 * numbers), XP config, replay policy display (read-only defaults, editable),
 * badge id multiselect loaded via listBadges server action.
 * ============================================================ */

import { useEffect, useState } from "react";
import type { Scoring } from "@/lib/learn/types";
import { listBadges } from "@/app/actions/learn-author";
import { fieldStyle, labelStyle, rowStyle } from "./formStyles";

export interface ScoringPanelProps {
  scoring: Scoring;
  onChange: (scoring: Scoring) => void;
}

export default function ScoringPanel({ scoring, onChange }: ScoringPanelProps) {
  const [badges, setBadges] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    void listBadges().then((res) => {
      if (!cancelled && res.ok) setBadges(res.badges);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const [t1, t2, t3] = scoring.starThresholds;
  const thresholdsValid = t1 < t2 && t2 < t3;

  function setThreshold(index: 0 | 1 | 2, value: number) {
    const next: [number, number, number] = [...scoring.starThresholds];
    next[index] = value;
    onChange({ ...scoring, starThresholds: next });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <span style={labelStyle}>Star thresholds (score % needed for 1★ / 2★ / 3★, ascending)</span>
        <div style={rowStyle}>
          {[t1, t2, t3].map((t, i) => (
            <input
              key={i}
              style={fieldStyle}
              type="number"
              min={0}
              max={100}
              value={t}
              onChange={(e) => setThreshold(i as 0 | 1 | 2, Number(e.target.value))}
            />
          ))}
        </div>
        {!thresholdsValid && (
          <p role="alert" style={{ color: "var(--bow-negative, #b3261e)", fontSize: 12, marginTop: 4 }}>
            Thresholds must be strictly ascending (1★ &lt; 2★ &lt; 3★).
          </p>
        )}
      </div>

      <div>
        <span style={labelStyle}>XP</span>
        <div style={rowStyle}>
          <div style={{ flex: 1 }}>
            <span style={labelStyle}>Base</span>
            <input
              style={fieldStyle}
              type="number"
              value={scoring.xp.base}
              onChange={(e) => onChange({ ...scoring, xp: { ...scoring.xp, base: Number(e.target.value) } })}
            />
          </div>
          <div style={{ flex: 1 }}>
            <span style={labelStyle}>Per star</span>
            <input
              style={fieldStyle}
              type="number"
              value={scoring.xp.perStar}
              onChange={(e) => onChange({ ...scoring, xp: { ...scoring.xp, perStar: Number(e.target.value) } })}
            />
          </div>
          <div style={{ flex: 1 }}>
            <span style={labelStyle}>First completion bonus</span>
            <input
              style={fieldStyle}
              type="number"
              value={scoring.xp.firstCompletionBonus}
              onChange={(e) =>
                onChange({ ...scoring, xp: { ...scoring.xp, firstCompletionBonus: Number(e.target.value) } })
              }
            />
          </div>
        </div>
      </div>

      <div>
        <span style={labelStyle}>Replay policy</span>
        <p style={{ fontSize: 13, color: "var(--bow-muted-text, #767a85)" }}>
          Improved replay earns {Math.round(scoring.replayPolicy.improvedXpPct * 100)}% of base XP plus an improvement
          bonus. A replay with no improvement earns a floor of {scoring.replayPolicy.noImprovementXpFloor} XP — no
          farming the easiest lesson.
        </p>
        <div style={rowStyle}>
          <div style={{ flex: 1 }}>
            <span style={labelStyle}>Improved replay XP %</span>
            <input
              style={fieldStyle}
              type="number"
              min={0}
              max={100}
              value={Math.round(scoring.replayPolicy.improvedXpPct * 100)}
              onChange={(e) =>
                onChange({
                  ...scoring,
                  replayPolicy: { ...scoring.replayPolicy, improvedXpPct: Number(e.target.value) / 100 },
                })
              }
            />
          </div>
          <div style={{ flex: 1 }}>
            <span style={labelStyle}>No-improvement XP floor</span>
            <input
              style={fieldStyle}
              type="number"
              value={scoring.replayPolicy.noImprovementXpFloor}
              onChange={(e) =>
                onChange({
                  ...scoring,
                  replayPolicy: { ...scoring.replayPolicy, noImprovementXpFloor: Number(e.target.value) },
                })
              }
            />
          </div>
        </div>
      </div>

      <div>
        <span style={labelStyle}>Badges awarded on completion</span>
        <select
          multiple
          style={{ ...fieldStyle, height: 100 }}
          value={scoring.badges}
          onChange={(e) => onChange({ ...scoring, badges: Array.from(e.target.selectedOptions, (o) => o.value) })}
        >
          {badges.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
