"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { Badge, Button, Modal } from "@/components/ds";
import { assignInstructorToClass, removeInstructorFromClass, updateClassStatus, createClassSession } from "@/app/actions/classes";
import { enrollStudent, withdrawEnrollment } from "@/app/actions/students";

const inputStyle: CSSProperties = {
  background: "var(--bow-paper)",
  border: "1px solid var(--border-rule)",
  color: "var(--bow-ink)",
  padding: "10px 12px",
  fontFamily: "var(--font-interface)",
  fontSize: 14,
  outline: "none",
  width: "100%",
  borderRadius: 4,
  marginBottom: 12,
};

const STATUSES = ["planning", "staffing", "ready_to_launch", "active", "completed", "cancelled"];

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
  status: string;
  eligibleInstructors: EligibleInstructor[];
  assignedInstructorIds: string[];
  students: StudentOption[];
  capacity: number | null;
  enrolledCount: number;
}

export default function ClassDetailActions({ classId, status, eligibleInstructors, assignedInstructorIds, students, capacity, enrolledCount }: Props) {
  const router = useRouter();
  const [modal, setModal] = useState<null | "assign" | "session" | "enroll">(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pickedInstructor, setPickedInstructor] = useState(eligibleInstructors[0]?.id ?? "");
  const [pickedRole, setPickedRole] = useState<"lead" | "additional">("lead");
  const [sessionDate, setSessionDate] = useState("");
  const [sessionLocation, setSessionLocation] = useState("");
  const [pickedStudent, setPickedStudent] = useState(students.find((s) => !s.enrolled)?.id ?? "");

  const refresh = () => {
    setModal(null);
    setBusy(false);
    router.refresh();
  };

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(true);
    setError(null);
    const res = await fn();
    if (res.ok) refresh();
    else {
      setError(res.error || "Something went wrong.");
      setBusy(false);
    }
  };

  const full = !!capacity && capacity > 0 && enrolledCount >= capacity;
  const unenrolledStudents = students.filter((s) => !s.enrolled);

  return (
    <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 22 }}>
      <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 12 }}>
        Actions
      </span>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        {STATUSES.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={s === status ? "primary" : "secondary"}
            disabled={busy || s === status}
            onClick={() => run(() => updateClassStatus(classId, s))}
          >
            {s.replace(/_/g, " ")}
          </Button>
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Button size="sm" variant="secondary" onClick={() => setModal("assign")} disabled={eligibleInstructors.length === 0}>
          Assign Instructor
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setModal("session")}>
          Schedule Session
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setModal("enroll")} disabled={full || unenrolledStudents.length === 0}>
          Enroll Student
        </Button>
      </div>
      {full && <p style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-negative)", marginTop: 8 }}>Class is at capacity.</p>}
      {error && <p style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-negative)", marginTop: 8 }}>{error}</p>}

      <Modal open={modal === "assign"} onClose={() => setModal(null)} title="Assign Instructor">
        <select style={inputStyle} value={pickedInstructor} onChange={(e) => setPickedInstructor(e.target.value)}>
          {eligibleInstructors.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name} {assignedInstructorIds.includes(i.id) ? "(already assigned)" : ""}
            </option>
          ))}
        </select>
        <select style={inputStyle} value={pickedRole} onChange={(e) => setPickedRole(e.target.value as "lead" | "additional")}>
          <option value="lead">Lead</option>
          <option value="additional">Additional</option>
        </select>
        <Button
          variant="primary"
          size="sm"
          disabled={busy || !pickedInstructor}
          onClick={() => run(() => assignInstructorToClass(classId, pickedInstructor, pickedRole))}
        >
          {busy ? "Saving…" : "Assign"}
        </Button>
      </Modal>

      <Modal open={modal === "session"} onClose={() => setModal(null)} title="Schedule Session">
        <input type="datetime-local" style={inputStyle} value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
        <input placeholder="Location (optional)" style={inputStyle} value={sessionLocation} onChange={(e) => setSessionLocation(e.target.value)} />
        <Button
          variant="primary"
          size="sm"
          disabled={busy || !sessionDate}
          onClick={() =>
            run(() =>
              createClassSession(classId, {
                sessionDate: new Date(sessionDate).getTime(),
                location: sessionLocation || undefined,
              }),
            )
          }
        >
          {busy ? "Saving…" : "Schedule"}
        </Button>
      </Modal>

      <Modal open={modal === "enroll"} onClose={() => setModal(null)} title="Enroll Student">
        <select style={inputStyle} value={pickedStudent} onChange={(e) => setPickedStudent(e.target.value)}>
          {unenrolledStudents.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <Badge status="neutral" style={{ marginBottom: 12 }}>
          {enrolledCount}{capacity ? ` / ${capacity}` : ""} enrolled
        </Badge>
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
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await removeInstructorFromClass(classId, instructorId);
        router.refresh();
      }}
    >
      {busy ? "Removing…" : "Remove"}
    </Button>
  );
}

export function WithdrawStudentButton({ classId, studentId }: { classId: string; studentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await withdrawEnrollment(classId, studentId);
        router.refresh();
      }}
    >
      {busy ? "Withdrawing…" : "Withdraw"}
    </Button>
  );
}
