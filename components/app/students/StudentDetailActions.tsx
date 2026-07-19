"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { Button } from "@/components/ds";
import { updateFormStatus, updateStudent } from "@/app/actions/students";

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
};

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
    <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
      <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
        Student lifecycle
      </span>
      <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 13, lineHeight: 1.5, color: "var(--bow-slate)" }}>
        {enrollmentStatus === "active"
          ? "Deactivation deliberately withdraws live enrollments and preserves all attendance and finalized session evidence."
          : "Reactivation makes the student available again, but prior enrollments stay withdrawn until staff enrolls the student deliberately."}
      </p>
      <div>
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

      <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
        Form status
      </span>
      <div style={{ display: "flex", gap: 8 }}>
        {FORM_STATUSES.map((s) => (
          <Button key={s} size="sm" variant={s === formStatus ? "primary" : "secondary"} disabled={busy || s === formStatus} onClick={() => run(() => updateFormStatus(studentId, s))}>
            {s}
          </Button>
        ))}
      </div>

      <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
        Communication notes
      </span>
      <textarea rows={4} style={{ ...inputStyle, resize: "vertical" }} value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => run(() => updateStudent(studentId, { expectedUpdatedAt: versionRef.current, communicationNotes: notes }))}
        >
          {busy ? "Saving…" : "Save notes"}
        </Button>
      </div>
      {error && <p role="alert" style={{ margin: 0, fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-negative)" }}>{error}</p>}
    </div>
  );
}
