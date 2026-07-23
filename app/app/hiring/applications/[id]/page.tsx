import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, RecordShell, PageSection } from "@/components/ds";
import { requireStaff } from "@/lib/dal";
import { getApplicationCockpit } from "@/lib/people-work";
import { coerceEpochMs, formatDateTimeInZone, DEFAULT_TIME_ZONE } from "@/lib/timezone";
import ApplicationCockpitActions from "@/components/app/hiring/ApplicationCockpitActions";
import RetryCandidateInvitation from "@/components/app/hiring/RetryCandidateInvitation";
import RetryCandidateCommunication from "@/components/app/hiring/RetryCandidateCommunication";

function label(value: unknown): string {
  return String(value ?? "—").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/** Bigint epoch columns round-trip as strings from Postgres — coerce before formatting. */
function when(value: unknown): string {
  const ms = coerceEpochMs(value as number | string | null | undefined);
  return ms == null ? "—" : formatDateTimeInZone(ms, DEFAULT_TIME_ZONE);
}

type TimelineEntry = { id: string; at: number; kind: string; title: string; detail?: string; tone?: "positive" | "negative" | "warning" | "info" };

export default async function ApplicationCockpitPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const detail = await getApplicationCockpit(id);
  if (!detail) notFound();
  const app = detail.application;
  const personId = String(app.person_id);
  const lifecycle = String(app.lifecycle_status);
  const currentOrdinal = detail.stages.find((s) => String(s.id) === String(app.current_stage_version_id));
  const currentOrdinalNum = currentOrdinal ? Number(currentOrdinal.ordinal) : 0;

  // Merge stage events + interviews + evaluations + communications into one
  // chronological, humanized journey timeline (Stage 5 requirement).
  const timeline: TimelineEntry[] = [];
  for (const event of detail.events) {
    const at = coerceEpochMs(event.created_at as number | string) ?? 0;
    timeline.push({
      id: `event-${String(event.id)}`,
      at,
      kind: "Stage change",
      title: `${String(event.from_title ?? "Start")} → ${String(event.to_title)}`,
      detail: [event.actor_name ? `by ${String(event.actor_name)}` : null, event.note ? String(event.note) : null].filter(Boolean).join(" · "),
      tone: event.event_type === "accepted" ? "positive" : event.event_type === "rejected" ? "negative" : "info",
    });
  }
  for (const iv of detail.interviews) {
    const at = coerceEpochMs((iv.scheduled_at ?? iv.created_at) as number | string) ?? 0;
    timeline.push({
      id: `interview-${String(iv.id)}`,
      at,
      kind: "Interview",
      title: `${String(iv.stage_title)} — ${label(iv.status)}`,
      detail: iv.scheduled_at ? `${when(iv.scheduled_at)}${iv.timezone ? ` · ${String(iv.timezone)}` : ""}` : "Needs scheduling",
      tone: iv.status === "completed" ? "positive" : iv.status === "no_show" || iv.status === "canceled" ? "negative" : "warning",
    });
  }
  for (const ev of detail.evaluations) {
    const at = coerceEpochMs(ev.submitted_at as number | string) ?? 0;
    timeline.push({
      id: `evaluation-${String(ev.id)}`,
      at,
      kind: "Evaluation",
      title: `${String(ev.scorecard_name)} — ${label(ev.recommendation)}`,
      detail: `${String(ev.evaluator_name)}${ev.evidence_note ? ` · ${String(ev.evidence_note)}` : ""}`,
      tone: ev.recommendation === "strong_hire" || ev.recommendation === "hire" ? "positive" : ev.recommendation === "do_not_hire" ? "negative" : "warning",
    });
  }
  for (const message of detail.communications) {
    const at = coerceEpochMs(message.created_at as number | string) ?? 0;
    timeline.push({
      id: `communication-${String(message.id)}`,
      at,
      kind: "Communication",
      title: String(message.subject ?? message.channel),
      detail: label(message.status),
      tone: message.status === "failed" ? "negative" : message.status === "delivered" || message.status === "queued" ? "positive" : "info",
    });
  }
  timeline.sort((a, b) => b.at - a.at);

  const invitationComm = detail.communications.find((m) => String(m.idempotency_key).startsWith("accepted-invitation:"));
  const invitationFailed = invitationComm?.status === "failed";
  const decisionEvent = detail.events.find((e) => e.event_type === "accepted" || e.event_type === "rejected");

  return (
    <RecordShell
      eyebrow={`Candidate cockpit · ${String(app.opening_title)}`}
      title={String(app.name)}
      subtitle={
        <>
          {String(app.email)}
          {app.phone ? ` · ${String(app.phone)}` : ""}
          {" · "}
          <Link href={`/app/people/${personId}`} className="ops-inline-link">View person record →</Link>
        </>
      }
      status={<Badge status={lifecycle === "accepted" ? "positive" : lifecycle === "rejected" ? "negative" : "info"}>{label(lifecycle)}</Badge>}
      side={
        <>
          <PageSection title="Stage rail" noRule>
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              {detail.stages.map((stage) => {
                const ordinal = Number(stage.ordinal);
                const isCurrent = String(stage.id) === String(app.current_stage_version_id);
                const isPast = ordinal < currentOrdinalNum;
                return (
                  <li
                    key={String(stage.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "7px 0",
                      fontFamily: "var(--font-interface)", fontSize: 13,
                      fontWeight: isCurrent ? 700 : 500,
                      color: isCurrent ? "var(--bow-ink)" : isPast ? "var(--bow-slate)" : "var(--bow-inactive)",
                      borderLeft: `3px solid ${isCurrent ? "var(--bow-blue)" : isPast ? "var(--bow-positive)" : "var(--border-rule)"}`,
                      paddingLeft: 10,
                    }}
                  >
                    <span>{String(stage.title)}</span>
                    {isCurrent && <Badge status="info">Here</Badge>}
                    {isPast && !isCurrent && <Badge status="positive">Done</Badge>}
                  </li>
                );
              })}
            </ol>
          </PageSection>

          <PageSection title="Owner &amp; next action">
            <div className="ops-meta"><span className="ops-label">Owner</span><span className="ops-value">{String(app.owner_name ?? "Unassigned")}</span></div>
            <div className="ops-meta" style={{ marginTop: 8 }}><span className="ops-label">Next action</span><span className="ops-value">{String(app.next_action ?? app.waiting_on ?? "Final")}</span></div>
            <div className="ops-meta" style={{ marginTop: 8 }}><span className="ops-label">Next owner</span><span className="ops-value">{String(app.next_owner_name ?? "Unassigned")}</span></div>
            <div className="ops-meta" style={{ marginTop: 8 }}><span className="ops-label">Source</span><span className="ops-value">{String(app.source ?? "Unknown")}</span></div>
            <div className="ops-meta" style={{ marginTop: 8 }}><span className="ops-label">Versions</span><span className="ops-value">Opening V{Number(app.opening_version)} · Process V{Number(app.process_version)}</span></div>
          </PageSection>
        </>
      }
    >
      {/* THE HANDOFF: the accept moment must be visible and actionable, not a
          silent status flip — this is the #1 coherence gap identified for
          Stage 5. */}
      {lifecycle === "accepted" && (
        <PageSection noRule>
          <div className="ops-alert" data-tone="positive">
            <span className="ops-label">Accepted — onboarding has begun</span>
            <h3 className="ops-alert__title" style={{ marginTop: 7 }}>
              {String(app.name)} is now an onboarding instructor.
            </h3>
            {decisionEvent?.note ? <p className="ops-body" style={{ marginTop: 5 }}>{String(decisionEvent.note)}</p> : null}
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {invitationComm ? (
                <Badge status={invitationFailed ? "negative" : "positive"}>
                  {invitationFailed ? `Invitation to ${String(invitationComm.recipient)} failed` : `Invitation sent to ${String(invitationComm.recipient)}`}
                </Badge>
              ) : (
                <Badge status="warning">Invitation not yet recorded</Badge>
              )}
              {invitationFailed && <RetryCandidateInvitation applicationId={id} />}
            </div>
            <p style={{ marginTop: 14 }}>
              <Link href={`/app/people/${personId}?tab=instructor`} className="ops-inline-link" style={{ fontWeight: 700 }}>
                View onboarding dossier →
              </Link>
            </p>
          </div>
        </PageSection>
      )}

      {lifecycle === "rejected" && (
        <PageSection noRule>
          <div className="ops-alert" data-tone="warning">
            <span className="ops-label">Decision recorded</span>
            <h3 className="ops-alert__title" style={{ marginTop: 7 }}>Not moving forward</h3>
            {decisionEvent?.note ? <p className="ops-body" style={{ marginTop: 5 }}>{String(decisionEvent.note)}</p> : null}
          </div>
        </PageSection>
      )}

      <PageSection title="Current state" noRule={lifecycle !== "accepted" && lifecycle !== "rejected"}>
        <div className="ops-meta-grid">
          <div className="ops-meta"><span className="ops-label">Stage</span><span className="ops-value">{String(app.stage_title)}</span></div>
          <div className="ops-meta"><span className="ops-label">Identity</span><span className="ops-value">{label(app.identity_status)}</span></div>
        </div>
      </PageSection>

      <PageSection title="Application">
        <div className="ops-meta-grid">
          {Object.entries(app.answers).map(([key, value]) => (
            <div className="ops-meta" key={key}><span className="ops-label">{label(key)}</span><span className="ops-value">{value || "—"}</span></div>
          ))}
        </div>
      </PageSection>

      <ApplicationCockpitActions
        applicationId={id}
        revision={Number(app.revision)}
        currentStageId={String(app.current_stage_version_id)}
        lifecycle={lifecycle}
        stages={detail.stages.map((stage) => ({ id: String(stage.id), title: String(stage.title), stage_type: String(stage.stage_type), ordinal: Number(stage.ordinal), scorecard_version_id: stage.scorecard_version_id ? String(stage.scorecard_version_id) : null }))}
        interviews={detail.interviews.map((event) => ({ id: String(event.id), stage_version_id: String(event.stage_version_id), status: String(event.status), revision: Number(event.revision) }))}
      />

      <PageSection title="Journey timeline">
        {timeline.length === 0 ? <p className="ops-body">No activity recorded yet.</p> : (
          <div className="ops-timeline">
            {timeline.map((entry) => (
              <div className="ops-timeline__item" key={entry.id}>
                <span className="ops-record-meta">{when(entry.at)} · {entry.kind}</span>
                <p className="ops-body" style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span>{entry.title}</span>
                  {entry.tone && <Badge status={entry.tone}>{entry.kind}</Badge>}
                </p>
                {entry.detail && <p className="ops-body" style={{ marginTop: 2, color: "var(--bow-slate)" }}>{entry.detail}</p>}
                {entry.kind === "Communication" && (() => {
                  const message = detail.communications.find((m) => `communication-${String(m.id)}` === entry.id);
                  return message && message.status === "failed" && !String(message.idempotency_key).startsWith("accepted-invitation:")
                    ? <div style={{ marginTop: 6 }}><RetryCandidateCommunication communicationId={String(message.id)} /></div>
                    : null;
                })()}
              </div>
            ))}
          </div>
        )}
      </PageSection>
    </RecordShell>
  );
}
