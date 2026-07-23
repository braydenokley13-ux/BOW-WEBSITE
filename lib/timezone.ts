/**
 * Browser-safe timezone helpers for BOW's multi-city delivery records.
 *
 * A `datetime-local` input contains no offset. Converting it with `new Date()`
 * would silently use the operator's laptop timezone, which is wrong whenever
 * that operator schedules work in another city. These helpers resolve the
 * wall-clock time against the operating record's explicit IANA timezone.
 */

export const DEFAULT_TIME_ZONE = "America/New_York";

export const COMMON_TIME_ZONES = [
  { value: "America/New_York", label: "Eastern — America/New_York" },
  { value: "America/Chicago", label: "Central — America/Chicago" },
  { value: "America/Denver", label: "Mountain — America/Denver" },
  { value: "America/Phoenix", label: "Arizona — America/Phoenix" },
  { value: "America/Los_Angeles", label: "Pacific — America/Los_Angeles" },
  { value: "America/Anchorage", label: "Alaska — America/Anchorage" },
  { value: "Pacific/Honolulu", label: "Hawaii — Pacific/Honolulu" },
  { value: "UTC", label: "UTC" },
] as const;

export function isValidTimeZone(value: unknown): value is string {
  const timeZone = typeof value === "string" ? value.trim() : "";
  if (!timeZone || timeZone.length > 100) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(0);
    return true;
  } catch {
    return false;
  }
}

interface WallClockParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function partsAt(formatter: Intl.DateTimeFormat, epoch: number): WallClockParts {
  const values: Record<string, number> = {};
  for (const part of formatter.formatToParts(new Date(epoch))) {
    if (["year", "month", "day", "hour", "minute", "second"].includes(part.type)) {
      values[part.type] = Number(part.value);
    }
  }
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function sameWallClock(left: WallClockParts, right: WallClockParts): boolean {
  return left.year === right.year
    && left.month === right.month
    && left.day === right.day
    && left.hour === right.hour
    && left.minute === right.minute
    && left.second === right.second;
}

export type LocalDateTimeResolution =
  | { ok: true; epoch: number; localDate: string; timeZone: string }
  | { ok: false; error: string };

export function localDateTimeToEpoch(
  localDateTime: unknown,
  requestedTimeZone: unknown,
): LocalDateTimeResolution {
  const value = typeof localDateTime === "string" ? localDateTime.trim() : "";
  const timeZone = typeof requestedTimeZone === "string" ? requestedTimeZone.trim() : "";
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return { ok: false, error: "Choose a valid local date and time." };
  if (!isValidTimeZone(timeZone)) return { ok: false, error: "Choose a valid IANA timezone." };

  const target: WallClockParts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? 0),
  };
  const targetUtc = Date.UTC(
    target.year,
    target.month - 1,
    target.day,
    target.hour,
    target.minute,
    target.second,
  );
  const calendarCheck = new Date(targetUtc);
  if (
    calendarCheck.getUTCFullYear() !== target.year
    || calendarCheck.getUTCMonth() + 1 !== target.month
    || calendarCheck.getUTCDate() !== target.day
    || target.hour > 23
    || target.minute > 59
    || target.second > 59
  ) {
    return { ok: false, error: "Choose a real calendar date and time." };
  }

  const formatter = new Intl.DateTimeFormat("en-CA-u-hc-h23", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const probeDistance = 12 * 60 * 60 * 1000;
  const offsets = new Set<number>();
  for (const multiplier of [-3, -1, 0, 1, 3]) {
    const probe = targetUtc + multiplier * probeDistance;
    const local = partsAt(formatter, probe);
    const renderedAsUtc = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      local.second,
    );
    offsets.add(renderedAsUtc - Math.trunc(probe / 1000) * 1000);
  }

  const candidates = [...offsets]
    .map((offset) => targetUtc - offset)
    .filter((candidate, index, all) => all.indexOf(candidate) === index)
    .filter((candidate) => sameWallClock(partsAt(formatter, candidate), target))
    .sort((left, right) => left - right);

  if (candidates.length === 0) {
    return {
      ok: false,
      error: "That local time does not exist in this timezone because of a daylight-saving change. Choose a different time.",
    };
  }
  if (candidates.length > 1) {
    return {
      ok: false,
      error: "That local time occurs twice in this timezone because of a daylight-saving change. Choose a time outside the repeated hour.",
    };
  }
  return { ok: true, epoch: candidates[0], localDate: value.slice(0, 10), timeZone };
}

export type CanonicalDateResolution =
  | { ok: true; canonicalDate: string; epoch: number }
  | { ok: false; error: string };

/**
 * Validate a true calendar date and adapt it to legacy INTEGER columns.
 *
 * The canonical value stays `YYYY-MM-DD` through every client/server boundary.
 * Compatibility INTEGER columns still require an epoch, so the storage
 * adapter also anchors the date at 12:00 UTC. Canonical database columns store
 * the returned YYYY-MM-DD value directly; the epoch must never be treated as
 * the exact instant at which a date-only obligation expires.
 */
export function canonicalDateToUtcNoon(value: unknown): CanonicalDateResolution {
  const canonicalDate = typeof value === "string" ? value.trim() : "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(canonicalDate);
  if (!match) return { ok: false, error: "Choose a valid calendar date." };

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const epoch = Date.UTC(year, month - 1, day, 12, 0, 0, 0);
  const calendarCheck = new Date(epoch);
  if (
    calendarCheck.getUTCFullYear() !== year
    || calendarCheck.getUTCMonth() + 1 !== month
    || calendarCheck.getUTCDate() !== day
  ) {
    return { ok: false, error: "Choose a real calendar date." };
  }

  return { ok: true, canonicalDate, epoch };
}

export function formatDateTimeInZone(
  epoch: number | string,
  timeZone: string | null | undefined,
): string {
  // Some drivers/paths return bigint columns as strings; coerce before
  // validating so a numeric string doesn't fall through as "Invalid date".
  const numericEpoch = typeof epoch === "string" ? Number(epoch) : epoch;
  if (!Number.isFinite(numericEpoch)) return "Invalid date";
  const normalizedTimeZone = typeof timeZone === "string" ? timeZone.trim() : "";
  // Legacy rows predate timezone persistence. Render those in one declared
  // BOW operating zone instead of whichever device/server happens to read it.
  const displayTimeZone = isValidTimeZone(normalizedTimeZone) ? normalizedTimeZone : DEFAULT_TIME_ZONE;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: displayTimeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(numericEpoch));
}

export function canonicalDateInZone(
  epoch: number = Date.now(),
  timeZone: string = DEFAULT_TIME_ZONE,
): string {
  const displayTimeZone = isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: displayTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(epoch));
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

export function formatCanonicalDate(value: string | null | undefined): string {
  const resolution = canonicalDateToUtcNoon(value);
  if (!resolution.ok) return "Invalid date";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(resolution.epoch));
}

/** Shift a canonical calendar date without crossing through a local timezone. */
export function addCanonicalDays(value: string, days: number): string {
  const resolution = canonicalDateToUtcNoon(value);
  if (!resolution.ok || !Number.isSafeInteger(days)) throw new RangeError("A valid canonical date and whole-day offset are required.");
  return new Date(resolution.epoch + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * Shift a canonical date by calendar years. February 29 lands on February 28
 * when the target year is not a leap year.
 */
export function addCanonicalYears(value: string, years: number): string {
  const resolution = canonicalDateToUtcNoon(value);
  if (!resolution.ok || !Number.isSafeInteger(years)) throw new RangeError("A valid canonical date and whole-year offset are required.");
  const source = new Date(resolution.epoch);
  const targetYear = source.getUTCFullYear() + years;
  const targetMonth = source.getUTCMonth();
  const lastTargetDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0, 12)).getUTCDate();
  return new Date(Date.UTC(targetYear, targetMonth, Math.min(source.getUTCDate(), lastTargetDay), 12))
    .toISOString()
    .slice(0, 10);
}
