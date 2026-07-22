"use client";

/* ============================================================
 * components/learn/builder/ResultsPanel.tsx — headline/celebration copy,
 * show-variables toggle, show-skill-deltas toggle, next-lesson CTA picker.
 * ============================================================ */

import { useEffect, useState } from "react";
import type { Results } from "@/lib/learn/types";
import { listLessonsForPicker } from "@/app/actions/learn-author";
import { fieldStyle, labelStyle } from "./formStyles";

export interface ResultsPanelProps {
  results: Results;
  onChange: (results: Results) => void;
  nextLessonId?: string;
  onChangeNextLessonId?: (lessonId: string | undefined) => void;
}

export default function ResultsPanel({ results, onChange, nextLessonId, onChangeNextLessonId }: ResultsPanelProps) {
  const [lessons, setLessons] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    void listLessonsForPicker().then((res) => {
      if (!cancelled && res.ok) setLessons(res.lessons);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <span style={labelStyle}>Headline / celebration copy</span>
        <input
          style={fieldStyle}
          placeholder="e.g. Rivalry Night: In the Books!"
          value={results.celebrationCopy ?? ""}
          onChange={(e) => onChange({ ...results, celebrationCopy: e.target.value })}
        />
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
        <input
          type="checkbox"
          checked={results.showVariables}
          onChange={(e) => onChange({ ...results, showVariables: e.target.checked })}
        />
        Show variable outcomes on the results screen
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
        <input
          type="checkbox"
          checked={results.showSkillDeltas}
          onChange={(e) => onChange({ ...results, showSkillDeltas: e.target.checked })}
        />
        Show skill point deltas on the results screen
      </label>
      {onChangeNextLessonId && (
        <div>
          <span style={labelStyle}>Next-lesson call to action</span>
          <select
            style={fieldStyle}
            value={nextLessonId ?? ""}
            onChange={(e) => onChangeNextLessonId(e.target.value || undefined)}
          >
            <option value="">None</option>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
