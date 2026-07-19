/* ============================================================
 * Weekly Challenge (Feature 4) — read layer.
 *
 * One harder, multi-part challenge per week, open Sunday → Saturday.
 * The "current" challenge is the one whose stored week window contains
 * today; if today falls outside every window (e.g. months after seeding),
 * we fall back to a weekly rotation so the dashboard always has a live
 * challenge. Students who submit before the deadline earn a Weekly
 * Finisher badge (the weekly_completions row itself).
 *
 * Server-only. Do not import from a client component.
 * ============================================================ */

import { getDb } from "@/lib/db";
import { WEEK_MS } from "@/lib/account";
import { createNotification } from "@/lib/notifications";
import { getLedgerEventsSync, getLedgerDepth } from "@/lib/ledger-store";
import { summarizeWindow } from "@/lib/ledger";

export interface WeeklyChallengeView {
  id: string;
  title: string;
  prompt: string;
  weekStart: string;
  weekEnd: string;
  ordinal: number;
  /** True for the single open challenge (submittable). */
  isCurrent: boolean;
  /** The student has submitted this challenge. */
  completed: boolean;
  /** The student's saved response, if submitted. */
  response: string | null;
  submittedAt: number | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

interface ChallengeRow {
  id: string;
  title: string;
  prompt: string;
  week_start: string;
  week_end: string;
  ordinal: number;
}

/** All challenges, ordered by their week window then ordinal. */
async function allChallenges(): Promise<ChallengeRow[]> {
  return (await getDb()
      .prepare("SELECT id, title, prompt, week_start, week_end, ordinal FROM weekly_challenges ORDER BY week_start ASC, ordinal ASC")
      .all()) as any[];
}

/** Today's date as a YYYY-MM-DD string (UTC) for window comparisons. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** The current week's Sunday → Saturday window as ISO dates (UTC). */
function currentWeekWindow(): { start: string; end: string; startMs: number } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - now.getUTCDay()));
  const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10), startMs: start.getTime() };
}

/**
 * A challenge generated from this week's Open Ledger — the model changed
 * its mind about something real, and arguing with the model IS the
 * curriculum. Only fills weeks the content bank left empty (an authored,
 * in-window challenge always wins), and only when the ledger actually
 * moved this week — otherwise the old rotation fallback still runs.
 * The id is stable for the week, so weekly_completions rows work
 * unchanged and one submission per student per week still holds.
 */
async function ledgerChallenge(): Promise<ChallengeRow | null> {
  try {
    if ((await getLedgerDepth()) < 2) return null; // day one has no diffs to argue with
    const week = currentWeekWindow();
    const top = (await summarizeWindow((await getLedgerEventsSync()), week.startMs)).top;
    if (!top) return null;
    return {
      id: `wc-ledger-${week.start}`,
      title: "The model changed its mind this week",
      prompt:
        `From the Open Ledger (/analytics/ledger): ${top.headline}. ` +
        `The model's own explanation: ${top.detail} ` +
        `Your challenge: do you buy it? In a paragraph, name the assumption that did the work ` +
        `(dollars per win? the apron multiplier? replacement level?), say whether YOU would have ` +
        `made the same call, and defend it. There is no answer key — there is only your argument.`,
      week_start: week.start,
      week_end: week.end,
      ordinal: 0,
    };
  } catch {
    return null; // a ledger hiccup must never blank the dashboard
  }
}

/** The currently open challenge: an authored in-window one, else this week's ledger event, else the rotation. */
async function pickCurrent(rows: ChallengeRow[]): Promise<ChallengeRow | null> {
  const today = todayIso();
  const inWindow = rows.find((r) => r.week_start <= today && today <= r.week_end);
  if (inWindow) return inWindow;
  // The ledger fills empty weeks with something REAL before the canned
  // rotation gets a turn — a non-repeating reason to come back.
  const fromLedger = (await ledgerChallenge());
  if (fromLedger) return fromLedger;
  if (rows.length === 0) return null;
  // Last resort so a live challenge always shows: rotate by week number.
  const idx = Math.floor(Date.now() / WEEK_MS) % rows.length;
  return rows[idx];
}

/** The id of the currently open challenge, or null. */
export async function currentWeeklyChallengeId(): Promise<string | null> {
  return (await pickCurrent((await allChallenges())))?.id ?? null;
}

/**
 * Ensure the student has a `weekly_challenge` notification for the currently
 * open challenge. Idempotent (fixed id), so the dashboard can call it on load —
 * the notification fires once per student per challenge.
 */
export async function ensureWeeklyChallengeNotification(studentId: string): Promise<void> {
  const current = (await pickCurrent((await allChallenges())));
  if (!current) return;
  (await createNotification({
        id: `ntf-weekly-${studentId}-${current.id}`,
        userId: studentId,
        type: "weekly_challenge",
        title: "New Weekly Challenge.",
        body: `${current.title} is live. You have until Sunday.`,
        link: "/dashboard",
      }));
}

/** A map of challenge id -> the student's completion (response + timestamp). */
async function completionsFor(studentId: string): Promise<Record<string, { response: string; submittedAt: number }>> {
  const rows = (await getDb()
      .prepare("SELECT challenge_id, response_text, submitted_at FROM weekly_completions WHERE student_id = ?")
      .all(studentId)) as any[];
  const map: Record<string, { response: string; submittedAt: number }> = {};
  for (const r of rows) map[r.challenge_id] = { response: r.response_text, submittedAt: Number(r.submitted_at) || 0 };
  return map;
}

function toView(r: ChallengeRow, currentId: string | null, comp: Record<string, { response: string; submittedAt: number }>): WeeklyChallengeView {
  const c = comp[r.id];
  return {
    id: r.id,
    title: r.title,
    prompt: r.prompt,
    weekStart: r.week_start,
    weekEnd: r.week_end,
    ordinal: Number(r.ordinal) || 0,
    isCurrent: r.id === currentId,
    completed: !!c,
    response: c?.response ?? null,
    submittedAt: c?.submittedAt ?? null,
  };
}

/** This week's open challenge for a student, with their submission if any. */
export async function getCurrentWeeklyChallenge(studentId: string): Promise<WeeklyChallengeView | null> {
  const rows = (await allChallenges());
  const current = (await pickCurrent(rows));
  if (!current) return null;
  return toView(current, current.id, (await completionsFor(studentId)));
}

/** Past challenges (everything except the current one), view-only, newest first. */
export async function getPastWeeklyChallenges(studentId: string): Promise<WeeklyChallengeView[]> {
  const rows = (await allChallenges());
  const currentId = (await pickCurrent(rows))?.id ?? null;
  const comp = (await completionsFor(studentId));
  return rows
    .filter((r) => r.id !== currentId)
    .map((r) => toView(r, currentId, comp))
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart) || b.ordinal - a.ordinal);
}

/** How many weekly challenges the student has completed (for the profile). */
export async function getWeeklyCompletionCount(studentId: string): Promise<number> {
  const row = (await getDb().prepare("SELECT COUNT(*) AS n FROM weekly_completions WHERE student_id = ?").get(studentId)) as any;
  return Number(row?.n) || 0;
}

/** Total weekly challenges + completions (for the admin overview). */
export async function getWeeklyChallengeStats(): Promise<{ challenges: number; completions: number }> {
  const a = (await getDb().prepare("SELECT COUNT(*) AS n FROM weekly_challenges").get()) as any;
  const b = (await getDb().prepare("SELECT COUNT(*) AS n FROM weekly_completions").get()) as any;
  return { challenges: Number(a?.n) || 0, completions: Number(b?.n) || 0 };
}

/* eslint-enable @typescript-eslint/no-explicit-any */
