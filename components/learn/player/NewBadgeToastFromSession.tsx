"use client";

/* ============================================================
 * NewBadgeToastFromSession — Stage 9 achievement toast pathway.
 *
 * LessonPlayer stashes any rule-badges completeAttempt newly awarded into
 * sessionStorage (keyed by attemptId) right before navigating to the results
 * page, since the award happens in a server action whose result doesn't
 * survive the navigation. This reads that stash once on mount and hands it
 * to the existing BadgeToast component (components/selfpaced/BadgeToast.tsx)
 * — the same toast surface the Daily Question flow uses — then clears it so
 * a refresh of the results page doesn't re-toast.
 * ============================================================ */

import { useEffect, useState } from "react";
import BadgeToast, { type ToastBadge } from "@/components/selfpaced/BadgeToast";

/** Read (never write) the sessionStorage stash for the initial render value.
 * Deliberately side-effect-free: React's Strict Mode invokes a lazy
 * useState initializer twice in dev, so clearing storage here would make
 * the second invocation see nothing and silently drop the toast — the
 * clear happens once, safely, in the mount effect below instead. */
function peekStash(attemptId: string): ToastBadge[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(`bow-new-badges:${attemptId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ToastBadge[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Non-fatal — worst case no toast; the badge is already awarded.
    return [];
  }
}

export default function NewBadgeToastFromSession({ attemptId }: { attemptId: string }) {
  const [badges] = useState<ToastBadge[]>(() => peekStash(attemptId));
  const [dismissed, setDismissed] = useState(false);

  // Clear the stash on mount so a refresh of the results page doesn't
  // re-toast. Idempotent (removeItem on an already-removed key is a no-op),
  // so Strict Mode's double effect-fire in dev is harmless.
  useEffect(() => {
    window.sessionStorage.removeItem(`bow-new-badges:${attemptId}`);
  }, [attemptId]);

  if (dismissed || badges.length === 0) return null;
  return <BadgeToast badges={badges} onDone={() => setDismissed(true)} />;
}
