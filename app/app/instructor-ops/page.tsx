import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Button, PageHeader, PageSection } from "@/components/ds";
import { requireStaff } from "@/lib/dal";
import { getFounderInstructorsData } from "@/lib/delivery";
import { instructorStageLabel, assignmentRoleLabel } from "@/lib/delivery-shared";

export const metadata: Metadata = {
  title: "Instructor Ops",
  description: "Staffing coverage and delivery support signals for BOW instructors.",
  robots: { index: false, follow: false },
};

export default async function InstructorOpsPage() {
  await requireStaff();
  const data = await getFounderInstructorsData();
  // Every wait-time on this page is measured against the instant the data was
  // gathered, so the figures agree with each other and the render stays pure.
  const now = data.generatedAt;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px clamp(16px,4vw,32px) 96px", display: "flex", flexDirection: "column", gap: 4 }}>
      <PageHeader
        eyebrow="BOW OS · Delivery"
        title="Instructor Ops"
        context="Who needs a decision, who is staffed, and who needs support delivering — in that order."
      />

      <PageSection title="Needs action" noRule>
        {data.attention.length === 0 ? (
          <div className="ops-empty">
            <Badge status="positive">All clear</Badge>
            <h3 className="ops-empty__title" style={{ marginTop: 10 }}>Nothing is blocked or waiting on you.</h3>
          </div>
        ) : (
          <div className="ops-list">
            {data.attention.map((item) => (
              <article key={item.key} className="ops-list-row">
                <div>
                  <span className="ops-record-name">{item.title}</span>
                  <span className="ops-record-meta">{item.subjectName}</span>
                </div>
                <div>
                  <span className="ops-label">Detail</span>
                  <span className="ops-value">{item.detail}</span>
                </div>
                <Badge status={item.severity === "blocker" ? "negative" : item.severity === "warning" ? "warning" : "info"}>
                  {item.severity === "blocker" ? "Blocker" : item.severity === "warning" ? "Warning" : "Info"}
                </Badge>
                <Button href={item.href} size="sm" variant="secondary">{item.actionLabel}</Button>
              </article>
            ))}
          </div>
        )}
      </PageSection>

      <PageSection title="Instructor pipeline">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          {data.pipeline.map((stage) => (
            <Badge key={stage.stage} status={stage.count > 0 ? "info" : "neutral"}>
              {instructorStageLabel(stage.stage)} · {stage.count}
            </Badge>
          ))}
        </div>
        {data.pipeline.filter((stage) => stage.count > 0).length === 0 ? (
          <div className="ops-empty">
            <h3 className="ops-empty__title">No instructors in the pipeline yet.</h3>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {data.pipeline
              .filter((stage) => stage.count > 0)
              .map((stage) => (
                <div key={stage.stage}>
                  <span className="ops-section-note">{instructorStageLabel(stage.stage)}</span>
                  <div className="ops-list">
                    {stage.instructors.map((instructor) => (
                      <article key={instructor.id} className="ops-list-row">
                        <div>
                          <span className="ops-record-name">{instructor.name}</span>
                          <span className="ops-record-meta">{instructor.detail}</span>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </PageSection>

      <PageSection title="Staffing">
        <div id="staffing" className="ops-anchor" style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div>
            <span className="ops-section-note">Classes with no accepted lead</span>
            {data.staffing.unstaffedClasses.length === 0 ? (
              <div className="ops-empty"><Badge status="positive">Covered</Badge></div>
            ) : (
              <div className="ops-list">
                {data.staffing.unstaffedClasses.map((cls) => (
                  <article key={cls.classId} className="ops-list-row">
                    <div>
                      <Link className="ops-record-name" href={`/app/classes/${cls.classId}`}>{cls.className}</Link>
                      <span className="ops-record-meta">{cls.programName ?? "No program"}</span>
                    </div>
                    <Button href={`/app/classes/${cls.classId}`} size="sm" variant="secondary">Open class</Button>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div>
            <span className="ops-section-note">Assignments awaiting a response</span>
            {data.staffing.pendingAssignments.length === 0 ? (
              <div className="ops-empty"><Badge status="positive">Nothing waiting</Badge></div>
            ) : (
              <div className="ops-list">
                {data.staffing.pendingAssignments.map((assignment) => {
                  const waitingDays = assignment.proposedAt ? Math.floor((now - assignment.proposedAt) / (24 * 60 * 60 * 1000)) : 0;
                  return (
                    <article key={assignment.id} className="ops-list-row">
                      <div>
                        <span className="ops-record-name">{assignment.instructorName ?? "Unnamed instructor"}</span>
                        <span className="ops-record-meta">{assignment.className} · {assignmentRoleLabel(assignment.role)}</span>
                      </div>
                      <div>
                        <span className="ops-label">Waiting</span>
                        <span className="ops-value">{waitingDays} day{waitingDays === 1 ? "" : "s"}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <span className="ops-section-note">Ready instructors with no assignment</span>
            {data.staffing.readyWithoutWork.length === 0 ? (
              <div className="ops-empty"><Badge status="positive">Everyone ready is deployed</Badge></div>
            ) : (
              <div className="ops-list">
                {data.staffing.readyWithoutWork.map((instructor) => (
                  <article key={instructor.id} className="ops-list-row">
                    <div><span className="ops-record-name">{instructor.name}</span></div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div>
            <span className="ops-section-note">Overloaded instructors</span>
            {data.staffing.overloaded.length === 0 ? (
              <div className="ops-empty"><Badge status="positive">Nobody is over their limit</Badge></div>
            ) : (
              <div className="ops-list">
                {data.staffing.overloaded.map((instructor) => (
                  <article key={instructor.id} className="ops-list-row">
                    <div><span className="ops-record-name">{instructor.name}</span></div>
                    <div>
                      <span className="ops-label">Workload</span>
                      <span className="ops-value">{instructor.workload} / {instructor.max}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </PageSection>

      <PageSection title="Delivery signals">
        <div id="delivery" className="ops-anchor">
          <p className="ops-section-note" style={{ marginBottom: 12 }}>
            Who needs support delivering — not a ranking or a leaderboard.
          </p>
          {data.delivery.length === 0 ? (
            <div className="ops-empty"><h3 className="ops-empty__title">No active instructors yet.</h3></div>
          ) : (
            <div className="ops-list">
              {data.delivery.map((instructor) => (
                <article key={instructor.instructorId} className="ops-list-row">
                  <div><span className="ops-record-name">{instructor.name}</span></div>
                  <div><span className="ops-label">Assigned classes</span><span className="ops-value">{instructor.assignedClasses}</span></div>
                  <div><span className="ops-label">Sessions delivered</span><span className="ops-value">{instructor.sessionsDelivered}</span></div>
                  <div>
                    <span className="ops-label">Missing reports</span>
                    <span className="ops-value">
                      {instructor.reportsMissing > 0 ? <Badge status="warning">{instructor.reportsMissing}</Badge> : "0"}
                    </span>
                  </div>
                  <div>
                    <span className="ops-label">Missing attendance</span>
                    <span className="ops-value">
                      {instructor.attendanceMissing > 0 ? <Badge status="warning">{instructor.attendanceMissing}</Badge> : "0"}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </PageSection>
    </div>
  );
}
