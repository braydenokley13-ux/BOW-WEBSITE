"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, PageSection } from "@/components/ds";
import { confirmProgramRegistration } from "@/app/actions/programs";
import type { ProgramRegistrationRow } from "@/lib/operations";

export default function PendingRegistrations({ registrations }: { registrations: ProgramRegistrationRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (registrations.length === 0) return null;

  const confirm = async (id: string) => {
    setBusyId(id);
    await confirmProgramRegistration(id);
    setBusyId(null);
    router.refresh();
  };

  return (
    <PageSection title="Pending registrations">
      <div className="ops-list">
        {registrations.map((registration) => (
          <div className="ops-list-row ops-list-row--compact" key={registration.id}>
            <div>
              <span className="ops-record-name">{registration.studentName}</span>
              <span className="ops-record-meta">
                {registration.guardianName ?? "Guardian unknown"}
                {registration.guardianEmail ? ` · ${registration.guardianEmail}` : ""}
              </span>
            </div>
            <Badge status={registration.status === "waitlisted" ? "warning" : "info"}>
              {registration.status === "waitlisted" ? "Waitlisted" : "Pending approval"}
            </Badge>
            <Button variant="secondary" size="sm" disabled={busyId === registration.id} onClick={() => confirm(registration.id)}>
              {busyId === registration.id ? "Confirming…" : "Confirm"}
            </Button>
          </div>
        ))}
      </div>
    </PageSection>
  );
}
