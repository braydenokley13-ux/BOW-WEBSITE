"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { Badge, Button, Modal } from "@/components/ds";
import { assignInstructorToClass, removeInstructorFromClass, updateClassStatus, createClassSession } from "@/app/actions/classes";
import { enrollStudent, withdrawEnrollment } from "@/app/actions/students";
import { COMMON_TIME_ZONES } from "@/lib/timezone";

const inputStyle: CSSProperties = {
  background: "var(--bow-paper)",
  border: "1px solid var(--border-rule)",
  color: "var(--bow-ink)",
  padding: "10px 12px",
  fontFamily: "var(--font-interface)",
  fontSize: 14,
  width: "100%",
  borderRadius: 4,
  marginBottom: 12,
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  planning: ["staffing", "cancelled"],
  staffing: ["ready_to_launch", "paused", "cancelled"],
  ready_to_launch: ["active", "staffing", "paused", "cancelled"],
  active: ["paused", "completed"],
  paused: ["active", "completed", "cancelled"],
  completed: [],
  cancelled: [],
};

interface EligibleInstructor {
  id: string;
  name: string;
}

interface StudentOption {
  id: string;
  name: string;
  enrolled: boolean;
}

interface Props {
  classId: string;
  programId: string | null;
  status: string;
  eligibleInstructors: EligibleInstructor[];
  assignedInstructorIds: string[];
  students: StudentOption[];
  capacity: number | null;
  enrolledCount: number;
  scheduleTimezone: string | null;
}

export default function ClassDetailActions({ classId, programId, status, eligibleInstructors, assignedInstructorIds, students, capacity, enrolledCount, scheduleTimezone }: Props) {
  const router = useRouter();
  const [modal, setModal] = useState<null | "assign" | "session" | "enroll" | "status">(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pickedInstructor, setPickedInstructor] = useState(eligibleInstructors[0]?.id ?? "");
  const [pickedRole, setPickedRole] = useState<"lead" | "additional">("lead");
  const [sessionDate, setSessionDate] = useState("");
  const [sessionTimeZone, setSessionTimeZone] = useState(scheduleTimezone ?? "");
  const [sessionLocation, setSessionLocation] = useState("");
  const [pickedStudent, setPickedStudent] = useState(students.find((s) => !s.enrolled)?.id ?? "");
  const [statusTarget, setStatusTarget] = useState("");
  const [statusReason, setStatusReason] = useState("");

  const refresh = () => {
    setModal(null);
    setBusy(false);
    setStatusTarget("");
    setStatusReason("");
    router.refresh();
  };

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      if (res.ok) refresh();
      else {
        setError(res.error || "Something went wrong.");
        setBusy(false);
      }
    } catch {
      setError("The operation could not be completed. Refresh and try again.");
      setBusy(false);
    }
  };

  const full = !!capacity && capacity > 0 && enrolledCount >= capacity;
  const unenrolledStudents = students.filter((s) => !s.enrolled);
  const terminal = status === "completed" || status === "cancelled";
  const statusTransitions = STATUS_TRANSITIONS[status] ?? [];
  const requestStatusChange = (nextStatus: string) => {
    if (["paused", "completed", "cancelled"].includes(nextStatus)) {
      setStatusTarget(nextStatus);
      setStatusReason("");
      setError(null);
      setModal("status");
      return;
    }
    void run(() => updateClassStatus(classId, nextStatus));
  };

  return (
    <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 22 }}>
      <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 12 }}>
        Actions
      </span>

      {programId ? (
        <div className="ops-alert" data-tone="info" style={{ marginBottom: 14 }}>
          <span className="ops-alert__title">Shared plan controlled by Program</span>
          <p className="ops-body" style={{ marginTop: 4 }}>The launch room owns staffing and shared planning. Delivery pause, completion, and cancellation remain available here with an audited reason.</p>
          <div style={{ marginTop: 10 }}><Button href={`/app/programs/${programId}`} size="sm" variant="secondary">Open Program Launch Room</Button></div>
        </div>
      ) : null}
      {statusTransitions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          {statusTransitions.map((nextStatus) => (
            <Button
              key={nextStatus}
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => requestStatusChange(nextStatus)}
            >
              Move to {nextStatus.replace(/_/g, " ")}
            </Button>
          ))}
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Button size="sm" variant="secondary" onClick={() => setModal("assign")} disabled={Boolean(programId) || eligibleInstructors.length === 0}>
          Assign Instructor
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setModal("session")} disabled={terminal}>
          Schedule Session
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setModal("enroll")} disabled={terminal || full || unenrolledStudents.length === 0}>
          Enroll Student
        </Button>
      </div>
      {full && <p style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-negative)", marginTop: 8 }}>Class is at capacity.</p>}
      {error && !modal && <p role="alert" style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-negative)", marginTop: 8 }}>{error}</p>}

      <Modal open={modal === "status"} onClose={() => setModal(null)} title={`Move Class to ${statusTarget.replace(/_/g, " ")}`} dismissible={!busy}>
        <label htmlFor="class-status-reason" style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 6 }}>Operational reason</label>
        <textarea id="class-status-reason" rows={4} style={{ ...inputStyle, resize: "vertical" }} value={statusReason} onChange={(event) => setStatusReason(event.target.value)} placeholder="What happened, and what should the next operator know?" />
        {error && <p role="alert" style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-negative)", margin: "0 0 10px" }}>{error}</p>}
        <Button variant="primary" size="sm" disabled={busy || statusReason.trim().length < 3} onClick={() => run(() => updateClassStatus(classId, statusTarget, statusReason))}>
          {busy ? "Saving…" : "Record decision"}
        </Button>
      </Modal>

      <Modal open={modal === "assign"} onClose={() => setModal(null)} title="Assign Instructor" dismissible={!busy}>
        <label htmlFor="class-instructor" style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 6 }}>Instructor</label>
        <select id="class-instructor" style={inputStyle} value={pickedInstructor} onChange={(e) => setPickedInstructor(e.target.value)}>
          {eligibleInstructors.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name} {assignedInstructorIds.includes(i.id) ? "(already assigned)" : ""}
            </option>
          ))}
        </select>
        <label htmlFor="class-instructor-role" style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 6 }}>Assignment role</label>
        <select id="class-instructor-role" style={inputStyle} value={pickedRole} onChange={(e) => setPickedRole(e.target.value as "lead" | "additional")}>
          <option value="lead">Lead</option>
          <option value="additional">Additional</option>
        </select>
        {error && <p role="alert" style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-negative)" }}>{error}</p>}
        <Button
          variant="primary"
          size="sm"
          disabled={busy || !pickedInstructor}
          onClick={() => run(() => assignInstructorToClass(classId, pickedInstructor, pickedRole))}
        >
          {busy ? "Saving…" : "Assign"}
        </Button>
      </Modal>

      <Modal open={modal === "session"} onClose={() => setModal(null)} title="Schedule Session" dismissible={!busy}>
        <label htmlFor="class-session-date" style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 6 }}>Session date and time</label>
        <input id="class-session-date" type="datetime-local" style={inputStyle} value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
        <label htmlFor="class-session-timezone" style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 6 }}>Delivery timezone</label>
        <input
          id="class-session-timezone"
          list="class-session-timezone-options"
          style={inputStyle}
          value={sessionTimeZone}
          onChange={(event) => setSessionTimeZone(event.target.value)}
          placeholder="America/New_York"
          readOnly={Boolean(scheduleTimezone)}
          autoComplete="off"
        />
        <datalist id="class-session-timezone-options">
          {COMMON_TIME_ZONES.map((timezone) => <option key={timezone.value} value={timezone.value}>{timezone.label}</option>)}
        </datalist>
        <p style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)", margin: "-4px 0 12px" }}>
          {scheduleTimezone ? `Class times are anchored to ${scheduleTimezone}.` : "The first session will set this Class's canonical timezone."}
        </p>
        <label htmlFor="class-session-location" style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 6 }}>Location (optional)</label>
        <input id="class-session-location" placeholder="Room, field, or meeting link" style={inputStyle} value={sessionLocation} onChange={(e) => setSessionLocation(e.target.value)} />
        {error && <p role="alert" style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-negative)" }}>{error}</p>}
        <Button
          variant="primary"
          size="sm"
          disabled={busy || !sessionDate || !sessionTimeZone.trim()}
          onClick={() =>
            run(() =>
              createClassSession(classId, {
                localDateTime: sessionDate,
                timeZone: sessionTimeZone,
                location: sessionLocation || undefined,
              }),
            )
          }
        >
          {busy ? "Saving…" : "Schedule"}
        </Button>
      </Modal>

      <Modal open={modal === "enroll"} onClose={() => setModal(null)} title="Enroll Student" dismissible={!busy}>
        <label htmlFor="class-enroll-student" style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 6 }}>Student</label>
        <select id="class-enroll-student" style={inputStyle} value={pickedStudent} onChange={(e) => setPickedStudent(e.target.value)}>
          {unenrolledStudents.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <Badge status="neutral" style={{ marginBottom: 12 }}>
          {enrolledCount}{capacity ? ` / ${capacity}` : ""} enrolled
        </Badge>
        {error && <p role="alert" style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-negative)" }}>{error}</p>}
        <div>
          <Button variant="primary" size="sm" disabled={busy || !pickedStudent} onClick={() => run(() => enrollStudent(classId, pickedStudent))}>
            {busy ? "Saving…" : "Enroll"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export function RemoveInstructorButton({ classId, instructorId }: { classId: string; instructorId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => { setReason(""); setError(null); setOpen(true); }}>
        Remove
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Remove Instructor" dismissible={!busy}>
        <label htmlFor={`remove-instructor-reason-${instructorId}`} style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 6 }}>Staffing decision reason</label>
        <textarea id={`remove-instructor-reason-${instructorId}`} rows={4} style={{ ...inputStyle, resize: "vertical" }} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why is this change necessary, and who owns coverage?" />
        {error && <p role="alert" style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-negative)" }}>{error}</p>}
        <Button
          size="sm"
          variant="primary"
          disabled={busy || reason.trim().length < 3}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const result = await removeInstructorFromClass(classId, instructorId, reason);
              if (!result.ok) {
                setError(result.error ?? "The instructor could not be removed.");
                setBusy(false);
                return;
              }
              setBusy(false);
              setOpen(false);
              router.refresh();
            } catch {
              setError("The instructor could not be removed. Refresh and try again.");
              setBusy(false);
            }
          }}
        >
          {busy ? "Removing…" : "Record removal"}
        </Button>
      </Modal>
    </>
  );
}

export function WithdrawStudentButton({ classId, studentId }: { classId: string; studentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => setOpen(true)}>
        Withdraw
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Withdraw Student" dismissible={!busy}>
        <label htmlFor={`withdraw-reason-${studentId}`} style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 6 }}>Withdrawal reason</label>
        <textarea id={`withdraw-reason-${studentId}`} rows={4} style={{ ...inputStyle, resize: "vertical" }} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Record the reason for roster history." />
        {error && <p role="alert" style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-negative)" }}>{error}</p>}
        <Button
          size="sm"
          variant="primary"
          disabled={busy || reason.trim().length < 3}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const result = await withdrawEnrollment(classId, studentId, reason);
              if (!result.ok) {
                setError(result.error ?? "The student could not be withdrawn.");
                setBusy(false);
                return;
              }
              setBusy(false);
              setOpen(false);
              router.refresh();
            } catch {
              setError("The student could not be withdrawn. Refresh and try again.");
              setBusy(false);
            }
          }}
        >
          {busy ? "Withdrawing…" : "Record withdrawal"}
        </Button>
      </Modal>
    </>
  );
}
