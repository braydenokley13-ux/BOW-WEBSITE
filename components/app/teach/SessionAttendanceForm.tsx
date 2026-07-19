"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { Button } from "@/components/ds";
import { recordAttendance, submitSessionReport } from "@/app/actions/classes";
import type { AttendanceStatus } from "@/lib/session-evidence";

const inputStyle: CSSProperties = {
  background: "var(--bow-paper)",
  border: "1px solid var(--border-rule)",
  color: "var(--bow-ink)",
  padding: "10px 12px",
  fontFamily: "var(--font-interface)",
  fontSize: 14,
  width: "100%",
  borderRadius: 4,
};

interface StudentRow {
  id: string;
  name: string;
  status: AttendanceStatus | null;
  note: string;
  recordedAt: number | null;
}

export default function SessionAttendanceForm({
  sessionId,
  sessionStartsAt,
  students,
  reportNotes,
  reportFlagged,
  reportFlagReason,
  reportCompleted,
  reportReportedAt,
}: {
  sessionId: string;
  sessionStartsAt: number;
  students: StudentRow[];
  reportNotes: string;
  reportFlagged: boolean;
  reportFlagReason: string;
  reportCompleted: boolean;
  reportReportedAt: number | null;
}) {
  const router = useRouter();
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus | null>>(
    Object.fromEntries(students.map((s) => [s.id, s.status])),
  );
  const [attendanceNotes, setAttendanceNotes] = useState<Record<string, string>>(
    Object.fromEntries(students.map((s) => [s.id, s.note])),
  );
  const [attendanceVersions, setAttendanceVersions] = useState<Record<string, number | null>>(
    Object.fromEntries(students.map((s) => [s.id, s.recordedAt])),
  );
  const [notes, setNotes] = useState(reportNotes);
  const [flagged, setFlagged] = useState(reportFlagged);
  const [flagReason, setFlagReason] = useState(reportFlagReason);
  const [completed, setCompleted] = useState(reportCompleted);
  const [finalized, setFinalized] = useState(reportCompleted);
  const [reportVersion, setReportVersion] = useState<number | null>(reportReportedAt);
  const [busy, setBusy] = useState(false);
  const mutationPendingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [attendanceSaved, setAttendanceSaved] = useState(
    students.length > 0 && students.every((student) => student.status !== null),
  );
  const attendanceComplete = students.length > 0 && students.every((student) => attendance[student.id] !== null);
  const flagReasonReady = !flagged || flagReason.trim().length >= 3;
  const [sessionStarted, setSessionStarted] = useState(
    () => Number.isFinite(sessionStartsAt) && sessionStartsAt <= Date.now(),
  );

  useEffect(() => {
    if (!Number.isFinite(sessionStartsAt)) return;
    let timeoutId: number | undefined;
    const scheduleUnlock = () => {
      const remaining = sessionStartsAt - Date.now();
      if (remaining <= 0) {
        setSessionStarted(true);
        return;
      }
      timeoutId = window.setTimeout(scheduleUnlock, Math.min(remaining + 50, 2_147_000_000));
    };
    scheduleUnlock();
    return () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [sessionStartsAt]);

  const saveAttendance = async () => {
    if (mutationPendingRef.current) return;
    if (!attendanceComplete) {
      setError("Choose an attendance status for every rostered student before saving.");
      return;
    }
    mutationPendingRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await recordAttendance(
        sessionId,
        students.map((student) => ({
          studentId: student.id,
          status: attendance[student.id] as AttendanceStatus,
          note: attendanceNotes[student.id] ?? "",
          expectedRecordedAt: attendanceVersions[student.id] ?? null,
        })),
      );
      if (res.ok) {
        if (res.recordedAtByStudent) {
          setAttendanceVersions((current) => ({ ...current, ...res.recordedAtByStudent }));
        }
        setSaved(true);
        setAttendanceSaved(true);
        router.refresh();
      } else {
        setError(res.error || "Something went wrong.");
      }
    } catch {
      setError("Attendance could not be saved. Refresh and try again.");
    } finally {
      mutationPendingRef.current = false;
      setBusy(false);
    }
  };

  const saveReport = async () => {
    if (mutationPendingRef.current) return;
    if (completed && !attendanceSaved) {
      setError("Save complete attendance before finalizing this session.");
      return;
    }
    if (!flagReasonReady) {
      setError("Explain why this session needs staff attention before submitting the report.");
      return;
    }
    mutationPendingRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await submitSessionReport(sessionId, {
        notes,
        flagged,
        flagReason,
        completed,
        expectedReportedAt: reportVersion,
      });
      if (res.ok) {
        if (typeof res.reportedAt === "number") setReportVersion(res.reportedAt);
        if (completed) setFinalized(true);
        setSaved(true);
        router.refresh();
      } else {
        setError(res.error || "Something went wrong.");
      }
    } catch {
      setError("The session report could not be saved. Refresh and try again.");
    } finally {
      mutationPendingRef.current = false;
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {finalized && (
        <div className="ops-alert" data-tone="info">
          <span className="ops-alert__title">Session finalized</span>
          <p className="ops-body" style={{ marginTop: 4 }}>Attendance and the report are locked. Contact an administrator if a historical correction is required.</p>
        </div>
      )}
      {!finalized && !sessionStarted && (
        <div className="ops-alert" data-tone="info">
          <span className="ops-alert__title">Session has not started</span>
          <p className="ops-body" style={{ marginTop: 4 }}>Attendance and final reporting unlock at the scheduled start time.</p>
        </div>
      )}
      <div>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 10 }}>
          Attendance
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {students.map((s) => (
            <div key={s.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, fontFamily: "var(--font-interface)", fontSize: 14 }}>
              <span style={{ flex: "1 1 140px", minWidth: 0 }}>{s.name}</span>
              <select
                aria-label={`Attendance for ${s.name}`}
                disabled={finalized || !sessionStarted || busy}
                value={attendance[s.id] ?? ""}
                onChange={(event) => {
                  const value = event.target.value === "" ? null : event.target.value as AttendanceStatus;
                  setAttendance((current) => ({ ...current, [s.id]: value }));
                  setAttendanceSaved(false);
                  setSaved(false);
                }}
                style={{ ...inputStyle, padding: "8px 10px", flex: "1 1 150px", minWidth: 0, maxWidth: 220 }}
              >
                <option value="">Not recorded</option>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="late">Late</option>
                <option value="excused">Excused</option>
              </select>
              <input
                aria-label={`Optional attendance note for ${s.name}`}
                className="bow-field"
                disabled={finalized || !sessionStarted || busy}
                maxLength={500}
                placeholder="Optional note"
                value={attendanceNotes[s.id] ?? ""}
                onChange={(event) => {
                  setAttendanceNotes((current) => ({ ...current, [s.id]: event.target.value }));
                  setAttendanceSaved(false);
                  setSaved(false);
                }}
                style={{ ...inputStyle, padding: "8px 10px", flex: "2 1 220px", minWidth: 0 }}
              />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10 }}>
          <Button size="sm" variant="secondary" disabled={busy || finalized || !sessionStarted || students.length === 0 || !attendanceComplete} onClick={saveAttendance}>
            {busy ? "Saving…" : "Save Attendance"}
          </Button>
        </div>
        {!finalized && students.length > 0 && !attendanceComplete && (
          <p className="ops-body" style={{ marginTop: 8 }}>Choose present, absent, late, or excused for every student. Nothing is assumed automatically.</p>
        )}
      </div>

      <div>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 10 }}>
          Session report
        </span>
        <label htmlFor={`session-notes-${sessionId}`} style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 6 }}>Delivery notes</label>
        <textarea id={`session-notes-${sessionId}`} rows={4} maxLength={4000} disabled={finalized || !sessionStarted || busy} style={{ ...inputStyle, resize: "vertical", marginBottom: 10 }} placeholder="Notes" value={notes} onChange={(e) => { setNotes(e.target.value); setSaved(false); }} />
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-interface)", fontSize: 13, marginBottom: 8 }}>
          <input type="checkbox" disabled={finalized || !sessionStarted || !attendanceSaved || busy} checked={completed} onChange={(e) => { setCompleted(e.target.checked); setSaved(false); }} />
          Session completed
        </label>
        {!finalized && !attendanceSaved && (
          <p className="ops-body" style={{ margin: "0 0 10px" }}>Save attendance before marking the session complete.</p>
        )}
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-interface)", fontSize: 13, marginBottom: 8 }}>
          <input type="checkbox" disabled={finalized || !sessionStarted || busy} checked={flagged} onChange={(e) => { setFlagged(e.target.checked); setSaved(false); }} />
          Flag for staff attention
        </label>
        {flagged && (
          <>
            <label htmlFor={`session-flag-${sessionId}`} style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 6 }}>Reason for staff attention</label>
            <input id={`session-flag-${sessionId}`} maxLength={500} disabled={finalized || !sessionStarted || busy} style={{ ...inputStyle, marginBottom: 10 }} placeholder="Reason" value={flagReason} onChange={(e) => { setFlagReason(e.target.value); setSaved(false); }} />
            {!flagReasonReady && <p className="ops-body" style={{ margin: "-2px 0 10px" }}>Add at least three characters so staff know what needs attention.</p>}
          </>
        )}
        <Button size="sm" variant="primary" disabled={busy || finalized || !sessionStarted || (completed && !attendanceSaved) || !flagReasonReady} onClick={saveReport}>
          {busy ? "Saving…" : "Submit Report"}
        </Button>
      </div>

      {saved && <p role="status" aria-live="polite" style={{ margin: 0, fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-positive)" }}>Saved.</p>}
      {error && <p role="alert" style={{ margin: 0, fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-negative)" }}>{error}</p>}
    </div>
  );
}
