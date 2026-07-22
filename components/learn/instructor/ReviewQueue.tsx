"use client";

/* ============================================================
 * components/learn/instructor/ReviewQueue.tsx — Stage 8 follow-up.
 *
 * Pending manual_review long_text responses, one card per response: student,
 * lesson, the prompt, the response text, and an approve form (points capped
 * client-side at pointsPossible — server re-validates, this is just UX).
 * ============================================================ */

import { useState, useTransition } from "react";
import Button from "@/components/ds/Button";
import { approveReview, type PendingReviewRow } from "@/app/actions/learn-review";

export default function ReviewQueue({ initialRows }: { initialRows: PendingReviewRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [drafts, setDrafts] = useState<Record<string, { points: number; feedback: string }>>({});
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function draftFor(row: PendingReviewRow) {
    return drafts[row.id] ?? { points: row.pointsPossible, feedback: "" };
  }

  function approve(row: PendingReviewRow) {
    const draft = draftFor(row);
    setError(null);
    startTransition(async () => {
      const result = await approveReview(row.id, draft.points, draft.feedback);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    });
  }

  if (rows.length === 0) {
    return (
      <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 24 }}>
        <p style={{ margin: 0, color: "var(--bow-slate)" }}>Nothing waiting for review. Nice.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error && (
        <p role="alert" style={{ color: "var(--bow-negative)", margin: 0 }}>
          {error}
        </p>
      )}
      {rows.map((row) => {
        const draft = draftFor(row);
        return (
          <div key={row.id} style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15 }}>{row.studentName}</span>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)", textTransform: "uppercase" }}>{row.lessonTitle}</span>
            </div>
            {row.prompt && <p style={{ fontStyle: "italic", color: "var(--bow-slate)", margin: "0 0 8px" }}>{row.prompt}</p>}
            <p style={{ whiteSpace: "pre-wrap", background: "var(--bow-paper)", padding: 12, borderRadius: 4, margin: "0 0 14px" }}>{row.responseText}</p>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                Points (0–{row.pointsPossible})
                <input
                  type="number"
                  min={0}
                  max={row.pointsPossible}
                  value={draft.points}
                  onChange={(e) =>
                    setDrafts((d) => ({ ...d, [row.id]: { ...draft, points: Number(e.target.value) } }))
                  }
                  style={{ width: 90, padding: "6px 8px", border: "1px solid var(--border-rule)", borderRadius: 4 }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, flex: 1, minWidth: 220 }}>
                Feedback note
                <input
                  type="text"
                  value={draft.feedback}
                  onChange={(e) => setDrafts((d) => ({ ...d, [row.id]: { ...draft, feedback: e.target.value } }))}
                  placeholder="Nice specificity — try naming the tradeoff next time."
                  style={{ padding: "6px 8px", border: "1px solid var(--border-rule)", borderRadius: 4 }}
                />
              </label>
              <Button variant="emphasis" onClick={() => approve(row)} disabled={pending} aria-label={`Approve ${row.studentName}'s reflection`}>
                {pending ? "Saving…" : "Approve"}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
