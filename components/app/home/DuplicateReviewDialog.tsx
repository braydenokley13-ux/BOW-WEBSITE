"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Modal } from "@/components/ds";
import { decideDuplicateReview, getDuplicateReview, type DuplicateReviewDetail } from "@/app/actions/hq-home";

interface Props {
  reviewId: string;
  onClose: () => void;
  onResolved: () => void;
}

/**
 * Duplicate review — the deliberate opposite of an automatic merge.
 *
 * The two records are shown side by side with the facts that actually
 * distinguish children (grade, school, guardian, live registrations), and any
 * merge conflict the engine found is stated before a choice is offered.
 * Merging requires naming which record survives; there is no default.
 */
export default function DuplicateReviewDialog({ reviewId, onClose, onResolved }: Props) {
  const [detail, setDetail] = useState<DuplicateReviewDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canonicalId, setCanonicalId] = useState<string | null>(null);

  // The dialog is remounted per review (keyed by reviewId at the call site),
  // so the effect only ever loads once and never has to reset state
  // synchronously on the way in.
  useEffect(() => {
    let live = true;
    getDuplicateReview(reviewId)
      .then((result) => {
        if (!live) return;
        setDetail(result);
        setLoading(false);
        if (!result) setError("That review has already been resolved.");
      })
      .catch(() => {
        if (!live) return;
        setLoading(false);
        setError("Could not load that review.");
      });
    return () => {
      live = false;
    };
  }, [reviewId]);

  const decide = async (decision: "distinct" | "merged" | "deferred") => {
    setBusy(true);
    setError(null);
    const result = await decideDuplicateReview(reviewId, decision, { canonicalStudentId: canonicalId });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Could not record that decision.");
      return;
    }
    onResolved();
  };

  return (
    <Modal open onClose={onClose} title="Are these the same child?" maxWidth={620}>
      {loading ? <p style={{ margin: 0, color: "var(--bow-slate)" }}>Loading…</p> : null}

      {error ? (
        <p role="alert" className="ops-error" style={{ marginTop: 0 }}>
          {error}
        </p>
      ) : null}

      {detail ? (
        <>
          {detail.detectedReason ? (
            <p style={{ margin: "0 0 14px", fontSize: 13.5, lineHeight: 1.6, color: "var(--bow-slate)" }}>
              {detail.detectedReason}
            </p>
          ) : null}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            {detail.students.map((student) => {
              const chosen = canonicalId === student.id;
              return (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => setCanonicalId(chosen ? null : student.id)}
                  style={{
                    textAlign: "left",
                    background: chosen ? "var(--bow-blue-tint)" : "var(--bow-white)",
                    border: `1px solid ${chosen ? "var(--bow-blue)" : "var(--border-rule)"}`,
                    borderRadius: "var(--radius-card)",
                    padding: "13px 15px",
                    cursor: "pointer",
                    font: "inherit",
                  }}
                >
                  <span style={{ display: "block", fontWeight: 600, fontSize: 14, color: "var(--bow-ink)" }}>
                    {student.name}
                  </span>
                  <span
                    style={{
                      display: "block",
                      marginTop: 5,
                      fontFamily: "var(--font-data)",
                      fontSize: 10.5,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      color: "var(--bow-slate)",
                    }}
                  >
                    {[student.grade ? `Grade ${student.grade}` : null, student.school, student.guardianName]
                      .filter(Boolean)
                      .join(" · ") || "No other details"}
                  </span>
                  {student.registrations.length > 0 ? (
                    <span style={{ display: "block", marginTop: 7, fontSize: 12.5, color: "var(--bow-slate)" }}>
                      {student.registrations.join(", ")}
                    </span>
                  ) : null}
                  <span style={{ display: "block", marginTop: 9 }}>
                    <Badge status={chosen ? "info" : "neutral"}>{chosen ? "Keep this one" : "Choose to keep"}</Badge>
                  </span>
                </button>
              );
            })}
          </div>

          {detail.safety.conflicts.length > 0 ? (
            <div
              style={{
                marginTop: 16,
                padding: "11px 14px",
                background: "var(--bow-warning-tint)",
                borderRadius: "var(--radius-control)",
              }}
            >
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--bow-ink)" }}>
                These look like two different children:
              </p>
              <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13, lineHeight: 1.6, color: "var(--bow-ink)" }}>
                {detail.safety.conflicts.map((conflict) => (
                  <li key={conflict}>{conflict}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
            <Button variant="primary" size="sm" disabled={busy} onClick={() => void decide("distinct")}>
              Different children
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={busy || !canonicalId || !detail.safety.safe}
              onClick={() => void decide("merged")}
            >
              Same child — merge
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => void decide("deferred")}>
              Decide later
            </Button>
          </div>
          {!detail.safety.safe ? (
            <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--bow-slate)" }}>
              Merging is unavailable while those conflicts stand.
            </p>
          ) : !canonicalId ? (
            <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--bow-slate)" }}>
              To merge, pick which record to keep.
            </p>
          ) : null}
        </>
      ) : null}
    </Modal>
  );
}
