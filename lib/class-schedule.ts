/* ============================================================
 * Weekly run generation for the class composer.
 *
 * Pure calendar arithmetic on YYYY-MM-DD strings — no Date-with-timezone
 * anywhere, because a run is a set of calendar dates and only becomes an
 * instant when localDateTimeToEpoch pins it to the class timezone at publish.
 *
 * Browser-safe: the composer previews the identical list the publish
 * transaction will create, so what the founder approves is what gets built.
 * ============================================================ */

/** Monday-first, matching the composer's M T W T F S S chips. */
export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const WEEKDAY_CHIPS = ["M", "T", "W", "T", "F", "S", "S"] as const;

export interface RunSession {
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  skipped: boolean;
  /**
   * Zero-based position among the sessions that actually run, so lesson N maps
   * to the Nth kept date. -1 for a skipped date, which teaches nothing.
   */
  lessonIndex: number;
}

function toParts(date: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function toUtc(date: string): number | null {
  const parts = toParts(date);
  if (!parts) return null;
  const stamp = Date.UTC(parts.y, parts.m - 1, parts.d);
  const back = new Date(stamp);
  // Rejects impossible calendar dates like 2026-02-30, which Date.UTC rolls over.
  if (back.getUTCFullYear() !== parts.y || back.getUTCMonth() !== parts.m - 1 || back.getUTCDate() !== parts.d) {
    return null;
  }
  return stamp;
}

function fromUtc(stamp: number): string {
  const d = new Date(stamp);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function isValidCalendarDate(date: string): boolean {
  return toUtc(date) !== null;
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayOf(date: string): number {
  const stamp = toUtc(date);
  if (stamp === null) return 0;
  return (new Date(stamp).getUTCDay() + 6) % 7;
}

export function addDays(date: string, days: number): string {
  const stamp = toUtc(date);
  if (stamp === null) return date;
  return fromUtc(stamp + days * 24 * 60 * 60 * 1000);
}

/**
 * The next occurrence of `weekday` strictly after `after`.
 *
 * Strictly after, not on-or-after: a class posted today should not offer to
 * start in a few hours, and the composer's default first date is meant to be
 * the next real one.
 */
export function nextWeekdayAfter(after: string, weekday: number): string {
  const start = toUtc(after);
  if (start === null) return after;
  for (let offset = 1; offset <= 7; offset += 1) {
    const candidate = fromUtc(start + offset * 24 * 60 * 60 * 1000);
    if (weekdayOf(candidate) === weekday) return candidate;
  }
  return after;
}

/**
 * Build the run.
 *
 * A skipped date does not shorten the course — it pushes the run later, so a
 * six-lesson course still delivers six sessions after a holiday is struck out.
 * That is the whole reason this is not a simple "first date + N weeks" loop.
 *
 * The `+ 12` ceiling stops a pathological skip list (every candidate struck)
 * from looping forever; in practice a run never approaches it.
 */
export function buildRun(options: {
  firstDate: string;
  weeks: number;
  skipped?: string[];
  intervalDays?: number;
}): RunSession[] {
  const { firstDate, weeks } = options;
  const interval = options.intervalDays ?? 7;
  const skipped = new Set(options.skipped ?? []);
  if (!isValidCalendarDate(firstDate) || weeks < 1) return [];

  const rows: RunSession[] = [];
  let kept = 0;
  let step = 0;
  const ceiling = weeks + 12;

  while (kept < weeks && step < ceiling) {
    const date = addDays(firstDate, step * interval);
    const isSkipped = skipped.has(date);
    rows.push({ date, skipped: isSkipped, lessonIndex: isSkipped ? -1 : kept });
    if (!isSkipped) kept += 1;
    step += 1;
  }

  return rows;
}

/** The dates that will actually become sessions. */
export function keptDates(run: RunSession[]): string[] {
  return run.filter((row) => !row.skipped).map((row) => row.date);
}

function formatShort(date: string): string {
  const stamp = toUtc(date);
  if (stamp === null) return date;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(stamp);
}

/** "12:00" -> "12 PM", "18:30" -> "6:30 PM". */
export function formatTime(value: string): string {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return value;
  const hour = Number(match[1]);
  const minute = match[2];
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}${minute === "00" ? "" : `:${minute}`} ${suffix}`;
}

/**
 * The human-readable line that is the source of truth users see:
 * "6 sessions · Tue Sep 15 → Oct 27 · 6:30–7:15 PM".
 */
export function runSummary(run: RunSession[], startTime: string, endTime: string): string {
  const kept = keptDates(run);
  if (kept.length === 0) return "No sessions yet";
  const day = WEEKDAY_LABELS[weekdayOf(kept[0])];
  const first = formatShort(kept[0]);
  const last = formatShort(kept[kept.length - 1]);
  const window = `${formatTime(startTime).replace(/ (AM|PM)$/, "")}–${formatTime(endTime)}`;
  return `${kept.length} session${kept.length === 1 ? "" : "s"} · ${day} ${first} → ${last} · ${window}`;
}

/**
 * "5–8" when contiguous, "5, 7" when not — the bare range.
 *
 * `programs.grade_range` holds this form, because every public surface renders
 * it as "Grades {gradeRange}"; storing the word too produces "Grades Grades 5–8".
 */
export function gradeRangeValue(grades: number[]): string | null {
  const sorted = [...new Set(grades)].sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return String(sorted[0]);
  const contiguous = sorted[sorted.length - 1] - sorted[0] === sorted.length - 1;
  return contiguous ? `${sorted[0]}–${sorted[sorted.length - 1]}` : sorted.join(", ");
}

/** "Grades 5–8" — the same range written the way a person says it. */
export function gradeRangeLabel(grades: number[]): string | null {
  const sorted = [...new Set(grades)].sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return `Grade ${sorted[0]}`;
  const contiguous = sorted[sorted.length - 1] - sorted[0] === sorted.length - 1;
  return contiguous ? `Grades ${sorted[0]}–${sorted[sorted.length - 1]}` : `Grades ${sorted.join(", ")}`;
}
