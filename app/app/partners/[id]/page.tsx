import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ds";
import { requireStaff } from "@/lib/dal";
import { getDb } from "@/lib/db";
import { SELF_PACED_ORG_ID } from "@/lib/account";
import { getPartnerRecord, listPartnerChoices } from "@/lib/partner-desk";
import type { PartnerRecord } from "@/lib/partner-desk-shared";
import PartnerLifecycleActions from "@/components/app/partners/PartnerLifecycleActions";
import PartnerFollowUpBar, { PartnerNoteComposer } from "@/components/app/partners/PartnerFollowUpBar";
import PartnerInbox from "@/components/app/partners/PartnerInbox";
import type { PartnerLifecycleStatus } from "@/app/actions/partners";

const LIFECYCLE_STATUSES = new Set<PartnerLifecycleStatus>(["prospect", "active", "paused", "closed"]);

const sectionHeading: React.CSSProperties = {
  margin: "0 0 10px",
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: 14,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--bow-ink)",
};

const standingTone: Record<PartnerRecord["standing"], "positive" | "info" | "warning" | "neutral"> = {
  running: "positive",
  scoping: "info",
  paused: "warning",
  past: "neutral",
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await getPartnerRecord(id);
  return { title: record?.name ?? "Partner" };
}

/**
 * One partner, in the order the relationship is actually thought about: where
 * it stands, what is next, who the people are, what is running, and what has
 * been said.
 *
 * The Ramaz case is what shapes the top of this page. A partnership can be
 * completely real while the format, the number of sections, the dates and the
 * staffing are all still open. "Still deciding" is a state with a name, not an
 * incomplete record — so nothing here demands a field be filled to look
 * finished, and no readiness meter counts unmade decisions as failures.
 */
export default async function PartnerRecordPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;

  const record = await getPartnerRecord(id);
  if (!record) notFound();

  const [choices, lifecycleImpact] = await Promise.all([listPartnerChoices(), readLifecycleImpact(id)]);
  const lifecycleStatus = LIFECYCLE_STATUSES.has(record.status as PartnerLifecycleStatus)
    ? (record.status as PartnerLifecycleStatus)
    : null;
  const latestLifecycleEvent = record.activity.find((entry) => entry.kind === "lifecycle")?.body ?? null;

  const running = record.programs.filter((program) => program.running);
  const finished = record.programs.filter((program) => !program.running);

  return (
    <div style={{ maxWidth: 900 }}>
      <Link
        href="/app/partners"
        style={{
          display: "inline-block",
          marginBottom: 14,
          fontFamily: "var(--font-data)",
          fontSize: 11,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--bow-slate)",
        }}
      >
        ← Partners
      </Link>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 320px", minWidth: 0 }}>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-editorial)",
              fontWeight: 600,
              fontSize: "clamp(24px, 3.4vw, 32px)",
              lineHeight: 1.15,
              color: "var(--bow-ink)",
            }}
          >
            {record.name}
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--bow-slate)" }}>
            {[record.location, record.type].filter(Boolean).join(" · ")}
          </p>
        </div>
        <Badge status={standingTone[record.standing]}>{record.standingLabel}</Badge>
      </div>

      <p style={{ margin: "16px 0 0", fontSize: 15, lineHeight: 1.6, color: "var(--bow-ink)" }}>{record.standingLine}</p>

      {/* What is next. The whole reason anybody opens this page. */}
      <section style={{ marginTop: 24 }}>
        <h2 style={sectionHeading}>Next</h2>
        <PartnerFollowUpBar organizationId={record.id} followUp={record.nextFollowUp} />
        {record.laterFollowUps.length > 0 ? (
          <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0 }}>
            {record.laterFollowUps.map((followUp) => (
              <li key={followUp.taskId} style={{ padding: "7px 0", fontSize: 13, color: "var(--bow-slate)" }}>
                {followUp.dueOn ? `${followUp.dueOn} — ` : ""}
                {followUp.title}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {record.inbox.length > 0 ? (
        <section style={{ marginTop: 30 }}>
          <h2 style={sectionHeading}>Waiting on you</h2>
          <PartnerInbox items={record.inbox} partners={choices} />
        </section>
      ) : null}

      {/* People. Names and how to reach them, nothing more. */}
      <section style={{ marginTop: 30 }}>
        <h2 style={sectionHeading}>People</h2>
        {record.contacts.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--bow-slate)" }}>
            No contact is connected yet. Converting an inquiry attaches whoever wrote in.
          </p>
        ) : (
          <div style={{ border: "1px solid var(--border-rule)", borderRadius: "var(--radius-card)", background: "var(--bow-white)" }}>
            {record.contacts.map((contact, index) => (
              <div
                key={contact.personId}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 12,
                  padding: "12px 16px",
                  borderTop: index === 0 ? "none" : "1px solid var(--border-rule)",
                  flexWrap: "wrap",
                }}
              >
                <span style={{ flex: "1 1 180px", minWidth: 0, fontSize: 14.5, color: "var(--bow-ink)" }}>
                  {contact.name}
                  {contact.roles.length ? (
                    <span style={{ display: "block", marginTop: 2, fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
                      {contact.roles.join(" · ")}
                      {contact.primary ? " · main contact" : ""}
                    </span>
                  ) : null}
                </span>
                {contact.email ? (
                  <a href={`mailto:${encodeURIComponent(contact.email)}`} style={{ fontSize: 13, color: "var(--bow-blue)" }}>
                    {contact.email}
                  </a>
                ) : null}
                {contact.phone ? (
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)" }}>{contact.phone}</span>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* What is running, and what ran. */}
      <section style={{ marginTop: 30 }}>
        <h2 style={sectionHeading}>Programs</h2>
        {record.programs.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: "var(--bow-slate)" }}>
            Nothing has been scheduled with this partner yet.
          </p>
        ) : (
          <>
            {running.map((program) => (
              <ProgramLine key={program.id} program={program} />
            ))}
            {finished.length > 0 ? (
              <details style={{ marginTop: running.length ? 12 : 0 }}>
                <summary
                  style={{
                    cursor: "pointer",
                    fontFamily: "var(--font-data)",
                    fontSize: 11,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--bow-slate)",
                  }}
                >
                  {finished.length} finished
                </summary>
                <div style={{ marginTop: 10 }}>
                  {finished.map((program) => (
                    <ProgramLine key={program.id} program={program} />
                  ))}
                </div>
              </details>
            ) : null}
          </>
        )}
      </section>

      {/* History. Notes and everything the systems recorded, one list. */}
      <section style={{ marginTop: 30 }}>
        <h2 style={sectionHeading}>History</h2>
        <PartnerNoteComposer organizationId={record.id} />
        {record.activity.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--bow-slate)" }}>Nothing recorded yet.</p>
        ) : (
          record.activity.map((entry) => (
            <div key={entry.id} style={{ padding: "11px 0", borderTop: "1px solid var(--border-rule)" }}>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "var(--bow-ink)" }}>{entry.body}</p>
              <span
                style={{
                  display: "block",
                  marginTop: 4,
                  fontFamily: "var(--font-data)",
                  fontSize: 10.5,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--bow-slate)",
                }}
              >
                {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(entry.at)}
                {entry.actor ? ` · ${entry.actor}` : ""}
              </span>
            </div>
          ))
        )}
      </section>

      {/* Lifecycle is a real decision with consequences, so it stays a
          deliberate control at the bottom rather than a status dropdown. */}
      <section style={{ marginTop: 34 }}>
        <h2 style={sectionHeading}>Status</h2>
        {lifecycleStatus ? (
          <PartnerLifecycleActions
            organizationId={record.id}
            organizationName={record.name}
            currentStatus={lifecycleStatus}
            impact={lifecycleImpact}
            latestLifecycleEvent={latestLifecycleEvent}
            protectedOrganization={record.id === SELF_PACED_ORG_ID || record.type.trim().toLowerCase() === "bow"}
          />
        ) : (
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: "var(--bow-slate)" }}>
            This record carries a status V1 does not recognise ({record.status}). An administrator has to reconcile it
            before the lifecycle can change.
          </p>
        )}
      </section>
    </div>
  );
}

function ProgramLine({ program }: { program: PartnerRecord["programs"][number] }) {
  return (
    <div style={{ padding: "11px 0", borderTop: "1px solid var(--border-rule)" }}>
      <Link href={`/app/programs/${program.id}`} style={{ fontSize: 14.5, color: "var(--bow-ink)" }}>
        {program.name}
      </Link>
      <span
        style={{
          display: "block",
          marginTop: 3,
          fontFamily: "var(--font-data)",
          fontSize: 10.5,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--bow-slate)",
        }}
      >
        {[
          program.stageLabel,
          program.classes ? `${program.classes} section${program.classes === 1 ? "" : "s"}` : null,
          program.students ? `${program.students} enrolled` : null,
          program.startDate,
        ]
          .filter(Boolean)
          .join(" · ")}
      </span>
    </div>
  );
}

/**
 * What closing or pausing this partner would actually affect. The lifecycle
 * control already existed and already takes these three counts; this is the
 * same query it was given before, moved out of the page body.
 */
async function readLifecycleImpact(organizationId: string) {
  const db = getDb();
  const [programs, cohorts, classes] = await Promise.all([
    db
      .prepare(
        `SELECT COUNT(*) AS count FROM programs
          WHERE partner_org_id = ? AND stage NOT IN ('completed','renewal_review','renewed','closed')`,
      )
      .get(organizationId) as Promise<{ count: number }>,
    db
      .prepare("SELECT COUNT(*) AS count FROM cohorts WHERE org_id = ? AND status IN ('active','enrolling')")
      .get(organizationId) as Promise<{ count: number }>,
    db
      .prepare(
        `SELECT COUNT(*) AS count FROM classes c
          WHERE c.status NOT IN ('completed','cancelled')
            AND (c.partner_org_id = ?
                 OR EXISTS (SELECT 1 FROM programs p WHERE p.id = c.program_id AND p.partner_org_id = ?))`,
      )
      .get(organizationId, organizationId) as Promise<{ count: number }>,
  ]);
  return {
    currentPrograms: Number(programs.count),
    activeOrEnrollingCohorts: Number(cohorts.count),
    currentClasses: Number(classes.count),
  };
}
