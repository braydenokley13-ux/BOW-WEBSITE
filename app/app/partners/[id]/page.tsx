import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Button } from "@/components/ds";
import { requireStaff } from "@/lib/dal";
import { getDb } from "@/lib/db";
import { getOrganizationDetail, listActivity } from "@/lib/hiring";
import PartnerLifecycleActions from "@/components/app/partners/PartnerLifecycleActions";
import { SELF_PACED_ORG_ID } from "@/lib/account";
import type { PartnerLifecycleStatus } from "@/app/actions/partners";

const lifecycleStatuses = new Set<PartnerLifecycleStatus>(["prospect", "active", "paused", "closed"]);

export default async function PartnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const detail = (await getOrganizationDetail(id));
  if (!detail) notFound();
  const { org, relatedClasses } = detail;
  const activity = (await listActivity("organization", id));
  const db = getDb();
  const contacts = (await db.prepare(
      `SELECT p.id, p.name, p.email, p.phone,
            group_concat(DISTINCT op.relationship_type) AS relationship_types,
            max(op.is_primary) AS is_primary
       FROM organization_people op
       JOIN people p ON p.id = op.person_id
      WHERE op.organization_id = ? AND op.active = 1
      GROUP BY p.id, p.name, p.email, p.phone
      ORDER BY max(op.is_primary) DESC, p.name`,
    ).all(id)) as {
    id: string;
    name: string;
    email: string;
    phone: string;
    relationship_types: string;
    is_primary: number;
  }[];
  const programs = (await db.prepare(
      `SELECT id, name, stage, source_type, source_id, outcome_summary
       FROM programs
      WHERE partner_org_id = ?
      ORDER BY updated_at DESC`,
    ).all(id)) as {
    id: string;
    name: string;
    stage: string;
    source_type: string | null;
    source_id: string | null;
    outcome_summary: string | null;
  }[];
  const inquiries = (await db.prepare(
      `SELECT i.id, i.name, i.email, i.type, i.date, i.status, i.summary,
            (
              SELECT p.id FROM programs p
               WHERE p.source_type = 'inquiry' AND p.source_id = i.id
               ORDER BY p.created_at DESC LIMIT 1
            ) AS program_id,
            (
              SELECT p.name FROM programs p
               WHERE p.source_type = 'inquiry' AND p.source_id = i.id
               ORDER BY p.created_at DESC LIMIT 1
            ) AS program_name,
            (
              SELECT p.stage FROM programs p
               WHERE p.source_type = 'inquiry' AND p.source_id = i.id
               ORDER BY p.created_at DESC LIMIT 1
            ) AS program_stage
       FROM inquiries i
      WHERE i.organization_id = ?
         OR EXISTS (
           SELECT 1 FROM programs linked
            WHERE linked.source_type = 'inquiry' AND linked.source_id = i.id AND linked.partner_org_id = ?
         )
      ORDER BY i.rowid DESC`,
    ).all(id, id)) as {
    id: string;
    name: string;
    email: string;
    type: string;
    date: string;
    status: string;
    summary: string;
    program_id: string | null;
    program_name: string | null;
    program_stage: string | null;
  }[];
  const lifecycleImpact = {
    currentPrograms: ((await db.prepare(
            `SELECT COUNT(*) AS count
         FROM programs
        WHERE partner_org_id = ?
          AND stage NOT IN ('completed','renewal_review','renewed','closed')`,
          ).get(id)) as { count: number }).count,
    activeOrEnrollingCohorts: ((await db.prepare(
          "SELECT COUNT(*) AS count FROM cohorts WHERE org_id = ? AND status IN ('active','enrolling')",
        ).get(id)) as { count: number }).count,
    currentClasses: ((await db.prepare(
          `SELECT COUNT(*) AS count
         FROM classes c
        WHERE c.status NOT IN ('completed','cancelled')
          AND (
            c.partner_org_id = ?
            OR EXISTS (
              SELECT 1 FROM programs p
               WHERE p.id = c.program_id AND p.partner_org_id = ?
            )
          )`,
        ).get(id, id)) as { count: number }).count,
  };
  const latestLifecycleEvent = activity.find((entry) => entry.kind === "lifecycle")?.body ?? null;
  const lifecycleStatus = lifecycleStatuses.has(org.status as PartnerLifecycleStatus)
    ? org.status as PartnerLifecycleStatus
    : null;

  return (
    <main className="ops-page" data-accent="blue">
      <header className="ops-hero">
        <div className="ops-hero__copy">
          <span className="ops-eyebrow">Partners</span>
          <h1 className="ops-title">{org.name}</h1>
          <div className="ops-status-line">
            <Badge status="info">{org.type}</Badge>
            <Badge status="neutral">{org.status}</Badge>
            <span className="ops-record-meta">{org.location || "Location not set"}</span>
          </div>
        </div>
      </header>

      {lifecycleStatus ? (
        <PartnerLifecycleActions
          organizationId={org.id}
          organizationName={org.name}
          currentStatus={lifecycleStatus}
          impact={lifecycleImpact}
          latestLifecycleEvent={latestLifecycleEvent}
          protectedOrganization={org.id === SELF_PACED_ORG_ID || org.type.trim().toLowerCase() === "bow"}
        />
      ) : (
        <div className="ops-alert" role="alert">
          <span className="ops-alert__title">Lifecycle needs reconciliation</span>
          <p className="ops-body" style={{ marginTop: 6 }}>
            This legacy organization uses an unsupported status. An administrator must reconcile it before staff can change its lifecycle.
          </p>
        </div>
      )}

      <section className="ops-panel">
        <div className="ops-section-head">
          <h2 className="ops-section-title">Partner contacts</h2>
        </div>
        {contacts.length === 0 ? (
          <p className="ops-body">No active contact relationship is connected yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {contacts.map((contact) => {
              const unavailable = contact.name.trim().toLowerCase() === "deleted account"
                || contact.email.trim().toLowerCase().endsWith("@deleted.invalid");
              return (
                <div key={contact.id} style={{ borderBottom: "1px solid var(--border-rule)", paddingBottom: 10 }}>
                  <span className="ops-value" style={{ fontWeight: 700 }}>{unavailable ? "Contact unavailable" : contact.name}</span>
                  <span className="ops-record-meta">
                    {contact.relationship_types.split(",").map((relationship) => relationship.replace(/_/g, " ")).join(" · ")}{contact.is_primary === 1 ? " · primary" : ""}
                  </span>
                  {!unavailable && <a href={`mailto:${encodeURIComponent(contact.email)}`} className="ops-inline-link" style={{ display: "inline-block", marginTop: 4 }}>{contact.email}</a>}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="ops-panel">
        <div className="ops-section-head">
          <h2 className="ops-section-title">Demand and inquiry history</h2>
        </div>
        {inquiries.length === 0 ? (
          <p className="ops-body">No public inquiry is connected to this partner.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {inquiries.map((inquiry) => {
              const canConvert = !inquiry.program_id && ["new", "reviewing", "contacted"].includes(inquiry.status);
              return (
                <article id={`inquiry-${inquiry.id}`} className="ops-anchor" key={inquiry.id} style={{ border: "1px solid var(--border-rule)", borderRadius: 4, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <span className="ops-value" style={{ fontWeight: 700 }}>{inquiry.type} inquiry from {inquiry.name}</span>
                      <span className="ops-record-meta">{inquiry.date} · {inquiry.status.replace(/_/g, " ")}</span>
                    </div>
                    {inquiry.program_id ? <Badge status="positive">Converted</Badge> : <Badge status="info">Intake</Badge>}
                  </div>
                  <p className="ops-body" style={{ margin: "10px 0" }}>{inquiry.summary}</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <a href={`mailto:${encodeURIComponent(inquiry.email)}`} className="ops-inline-link">Email contact</a>
                    <Button href={`/app/inquiries#inquiry-${encodeURIComponent(inquiry.id)}`} variant="secondary" size="sm">
                      Open in Demand Inbox
                    </Button>
                    {inquiry.program_id && (
                      <Button href={`/app/programs/${inquiry.program_id}`} variant="secondary" size="sm">
                        Open {inquiry.program_name ?? "Program"}
                      </Button>
                    )}
                    {canConvert && (
                      <Button href={`/app/programs/new?source=inquiry&sourceId=${encodeURIComponent(inquiry.id)}`} variant="emphasis" size="sm">
                        Create Connected Program
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="ops-panel">
        <div className="ops-section-head">
          <h2 className="ops-section-title">Programs with this partner</h2>
        </div>
        {programs.length === 0 ? (
          <p className="ops-body">No Program operating record exists yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {programs.map((program) => (
              <div key={program.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div>
                  <Link href={`/app/programs/${program.id}`} className="ops-inline-link">{program.name}</Link>
                  <span className="ops-record-meta">{program.stage.replace(/_/g, " ")}</span>
                </div>
                {program.outcome_summary && <Badge status="positive">Outcome captured</Badge>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="ops-panel">
        <div className="ops-section-head">
          <h2 className="ops-section-title">Classes with this partner</h2>
        </div>
        {relatedClasses.length === 0 ? (
          <p className="ops-body">No classes yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {relatedClasses.map((c) => (
              <Link key={c.id} href={`/app/classes/${c.id}`} className="ops-inline-link">
                {c.title} — {c.status}
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="ops-panel">
        <div className="ops-section-head">
          <h2 className="ops-section-title">Activity</h2>
        </div>
        {activity.length === 0 ? (
          <span className="ops-body">No activity yet.</span>
        ) : (
          <div className="ops-timeline">
            {activity.map((a) => (
              <div key={a.id} className="ops-timeline__item">
                <span className="ops-record-meta">
                  {new Date(a.createdAt).toLocaleString()} · {a.kind}
                </span>
                <p className="ops-body" style={{ margin: "2px 0 0" }}>{a.body}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
