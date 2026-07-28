import Link from "next/link";
import { Badge, Button, PageHeader, PageSection, SectionHeader } from "@/components/ds";
import { requireStaff } from "@/lib/dal";
import { listPrograms, programStageLabel, type ProgramSummary } from "@/lib/operations";
import { getFounderProgramsData } from "@/lib/delivery";
import { prepStatusLabel, PIPELINE_GROUPS, type AttentionSeverity } from "@/lib/delivery-shared";
import { formatDateTimeInZone } from "@/lib/timezone";
import { registrationNeedsAction, type RegistrationAttentionItem } from "@/lib/program-admin";

function registrationAttentionTone(severity: RegistrationAttentionItem["severity"]): "negative" | "warning" | "info" {
  if (severity === "blocker") return "negative";
  if (severity === "warning") return "warning";
  return "info";
}

function attentionTone(severity: AttentionSeverity): "negative" | "warning" | "info" {
  if (severity === "blocker") return "negative";
  if (severity === "warning") return "warning";
  return "info";
}

function severityLabel(severity: AttentionSeverity): string {
  if (severity === "blocker") return "Blocked";
  if (severity === "warning") return "Needs action";
  return "Watch";
}

function stageTone(stage: string): "positive" | "warning" | "negative" | "info" | "neutral" | "locked" {
  if (stage === "active" || stage === "renewed") return "positive";
  if (stage === "ready_to_launch" || stage === "partner_confirmed") return "info";
  if (stage === "paused" || stage === "closed") return "negative";
  if (["staffing", "enrollment", "recruiting", "renewal_review"].includes(stage)) return "warning";
  if (stage === "completed") return "locked";
  return "neutral";
}

export default async function ProgramsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  await requireStaff();
  const showAll = (await searchParams).view === "all";
  const data = await getFounderProgramsData();
  const attentionCap = 12;
  const attentionShown = data.attention.slice(0, attentionCap);
  const attentionHidden = data.attention.length - attentionShown.length;
  const registrationAttention = await registrationNeedsAction(8);

  return (
    <main className="ops-page">
      <PageHeader
        eyebrow="Programs"
        title="Run every launch from demand to renewal."
        context={
          data.attention.length > 0
            ? `${data.attention.length} thing${data.attention.length === 1 ? "" : "s"} need${data.attention.length === 1 ? "s" : ""} your decision right now.`
            : "Nothing needs your decision right now."
        }
        action={<Button href="/app/programs/new" variant="emphasis">Create Program</Button>}
      />
      <div style={{ display: "flex", gap: 16, marginBottom: 4, flexWrap: "wrap" }}>
        <Link href="/app/locations" className="ops-inline-link">Locations & regions →</Link>
        <Link href="/app/curriculum" className="ops-inline-link">Curriculum →</Link>
        <Link href="/app/programs?view=all" className="ops-inline-link">All programs →</Link>
      </div>

      <PageSection title="Needs attention" noRule>
        {attentionShown.length === 0 ? (
          <p className="ops-record-meta">Nothing needs your decision right now.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {attentionShown.map((item) => (
              <div
                key={item.key}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 16,
                  flexWrap: "wrap",
                  padding: "clamp(10px, 2vw, 14px)",
                  border: "1px solid var(--border-rule)",
                  borderRadius: "var(--radius-control)",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <Badge status={attentionTone(item.severity)}>{severityLabel(item.severity)}</Badge>
                    <span className="ops-record-name" style={{ fontSize: 15 }}>{item.title}</span>
                  </div>
                  <span className="ops-record-meta">{item.detail}</span>
                </div>
                <Button href={item.href} variant="secondary" size="sm">{item.actionLabel}</Button>
              </div>
            ))}
            {attentionHidden > 0 && (
              <p className="ops-record-meta">{attentionHidden} more item{attentionHidden === 1 ? "" : "s"} not shown.</p>
            )}
          </div>
        )}
      </PageSection>

      <PageSection title="Families and registrations needing action" noRule>
        <p className="ops-record-meta" style={{ marginBottom: 10 }}>
          Decisions and exceptions across every program&apos;s registrations — each backed by a live query, never a stub.
        </p>
        {registrationAttention.length === 0 ? (
          <p className="ops-record-meta">Nothing needs action on the registration side right now.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {registrationAttention.map((item) => (
              <div
                key={item.key}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 16,
                  flexWrap: "wrap",
                  padding: "clamp(10px, 2vw, 14px)",
                  border: "1px solid var(--border-rule)",
                  borderRadius: "var(--radius-control)",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <Badge status={registrationAttentionTone(item.severity)}>
                      {item.severity === "blocker" ? "Blocked" : item.severity === "warning" ? "Needs action" : "Watch"}
                    </Badge>
                    {item.programName && <span className="ops-record-meta">{item.programName}</span>}
                    {item.studentName && <span className="ops-record-meta">· {item.studentName}</span>}
                  </div>
                  <span className="ops-record-name" style={{ fontSize: 14 }}>{item.problem}</span>
                  <span className="ops-record-meta">
                    {item.consequence}
                    {item.deadline ? ` · Deadline ${new Date(item.deadline).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""}
                  </span>
                </div>
                <Button href={item.href} variant="secondary" size="sm">{item.actionLabel}</Button>
              </div>
            ))}
          </div>
        )}
      </PageSection>

      <PageSection title="Upcoming">
        {data.upcomingSessions.length === 0 ? (
          <p className="ops-record-meta">No sessions scheduled in the next 21 days.</p>
        ) : (
          <section className="ops-list" aria-label="Upcoming sessions">
            {data.upcomingSessions.map((session) => (
              <article className="ops-list-row" key={session.sessionId}>
                <div>
                  <Link className="ops-record-name" href={`/app/classes/${session.classId}/sessions/${session.sessionId}`}>{session.className}</Link>
                  <span className="ops-record-meta">{session.programName ?? "No program"}</span>
                </div>
                <div>
                  <span className="ops-value">{formatDateTimeInZone(session.sessionDate, session.timezone)}</span>
                </div>
                <div>
                  {session.instructorNames.length > 0 ? (
                    <span className="ops-value">{session.instructorNames.join(", ")}</span>
                  ) : (
                    <Badge status="negative">No coverage</Badge>
                  )}
                </div>
                <div>
                  <Badge status={session.prepStatus === "ready" ? "positive" : session.prepStatus === "in_preparation" ? "warning" : "neutral"}>
                    {prepStatusLabel(session.prepStatus)}
                  </Badge>
                </div>
              </article>
            ))}
          </section>
        )}
      </PageSection>

      <PageSection title="Program pipeline">
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {PIPELINE_GROUPS.map((group) => {
            const programs = data.pipeline[group.key];
            return (
              <div key={group.key}>
                <SectionHeader kicker={group.blurb} title={group.label} level={2} capLine={false} />
                {programs.length === 0 ? (
                  <p className="ops-record-meta" style={{ marginTop: 8 }}>No programs in this group.</p>
                ) : (
                  <section className="ops-list" aria-label={group.label} style={{ marginTop: 8 }}>
                    {programs.map((program) => (
                      <article className="ops-list-row" key={program.id}>
                        <div>
                          <Link className="ops-record-name" href={`/app/programs/${program.id}`}>{program.name}</Link>
                          <span className="ops-record-meta">{program.detail}</span>
                        </div>
                        {program.nextAction && (
                          <div>
                            <span className="ops-record-meta">{program.nextAction}</span>
                          </div>
                        )}
                      </article>
                    ))}
                  </section>
                )}
              </div>
            );
          })}
        </div>
      </PageSection>

      {showAll && <AllPrograms />}
    </main>
  );
}

async function AllPrograms() {
  const programs = await listPrograms();
  return (
    <PageSection title="All programs">
      {programs.length === 0 ? (
        <section className="ops-empty">
          <h2 className="ops-empty__title">No Programs exist yet.</h2>
          <p className="ops-empty__body">
            Create a Program when partner demand becomes a real operating plan. It will coordinate staffing, enrollment, launch readiness, delivery, and renewal in one place.
          </p>
          <div style={{ marginTop: 18 }}><Button href="/app/programs/new" variant="emphasis">Create the First Program</Button></div>
        </section>
      ) : (
        <section className="ops-list" aria-label="All Programs">
          {programs.map((summary: ProgramSummary) => (
            <article className="ops-list-row" key={summary.program.id}>
              <div>
                <Link className="ops-record-name" href={`/app/programs/${summary.program.id}`}>{summary.program.name}</Link>
                <span className="ops-record-meta">{summary.partnerName ?? "Partner not linked"} · {summary.locationName ?? (summary.program.deliveryFormat === "online" ? "Online" : "Location missing")}</span>
              </div>
              <div>
                <Badge status={stageTone(summary.program.stage)}>{programStageLabel(summary.program.stage)}</Badge>{" "}
                <Badge status={summary.program.isPublic ? "positive" : "neutral"}>{summary.program.isPublic ? "Public" : "Draft"}</Badge>
                <span className="ops-record-meta">{summary.program.launchDate ? `Launch ${summary.program.launchDate}` : "Launch date missing"}</span>
              </div>
              <div>
                <span className="ops-label">Owner</span>
                <span className="ops-value">{summary.ownerName ?? "Unassigned"}</span>
                <span className="ops-record-meta">{summary.instructorCount} instructor{summary.instructorCount === 1 ? "" : "s"} · {summary.enrollmentCount} enrolled</span>
              </div>
              <Button href={`/app/programs/${summary.program.id}`} variant="secondary" size="sm">Open Program</Button>
            </article>
          ))}
        </section>
      )}
    </PageSection>
  );
}
