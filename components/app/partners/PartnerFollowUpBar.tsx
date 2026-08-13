"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ds";
import { completeTask } from "@/app/actions/tasks";
import { changeWorkDueDate } from "@/app/actions/people-work";
import { addPartnerNote, scheduleFollowUp } from "@/app/actions/partner-desk";
import type { PartnerFollowUp } from "@/lib/partner-desk-shared";

function inDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * The next thing somebody promised to do about this partner, and the two ways
 * it ever changes: it happens, or it moves.
 *
 * Both go through the canonical Work actions, so a follow-up closed here
 * disappears from HQ Home's queue and the Partners inbox at the same instant —
 * they are all reading the same `tasks` row.
 */
export default function PartnerFollowUpBar({
  organizationId,
  followUp,
}: {
  organizationId: string;
  followUp: PartnerFollowUp | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [dueOn, setDueOn] = useState(inDays(3));

  const run = async (work: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(true);
    setError(null);
    const result = await work();
    setBusy(false);
    if (!result.ok) setError(result.error ?? "That did not work.");
    else {
      setAdding(false);
      setTitle("");
      router.refresh();
    }
  };

  return (
    <div
      style={{
        padding: "14px 16px",
        border: "1px solid var(--border-rule)",
        borderRadius: "var(--radius-card)",
        background: followUp?.overdue ? "var(--bow-warning-tint)" : "var(--bow-white)",
      }}
    >
      {followUp ? (
        <>
          <span
            style={{
              display: "block",
              fontFamily: "var(--font-data)",
              fontSize: 10.5,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: "var(--bow-slate)",
            }}
          >
            {followUp.overdue ? "Overdue" : followUp.dueToday ? "Due today" : `Due ${followUp.dueOn}`}
          </span>
          <p style={{ margin: "6px 0 12px", fontSize: 15, lineHeight: 1.45, color: "var(--bow-ink)" }}>{followUp.title}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button
              size="sm"
              variant="primary"
              disabled={busy}
              onClick={() => run(() => completeTask(followUp.taskId, "Done from the partner record."))}
            >
              Done
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => run(() => changeWorkDueDate(followUp.taskId, inDays(3), "Pushed three days from the partner record."))}
            >
              Push 3 days
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setAdding((value) => !value)}>
              Add another
            </Button>
          </div>
        </>
      ) : (
        <>
          <p style={{ margin: "0 0 12px", fontSize: 14.5, lineHeight: 1.5, color: "var(--bow-ink)" }}>
            Nothing is planned with this partner.
          </p>
          <Button size="sm" variant="primary" disabled={busy} onClick={() => setAdding((value) => !value)}>
            Set a follow-up
          </Button>
        </>
      )}

      {adding ? (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <label htmlFor="follow-up-title" className="ops-label">
              What needs doing
            </label>
            <input
              id="follow-up-title"
              className="bow-input"
              style={{ marginTop: 4 }}
              maxLength={200}
              placeholder="Call the athletic director about spring sections"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="follow-up-date" className="ops-label">
              When
            </label>
            <input
              id="follow-up-date"
              className="bow-input"
              style={{ marginTop: 4, maxWidth: 200 }}
              type="date"
              value={dueOn}
              onChange={(event) => setDueOn(event.target.value)}
            />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button
              size="sm"
              variant="primary"
              disabled={busy || title.trim().length < 3}
              onClick={() => run(() => scheduleFollowUp(organizationId, { title, dueOn }))}
            >
              {busy ? "Saving…" : "Save follow-up"}
            </Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" style={{ margin: "10px 0 0", fontSize: 13, color: "var(--bow-negative)" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** A note is `crm_activity`. Writing one is the whole feature. */
export function PartnerNoteComposer({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    const result = await addPartnerNote(organizationId, body);
    setBusy(false);
    if (result.ok) {
      setBody("");
      router.refresh();
    } else {
      setError(result.error ?? "That did not save.");
    }
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <label htmlFor="partner-note" className="bow-sr-only">
        Add a note about this partner
      </label>
      <textarea
        id="partner-note"
        className="bow-input"
        rows={2}
        maxLength={4000}
        placeholder="What was said, what they are deciding, what happens next."
        value={body}
        disabled={busy}
        onChange={(event) => setBody(event.target.value)}
      />
      <div style={{ marginTop: 8 }}>
        <Button size="sm" variant="secondary" disabled={busy || body.trim().length < 2} onClick={save}>
          {busy ? "Saving…" : "Add note"}
        </Button>
      </div>
      {error ? (
        <p role="alert" style={{ margin: "8px 0 0", fontSize: 13, color: "var(--bow-negative)" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
