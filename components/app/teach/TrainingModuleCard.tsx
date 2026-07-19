"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ds";
import CompleteModuleButton from "@/components/app/teach/CompleteModuleButton";
import { recordTrainingModuleView } from "@/app/actions/instructors";

export default function TrainingModuleCard({
  instructorId,
  module,
  completed,
  initialViewedAt,
  renderedAt,
}: {
  instructorId: string;
  module: { id: string; title: string; required: boolean; contentType: "text" | "link"; content: string | null };
  completed: boolean;
  initialViewedAt: number | null;
  renderedAt: number;
}) {
  const [firstViewedAt, setFirstViewedAt] = useState(initialViewedAt);
  const [ready, setReady] = useState(completed || Boolean(initialViewedAt && renderedAt - initialViewedAt >= 5_000));
  const [recordingView, setRecordingView] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const safeLink = module.contentType === "link" && module.content && /^https?:\/\//i.test(module.content) ? module.content : null;

  useEffect(() => {
    if (!firstViewedAt || ready) return;
    const remaining = Math.max(0, 5_000 - (Date.now() - firstViewedAt));
    const timeout = window.setTimeout(() => setReady(true), remaining + 50);
    return () => window.clearTimeout(timeout);
  }, [firstViewedAt, ready]);

  const opened = async (event: React.SyntheticEvent<HTMLDetailsElement>) => {
    if (!event.currentTarget.open || firstViewedAt || completed || recordingView) return;
    setRecordingView(true);
    setError(null);
    try {
      const result = await recordTrainingModuleView(instructorId, module.id);
      if (!result.ok || !result.firstViewedAt) {
        setError(result.error ?? "The module view could not be recorded.");
        return;
      }
      setFirstViewedAt(result.firstViewedAt);
    } catch {
      setError("The module view could not be recorded. Check your connection and open it again.");
    } finally {
      setRecordingView(false);
    }
  };

  return (
    <article style={{ border: "1px solid var(--border-rule)", borderRadius: 5, padding: 14, background: "var(--bow-paper)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <span style={{ fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-ink)" }}>{module.title}</span>{" "}
          {module.required && <Badge status="negative">Required</Badge>}
        </div>
        {completed ? <Badge status="positive">Completed</Badge> : <CompleteModuleButton instructorId={instructorId} moduleId={module.id} disabled={!ready} />}
      </div>
      <details onToggle={(event) => void opened(event)} style={{ marginTop: 10 }}>
        <summary style={{ cursor: "pointer", fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-blue)" }}>Open module content</summary>
        <div style={{ marginTop: 10, fontFamily: "var(--font-interface)", fontSize: 13.5, lineHeight: 1.6, color: "var(--bow-slate)" }}>
          {module.contentType === "text" ? <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{module.content || "Content is being prepared."}</p> : safeLink ? (
            <a href={safeLink} target="_blank" rel="noopener noreferrer" style={{ color: "var(--bow-blue)" }}>Open the training resource in a new tab</a>
          ) : <p style={{ margin: 0 }}>This resource link is unavailable. Contact the instructor manager.</p>}
        </div>
      </details>
      {!completed && firstViewedAt && !ready && <p role="status" style={{ margin: "8px 0 0", fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)" }}>Review the content; completion unlocks in a few seconds.</p>}
      {error && <p role="alert" style={{ margin: "8px 0 0", fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-negative)" }}>{error}</p>}
    </article>
  );
}
