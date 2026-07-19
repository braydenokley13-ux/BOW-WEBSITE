"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button } from "@/components/ds";
import { recordSessionAttendance, registerForTrainingSession } from "@/app/actions/training";

interface Row {
  id: string;
  name: string;
  registered: boolean;
  attended: boolean | null;
  recordedAt: number | null;
}

export default function AttendanceGrid({
  sessionId,
  instructors,
  canRecordAttendance,
}: {
  sessionId: string;
  instructors: Row[];
  canRecordAttendance: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [attendanceVersions, setAttendanceVersions] = useState<Record<string, number | null>>(
    Object.fromEntries(instructors.map((instructor) => [instructor.id, instructor.recordedAt])),
  );
  const inFlight = useRef(false);

  const run = async (
    instructorId: string,
    action: () => Promise<{ ok: boolean; error?: string; recordedAt?: number }>,
    success: string,
  ) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusyId(instructorId);
    setError(null);
    setStatus(null);
    try {
      const result = await action();
      if (!result.ok) {
        setError(result.error || "The training record could not be updated.");
        return;
      }
      if (typeof result.recordedAt === "number") {
        setAttendanceVersions((current) => ({ ...current, [instructorId]: result.recordedAt ?? null }));
      }
      setStatus(success);
      router.refresh();
    } catch {
      setError("The training record could not be confirmed. Check your connection and try again.");
    } finally {
      inFlight.current = false;
      setBusyId(null);
    }
  };

  if (instructors.length === 0) {
    return <p style={{ fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-slate)" }}>No instructors to show.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {!canRecordAttendance && (
        <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 13, color: "var(--bow-slate)" }}>
          Rostering is open. Attendance controls will unlock when this session starts.
        </p>
      )}
      {error && <p role="alert" style={{ fontFamily: "var(--font-data)", fontSize: 12.5, color: "var(--bow-negative)" }}>{error}</p>}
      {status && <p role="status" aria-live="polite" style={{ fontFamily: "var(--font-data)", fontSize: 12.5, color: "var(--bow-positive)" }}>{status}</p>}
      {instructors.map((i) => (
        <div
          key={i.id}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "10px 0",
            borderBottom: "1px solid var(--border-rule)",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-ink)" }}>{i.name}</span>
            {i.registered && <Badge status="info">Registered</Badge>}
            {!i.registered && <Badge status="neutral">Not rostered</Badge>}
            {i.attended === true && <Badge status="positive">Attended</Badge>}
            {i.attended === false && <Badge status="negative">Absent</Badge>}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {!i.registered ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={busyId !== null}
                onClick={() => run(i.id, () => registerForTrainingSession(sessionId, i.id), `${i.name} added to the roster.`)}
              >
                {busyId === i.id ? "Adding…" : "Add to roster"}
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  variant={i.attended === true ? "primary" : "secondary"}
                  aria-pressed={i.attended === true}
                  disabled={busyId !== null || !canRecordAttendance}
                  onClick={() => run(
                    i.id,
                    () => recordSessionAttendance(sessionId, i.id, true, attendanceVersions[i.id] ?? null),
                    `${i.name} marked attended.`,
                  )}
                >
                  {busyId === i.id ? "Saving…" : "Attended"}
                </Button>
                <Button
                  size="sm"
                  variant={i.attended === false ? "primary" : "secondary"}
                  aria-pressed={i.attended === false}
                  disabled={busyId !== null || !canRecordAttendance}
                  onClick={() => run(
                    i.id,
                    () => recordSessionAttendance(sessionId, i.id, false, attendanceVersions[i.id] ?? null),
                    `${i.name} marked absent.`,
                  )}
                >
                  {busyId === i.id ? "Saving…" : "Absent"}
                </Button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
