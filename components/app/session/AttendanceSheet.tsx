"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ds";
import { recordAttendance, submitSessionReport } from "@/app/actions/classes";
import type { AttendanceStatus } from "@/lib/session-evidence";
import {
  attendanceSummary,
  resolveSheetAction,
  SHEET_STATUS_FULL,
  SHEET_STATUS_LABEL,
  SHEET_STATUS_ORDER,
  type AttendanceLock,
  type SheetStudent,
} from "@/lib/session-sheet-shared";

/**
 * Attendance, notes and Complete Session — the working half of the sheet.
 *
 * The common case is that everyone turned up, so it takes one tap: "Mark
 * everyone here" fills the rows nobody has touched, then the instructor
 * corrects the two who are not. It never overwrites a mark already made,
 * because the whole point of the button is speed, not surprise.
 *
 * Order is enforced by the server — a report cannot finalize until every
 * rostered student has a mark — so the sheet shows one button at a time in
 * that order rather than two that compete.
 */
export default function AttendanceSheet({
  sessionId,
  roster,
  lock,
  notes: initialNotes,
  flagged: initialFlagged,
  flagReason: initialFlagReason,
  finalized: initialFinalized,
  reportedAt,
}: {
  sessionId: string;
  roster: SheetStudent[];
  lock: AttendanceLock;
  notes: string;
  flagged: boolean;
  flagReason: string;
  finalized: boolean;
  reportedAt: number | null;
}) {
  const router = useRouter();

  const [marks, setMarks] = useState<Record<string, AttendanceStatus | null>>(() =>
    Object.fromEntries(roster.map((student) => [student.studentId, student.status])),
  );
  const [versions, setVersions] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(roster.map((student) => [student.studentId, student.recordedAt])),
  );
  /** True once the current marks differ from what is saved on the server. */
  const [dirty, setDirty] = useState(false);
  const [notes, setNotes] = useState(initialNotes);
  const [flagged, setFlagged] = useState(initialFlagged);
  const [flagReason, setFlagReason] = useState(initialFlagReason);
  const [finalized, setFinalized] = useState(initialFinalized);
  const [reportVersion, setReportVersion] = useState<number | null>(reportedAt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const pending = useRef(false);

  const marked = useMemo(() => roster.filter((s) => marks[s.studentId]).length, [roster, marks]);
  const unmarked = roster.length - marked;
  const summary = useMemo(() => attendanceSummary(roster.map((s) => marks[s.studentId] ?? null)), [roster, marks]);
  const flagReasonReady = !flagged || flagReason.trim().length >= 3;

  const action = resolveSheetAction({
    lock,
    marked,
    total: roster.length,
    dirty,
    finalized,
  });

  const editable = !lock.locked && !finalized && !busy;

  const setMark = (studentId: string, next: AttendanceStatus) => {
    setMarks((current) => ({ ...current, [studentId]: current[studentId] === next ? null : next }));
    setDirty(true);
    setStatus(null);
  };

  const markRemainingPresent = () => {
    setMarks((current) => {
      const next = { ...current };
      for (const student of roster) if (!next[student.studentId]) next[student.studentId] = "present";
      return next;
    });
    setDirty(true);
    setStatus(null);
  };

  const saveAttendance = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await recordAttendance(
        sessionId,
        roster.map((student) => ({
          studentId: student.studentId,
          status: marks[student.studentId] as AttendanceStatus,
          note: student.note,
          expectedRecordedAt: versions[student.studentId] ?? null,
        })),
      );
      if (result.ok) {
        if (result.recordedAtByStudent) setVersions((current) => ({ ...current, ...result.recordedAtByStudent }));
        setDirty(false);
        setStatus("Attendance saved.");
        router.refresh();
      } else {
        setError(result.error || "Attendance could not be saved.");
      }
    } catch {
      setError("Attendance could not be saved. Check your connection and try again.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  const saveReport = async (complete: boolean) => {
    if (pending.current) return;
    if (!flagReasonReady) {
      setError("Say what needs attention before flagging this session.");
      return;
    }
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await submitSessionReport(sessionId, {
        notes,
        flagged,
        flagReason,
        completed: complete,
        expectedReportedAt: reportVersion,
      });
      if (result.ok) {
        if (typeof result.reportedAt === "number") setReportVersion(result.reportedAt);
        if (complete) setFinalized(true);
        setStatus(complete ? "Session complete." : "Note saved.");
        router.refresh();
      } else {
        setError(result.error || "That could not be saved.");
      }
    } catch {
      setError("That could not be saved. Check your connection and try again.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="bow-sheet">
      <section aria-labelledby="sheet-roster">
        <div className="bow-sheet__section-head">
          <h2 id="sheet-roster" className="bow-sheet__heading">
            Who is here
          </h2>
          <span className="bow-sheet__count">{summary || `${roster.length} on the roster`}</span>
        </div>

        {lock.locked ? (
          <p className="bow-sheet__lock" role="status">
            {lock.label}
          </p>
        ) : unmarked > 0 ? (
          <div className="bow-sheet__quick">
            <Button variant="secondary" size="sm" onClick={markRemainingPresent} disabled={!editable}>
              {marked === 0 ? "Mark everyone here" : `Mark remaining ${unmarked} here`}
            </Button>
          </div>
        ) : null}

        {roster.length === 0 ? (
          <p className="bow-sheet__empty">
            No students are rostered for this session. A family who registers before it starts appears here
            automatically.
          </p>
        ) : (
          <ul className="bow-sheet__roster">
            {roster.map((student) => {
              const current = marks[student.studentId] ?? null;
              return (
                <li key={student.studentId} className="bow-sheet__student">
                  <span className="bow-sheet__name">
                    {student.name}
                    {student.grade ? <span className="bow-sheet__grade">Grade {student.grade}</span> : null}
                  </span>
                  <div className="bow-sheet__marks" role="group" aria-label={`Attendance for ${student.name}`}>
                    {SHEET_STATUS_ORDER.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className="bow-sheet__mark"
                        data-status={option}
                        data-selected={current === option ? "true" : undefined}
                        aria-pressed={current === option}
                        disabled={lock.locked || finalized || busy}
                        onClick={() => setMark(student.studentId, option)}
                      >
                        <span aria-hidden>{SHEET_STATUS_LABEL[option]}</span>
                        <span className="bow-sr-only">
                          {SHEET_STATUS_FULL[option]} — {student.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="sheet-notes">
        <h2 id="sheet-notes" className="bow-sheet__heading">
          Anything worth writing down
        </h2>
        <textarea
          id={`sheet-notes-${sessionId}`}
          className="bow-sheet__notes"
          rows={3}
          maxLength={4000}
          placeholder="How it went, who to follow up with. Optional."
          value={notes}
          disabled={finalized || busy}
          onChange={(event) => {
            setNotes(event.target.value);
            setStatus(null);
          }}
        />
        <label className="bow-sheet__flag">
          <input
            type="checkbox"
            checked={flagged}
            disabled={finalized || busy}
            onChange={(event) => {
              setFlagged(event.target.checked);
              setStatus(null);
            }}
          />
          Someone at BOW should look at this
        </label>
        {flagged ? (
          <>
            <label htmlFor={`sheet-flag-${sessionId}`} className="bow-sr-only">
              What needs attention
            </label>
            <input
              id={`sheet-flag-${sessionId}`}
              className="bow-sheet__flag-reason"
              maxLength={500}
              placeholder="What needs attention"
              value={flagReason}
              disabled={finalized || busy}
              onChange={(event) => {
                setFlagReason(event.target.value);
                setStatus(null);
              }}
            />
            {!flagReasonReady ? <p className="bow-sheet__hint">Add a few words so staff know what to look at.</p> : null}
          </>
        ) : null}
        {!finalized ? (
          <div className="bow-sheet__quick">
            <Button variant="secondary" size="sm" onClick={() => saveReport(false)} disabled={busy || !flagReasonReady}>
              Save note
            </Button>
          </div>
        ) : null}
      </section>

      {error ? (
        <p className="bow-sheet__error" role="alert">
          {error}
        </p>
      ) : null}
      {status ? (
        <p className="bow-sheet__ok" role="status" aria-live="polite">
          {status}
        </p>
      ) : null}

      <div className="bow-sheet__bar">
        <div className="bow-sheet__bar-inner">
          {action.hint ? <span className="bow-sheet__bar-hint">{action.hint}</span> : null}
          <Button
            variant="primary"
            full
            disabled={action.disabled || busy}
            onClick={
              action.kind === "save-attendance"
                ? saveAttendance
                : action.kind === "complete"
                  ? () => saveReport(true)
                  : undefined
            }
          >
            {busy ? "Saving…" : action.label}
          </Button>
        </div>
      </div>
    </div>
  );
}
