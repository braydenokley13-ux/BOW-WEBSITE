"use client";

import { useMemo } from "react";
import {
  WEEKDAY_CHIPS,
  WEEKDAY_LABELS,
  buildRun,
  formatTime,
  nextWeekdayAfter,
  runSummary,
  weekdayOf,
} from "@/lib/class-schedule";

interface Props {
  scheduleDay: number;
  startTime: string;
  endTime: string;
  firstDate: string | null;
  weeks: number;
  skipped: string[];
  /** Lesson titles, in order, so each date can show what it teaches. */
  lessonTitles: string[];
  error?: string | null;
  onChange: (patch: {
    scheduleDay?: number;
    startTime?: string;
    endTime?: string;
    firstDate?: string | null;
    weeks?: number;
    skipped?: string[];
  }) => void;
}

const chipBase: React.CSSProperties = {
  width: 38,
  height: 36,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "var(--radius-control)",
  fontFamily: "var(--font-data)",
  fontSize: 12.5,
  cursor: "pointer",
  userSelect: "none",
  background: "var(--bow-white)",
  border: "1px solid var(--border-rule)",
  color: "var(--bow-slate)",
};

const chipOn: React.CSSProperties = {
  ...chipBase,
  background: "var(--bow-blue)",
  border: "1px solid var(--bow-blue)",
  color: "var(--bow-white)",
  fontWeight: 600,
};

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shortDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
    .format(parsed)
    .toUpperCase();
}

/**
 * The schedule, composed rather than filled in.
 *
 * A day, a time, a first date and a number of weeks generate a visible list of
 * real dates. Striking a date out does not shorten the course — the run
 * extends, so six lessons still get six sessions after a holiday, and the list
 * says so in place rather than in a help article.
 */
export default function ScheduleComposer({
  scheduleDay,
  startTime,
  endTime,
  firstDate,
  weeks,
  skipped,
  lessonTitles,
  error,
  onChange,
}: Props) {
  const effectiveFirst = firstDate ?? nextWeekdayAfter(todayIso(), scheduleDay);
  const run = useMemo(
    () => buildRun({ firstDate: effectiveFirst, weeks, skipped }),
    [effectiveFirst, weeks, skipped],
  );
  const hasSkips = run.some((row) => row.skipped);

  const pickDay = (day: number) => {
    // Moving the day moves the whole run, so previously-struck dates no longer
    // refer to anything on the calendar.
    onChange({ scheduleDay: day, firstDate: nextWeekdayAfter(todayIso(), day), skipped: [] });
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-end" }}>
        {/* Grows to the column width so the seven chips always have room. */}
        <div style={{ flex: "1 1 240px", minWidth: 0 }}>
          <span
            style={{
              display: "block",
              marginBottom: 7,
              fontFamily: "var(--font-data)",
              fontSize: 10.5,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: "var(--bow-slate)",
            }}
          >
            Day
          </span>
          <div className="bow-day-chips" role="group" aria-label="Day of the week">
            {WEEKDAY_CHIPS.map((chip, index) => (
              <button
                key={`${chip}-${index}`}
                type="button"
                aria-label={WEEKDAY_LABELS[index]}
                aria-pressed={scheduleDay === index}
                onClick={() => pickDay(index)}
                style={{ ...(scheduleDay === index ? chipOn : chipBase), width: "auto" }}
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label
            htmlFor="composer-start"
            style={{
              display: "block",
              marginBottom: 7,
              fontFamily: "var(--font-data)",
              fontSize: 10.5,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: "var(--bow-slate)",
            }}
          >
            Time
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <input
              id="composer-start"
              type="time"
              value={startTime}
              onChange={(event) => onChange({ startTime: event.target.value })}
              style={{
                height: 36,
                padding: "0 9px",
                borderRadius: "var(--radius-control)",
                border: "1px solid var(--border-rule)",
                fontFamily: "var(--font-data)",
                fontSize: 13,
              }}
            />
            <span style={{ color: "var(--bow-slate)" }}>–</span>
            <input
              aria-label="End time"
              type="time"
              value={endTime}
              onChange={(event) => onChange({ endTime: event.target.value })}
              style={{
                height: 36,
                padding: "0 9px",
                borderRadius: "var(--radius-control)",
                border: "1px solid var(--border-rule)",
                fontFamily: "var(--font-data)",
                fontSize: 13,
              }}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="composer-first"
            style={{
              display: "block",
              marginBottom: 7,
              fontFamily: "var(--font-data)",
              fontSize: 10.5,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: "var(--bow-slate)",
            }}
          >
            First session
          </label>
          <input
            id="composer-first"
            type="date"
            value={effectiveFirst}
            onChange={(event) => {
              const next = event.target.value;
              if (!next) return;
              // The day chips follow the date a person actually picked, rather
              // than arguing with them about which weekday it is.
              onChange({ firstDate: next, scheduleDay: weekdayOf(next), skipped: [] });
            }}
            style={{
              height: 36,
              padding: "0 9px",
              borderRadius: "var(--radius-control)",
              border: "1px solid var(--border-rule)",
              fontFamily: "var(--font-data)",
              fontSize: 13,
            }}
          />
        </div>

        <div>
          <span
            style={{
              display: "block",
              marginBottom: 7,
              fontFamily: "var(--font-data)",
              fontSize: 10.5,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: "var(--bow-slate)",
            }}
          >
            Sessions
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              type="button"
              aria-label="One fewer session"
              onClick={() => onChange({ weeks: Math.max(1, weeks - 1) })}
              style={{ ...chipBase, width: 34, color: "var(--bow-ink)" }}
            >
              −
            </button>
            <span
              aria-live="polite"
              style={{
                minWidth: 74,
                textAlign: "center",
                fontFamily: "var(--font-data)",
                fontSize: 12.5,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: "var(--bow-ink)",
              }}
            >
              {weeks} weeks
            </span>
            <button
              type="button"
              aria-label="One more session"
              onClick={() => onChange({ weeks: Math.min(16, weeks + 1) })}
              style={{ ...chipBase, width: 34, color: "var(--bow-ink)" }}
            >
              +
            </button>
          </div>
          {lessonTitles.length > 0 ? (
            <span style={{ display: "block", marginTop: 6, fontSize: 12, color: "var(--bow-slate)" }}>
              {weeks === lessonTitles.length
                ? `matches the ${lessonTitles.length} lessons`
                : `${lessonTitles.length} lessons — extra sessions run open`}
            </span>
          ) : null}
        </div>
      </div>

      {error ? (
        <p role="alert" style={{ margin: "12px 0 0", fontSize: 13, color: "var(--bow-negative)" }}>
          {error}
        </p>
      ) : null}

      <p
        style={{
          margin: "18px 0 8px",
          fontFamily: "var(--font-data)",
          fontSize: 11.5,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: "var(--bow-ink)",
          fontWeight: 600,
        }}
      >
        {runSummary(run, startTime, endTime)}
      </p>

      <ul style={{ listStyle: "none", margin: 0, padding: 0, border: "1px solid var(--border-rule)", borderRadius: "var(--radius-card)" }}>
        {run.map((row, index) => {
          const lesson = row.skipped ? null : lessonTitles[row.lessonIndex] ?? null;
          return (
            <li
              key={row.date}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "9px 14px",
                borderTop: index === 0 ? "none" : "1px solid var(--border-rule)",
                background: "var(--bow-white)",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-data)",
                  fontSize: 12,
                  letterSpacing: "0.04em",
                  minWidth: 62,
                  color: row.skipped ? "var(--bow-inactive)" : "var(--bow-ink)",
                  textDecoration: row.skipped ? "line-through" : "none",
                }}
              >
                {shortDate(row.date)}
              </span>
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 13,
                  color: row.skipped ? "var(--bow-inactive)" : "var(--bow-slate)",
                }}
              >
                {row.skipped
                  ? "Skipped"
                  : lesson
                    ? `L${row.lessonIndex + 1} · ${lesson}`
                    : `Session ${row.lessonIndex + 1}`}
              </span>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    skipped: row.skipped
                      ? skipped.filter((date) => date !== row.date)
                      : [...skipped, row.date],
                  })
                }
                style={{
                  background: "none",
                  border: "none",
                  padding: "4px 6px",
                  cursor: "pointer",
                  fontFamily: "var(--font-data)",
                  fontSize: 10.5,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--bow-blue)",
                }}
              >
                {row.skipped ? "Undo" : "Skip"}
              </button>
            </li>
          );
        })}
      </ul>

      {hasSkips ? (
        <p style={{ margin: "9px 0 0", fontSize: 12.5, color: "var(--bow-slate)" }}>
          Skipped dates push the run later, so you still get {weeks} session{weeks === 1 ? "" : "s"}.
        </p>
      ) : null}

      <p className="bow-sr-only" aria-live="polite">
        {runSummary(run, startTime, endTime)} starting at {formatTime(startTime)}
      </p>
    </div>
  );
}
