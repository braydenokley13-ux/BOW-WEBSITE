"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, QueueRow } from "@/components/ds";
import type { QueueAction, QueueItem } from "@/lib/hq-home-shared";
import { completeTask } from "@/app/actions/tasks";
import { changeWorkDueDate } from "@/app/actions/people-work";
import { extendOffer } from "@/app/actions/hq-home";
import DuplicateReviewDialog from "./DuplicateReviewDialog";

/**
 * Home is a glance, not a backlog. Past this many rows the queue stops being
 * scannable, so the remainder is stated as a count rather than scrolled past —
 * the records are still reachable from their own surfaces.
 */
const VISIBLE_LIMIT = 8;

interface Props {
  items: QueueItem[];
  /** Shown under the healthy state, so "nothing needs you" still carries evidence. */
  quietNote?: string | null;
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * The Needs You queue.
 *
 * Items resolve in place: extending an offer or completing a follow-up acts
 * and the row leaves, without navigating away from Home. There is no dismiss
 * control anywhere here — an exception is a fact, and the only way out of the
 * queue is to change the fact.
 */
export default function NeedsYouQueue({ items, quietNote }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  /** Rows already resolved this render, hidden before the refetch lands. */
  const [resolved, setResolved] = useState<Set<string>>(new Set());

  const outstanding = items.filter((item) => !resolved.has(item.key));
  const visible = outstanding.slice(0, VISIBLE_LIMIT);
  const overflow = outstanding.length - visible.length;

  const run = async (itemKey: string, work: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusyKey(itemKey);
    setError(null);
    const result = await work();
    setBusyKey(null);
    if (!result.ok) {
      setError(result.error ?? "That didn't go through.");
      return;
    }
    setResolved((prev) => new Set(prev).add(itemKey));
    startTransition(() => router.refresh());
  };

  const renderAction = (item: QueueItem, action: QueueAction, index: number) => {
    const busy = busyKey === item.key;
    const variant = index === 0 ? "secondary" : "ghost";

    if (action.kind === "link") {
      return (
        <Button key={action.label} href={action.href} variant={variant} size="sm">
          {action.label}
        </Button>
      );
    }
    if (action.kind === "review-duplicate") {
      return (
        <Button key={action.label} variant={variant} size="sm" onClick={() => setReviewId(action.reviewId)}>
          {action.label}
        </Button>
      );
    }
    return (
      <Button
        key={action.label}
        variant={variant}
        size="sm"
        disabled={busy || pending}
        onClick={() => {
          if (action.kind === "complete-task") {
            void run(item.key, () => completeTask(action.taskId, "Marked done from HQ Home."));
          } else if (action.kind === "snooze-task") {
            void run(item.key, () =>
              changeWorkDueDate(action.taskId, addDays(action.days), "Snoozed from HQ Home."),
            );
          } else if (action.kind === "extend-offer") {
            void run(item.key, () => extendOffer(action.offerId, action.hours));
          }
        }}
      >
        {busy ? "…" : action.label}
      </Button>
    );
  };

  return (
    <section aria-labelledby="needs-you-heading" style={{ marginTop: 34 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <h2
          id="needs-you-heading"
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 15,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "var(--bow-ink)",
          }}
        >
          Needs you
        </h2>
        {outstanding.length > 0 ? <Badge status="warning">{outstanding.length}</Badge> : null}
      </div>

      {error ? (
        <p role="alert" className="ops-error" style={{ marginTop: 10 }}>
          {error}
        </p>
      ) : null}

      {outstanding.length === 0 ? (
        <div style={{ borderTop: "1px solid var(--border-rule)", paddingTop: 14 }}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--bow-ink)" }}>
            Nothing needs you. Waitlists, confirmations and reminders are running on their own.
          </p>
          {quietNote ? (
            <p
              style={{
                margin: "8px 0 0",
                fontFamily: "var(--font-data)",
                fontSize: 10.5,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--bow-slate)",
              }}
            >
              {quietNote}
            </p>
          ) : null}
        </div>
      ) : (
        <div>
          {visible.map((item) => (
            <QueueRow
              key={item.key}
              tone={item.tone}
              title={item.title}
              context={item.context}
              actions={item.actions.map((action, index) => renderAction(item, action, index))}
            />
          ))}
          {overflow > 0 ? (
            <p
              style={{
                margin: 0,
                padding: "12px 0 0",
                borderTop: "1px solid var(--border-rule)",
                fontSize: 12.5,
                color: "var(--bow-slate)",
              }}
            >
              {overflow} more waiting, least urgent last.
            </p>
          ) : null}
        </div>
      )}

      {reviewId ? (
        <DuplicateReviewDialog
          key={reviewId}
          reviewId={reviewId}
          onClose={() => setReviewId(null)}
          onResolved={() => {
            const key = items.find((i) => i.actions.some((a) => a.kind === "review-duplicate" && a.reviewId === reviewId))?.key;
            if (key) setResolved((prev) => new Set(prev).add(key));
            setReviewId(null);
            startTransition(() => router.refresh());
          }}
        />
      ) : null}
    </section>
  );
}
