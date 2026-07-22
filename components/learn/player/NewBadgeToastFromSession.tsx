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

import { useState } from "react";
import BadgeToast, { type ToastBadge } from "@/components/selfpaced/BadgeToast";

/** Read + clear the sessionStorage stash once, synchronously, before first paint. */
function readStash(attemptId: string): ToastBadge[] {
  if (typeof window === "undefined") return [];
  const key = `bow-new-badges:${attemptId}`;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return [];
    window.sessionStorage.removeItem(key);
    const parsed = JSON.parse(raw) as ToastBadge[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Non-fatal — worst case no toast; the badge is already awarded.
    return [];
  }
}

export default function NewBadgeToastFromSession({ attemptId }: { attemptId: string }) {
  const [badges, setBadges] = useState<ToastBadge[]>(() => readStash(attemptId));

  if (badges.length === 0) return null;
  return <BadgeToast badges={badges} onDone={() => setBadges([])} />;
}
