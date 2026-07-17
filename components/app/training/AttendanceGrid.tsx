"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button } from "@/components/ds";
import { recordSessionAttendance } from "@/app/actions/training";

interface Row {
  id: string;
  name: string;
  registered: boolean;
  attended: boolean | null;
}

export default function AttendanceGrid({ sessionId, instructors }: { sessionId: string; instructors: Row[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = (instructorId: string, attended: boolean) => {
    setBusyId(instructorId);
    setError(null);
    startTransition(async () => {
      const res = await recordSessionAttendance(sessionId, instructorId, attended);
      if (!res.ok) setError(res.error || "Something went wrong.");
      else router.refresh();
      setBusyId(null);
    });
  };

  if (instructors.length === 0) {
    return <p style={{ fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-slate)" }}>No instructors to show.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {error && <p style={{ fontFamily: "var(--font-data)", fontSize: 12.5, color: "var(--bow-negative)" }}>{error}</p>}
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
            {i.attended === true && <Badge status="positive">Attended</Badge>}
            {i.attended === false && <Badge status="negative">Absent</Badge>}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button size="sm" variant={i.attended === true ? "primary" : "secondary"} disabled={pending && busyId === i.id} onClick={() => toggle(i.id, true)}>
              Attended
            </Button>
            <Button size="sm" variant={i.attended === false ? "primary" : "secondary"} disabled={pending && busyId === i.id} onClick={() => toggle(i.id, false)}>
              Absent
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
