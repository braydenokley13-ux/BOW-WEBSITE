import Link from "next/link";
import { Badge, PageHeader, PageSection } from "@/components/ds";
import { requireInstructorSelf } from "@/lib/dal";
import { listAssignmentsForInstructor } from "@/lib/delivery";
import { assignmentRoleLabel, assignmentStatusLabel } from "@/lib/delivery-shared";
import AssignmentResponse from "@/components/app/teach/AssignmentResponse";

function AssignmentRow({
  assignment,
  showResponse,
}: {
  assignment: Awaited<ReturnType<typeof listAssignmentsForInstructor>>[number];
  showResponse: boolean;
}) {
  return (
    <div key={assignment.id} style={{ display: "flex", flexDirection: "column", gap: 8, padding: "14px 0", borderBottom: "1px solid var(--border-rule)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div>
          <span style={{ fontFamily: "var(--font-interface)", fontSize: 15, fontWeight: 600 }}>
            {assignment.programName ? `${assignment.programName} — ` : ""}
            {assignment.className}
          </span>
          <p className="ops-label" style={{ margin: "4px 0 0" }}>{assignmentRoleLabel(assignment.role)}</p>
        </div>
        <Badge status={assignment.status === "proposed" ? "warning" : assignment.status === "accepted" ? "positive" : "neutral"}>
          {assignmentStatusLabel(assignment.status)}
        </Badge>
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {assignment.expectedCommitment && <span className="ops-body">Commitment: {assignment.expectedCommitment}</span>}
        {assignment.startDate && <span className="ops-body">Starts: {assignment.startDate}</span>}
      </div>
      {assignment.responseNote && <p className="ops-body" style={{ margin: 0 }}>Note: {assignment.responseNote}</p>}
      {showResponse && <AssignmentResponse assignmentId={assignment.id} />}
    </div>
  );
}

export default async function TeachAssignmentsPage() {
  const { instructor } = await requireInstructorSelf();
  const assignments = await listAssignmentsForInstructor(instructor.id);

  const pending = assignments.filter((a) => a.status === "proposed");
  const accepted = assignments.filter((a) => a.status === "accepted");
  const declinedOrPast = assignments.filter((a) => a.status === "declined");

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px clamp(16px,4vw,32px) 96px", display: "flex", flexDirection: "column", gap: 24 }}>
      <PageHeader eyebrow="My BOW" title="Assignments" context="Every class BOW has offered you, and how you responded." />

      <PageSection title="Awaiting your response" noRule>
        {pending.length === 0 ? (
          <p className="ops-body">Nothing waiting on you.</p>
        ) : (
          <div>{pending.map((a) => <AssignmentRow key={a.id} assignment={a} showResponse />)}</div>
        )}
      </PageSection>

      <PageSection title="Accepted">
        {accepted.length === 0 ? (
          <p className="ops-body">No accepted assignments yet.</p>
        ) : (
          <div>{accepted.map((a) => <AssignmentRow key={a.id} assignment={a} showResponse={false} />)}</div>
        )}
      </PageSection>

      <PageSection title="Declined & past">
        {declinedOrPast.length === 0 ? (
          <p className="ops-body">Nothing here.</p>
        ) : (
          <div>{declinedOrPast.map((a) => <AssignmentRow key={a.id} assignment={a} showResponse={false} />)}</div>
        )}
      </PageSection>

      <Link href="/app/teach" className="ops-inline-link" style={{ width: "fit-content" }}>← Back to My BOW</Link>
    </div>
  );
}
