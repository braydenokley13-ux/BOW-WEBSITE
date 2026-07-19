"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ds";
import { updateFormStatus, updateStudent } from "@/app/actions/students";

const FORM_STATUSES = ["missing", "submitted", "complete"];

export default function StudentDetailActions({
  studentId,
  formStatus,
  communicationNotes,
  enrollmentStatus,
  expectedUpdatedAt,
}: {
  studentId: string;
  formStatus: string;
  communicationNotes: string;
  enrollmentStatus: "active" | "inactive";
  expectedUpdatedAt: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState(communicationNotes);
  const versionRef = useRef(expectedUpdatedAt);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<{ ok: boolean; error?: string; updatedAt?: number }>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      if (res.ok) {
        if (res.updatedAt !== undefined) versionRef.current = res.updatedAt;
        router.refresh();
      } else {
        setError(res.error || "Something went wrong.");
      }
    } catch {
      setError("The request could not be completed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const changeEnrollmentStatus = () => {
    const next = enrollmentStatus === "active" ? "inactive" : "active";
    if (
      next === "inactive" &&
      !window.confirm(
        "Deactivate this student? Current Class enrollments will be withdrawn, safe future roster rows will be removed, and prior enrollments will not return automatically after reactivation.",
      )
    ) {
      return;
    }
    void run(() => updateStudent(studentId, { expectedUpdatedAt: versionRef.current, enrollmentStatus: next }));
  };

  return (
    <div className="ops-panel">
      <div className="ops-section-head">
        <h2 className="ops-section-title">Student lifecycle</h2>
      </div>
      <p className="ops-body">
        {enrollmentStatus === "active"
          ? "Deactivation deliberately withdraws live enrollments and preserves all attendance and finalized session evidence."
          : "Reactivation makes the student available again, but prior enrollments stay withdrawn until staff enrolls the student deliberately."}
      </p>
      <div style={{ marginTop: 10 }}>
        <Button
          size="sm"
          variant={enrollmentStatus === "active" ? "secondary" : "primary"}
          disabled={busy}
          onClick={changeEnrollmentStatus}
          style={enrollmentStatus === "active" ? { color: "var(--bow-negative)" } : undefined}
        >
          {enrollmentStatus === "active" ? "Deactivate student" : "Reactivate student"}
        </Button>
      </div>

      <div className="ops-field" style={{ marginTop: 18 }}>
        <label>Form status</label>
        <div style={{ display: "flex", gap: 8 }}>
          {FORM_STATUSES.map((s) => (
            <Button key={s} size="sm" variant={s === formStatus ? "primary" : "secondary"} disabled={busy || s === formStatus} onClick={() => run(() => updateFormStatus(studentId, s))}>
              {s}
            </Button>
          ))}
        </div>
      </div>

      <div className="ops-field" style={{ marginTop: 14 }}>
        <label htmlFor="student-communication-notes">Communication notes</label>
        <textarea id="student-communication-notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="ops-form-footer" style={{ justifyContent: "flex-start", borderTop: 0, paddingTop: 0 }}>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => run(() => updateStudent(studentId, { expectedUpdatedAt: versionRef.current, communicationNotes: notes }))}
        >
          {busy ? "Saving…" : "Save notes"}
        </Button>
      </div>
      {error && <p role="alert" className="ops-error">{error}</p>}
    </div>
  );
}
