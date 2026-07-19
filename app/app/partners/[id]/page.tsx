import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Button, SectionHeader } from "@/components/ds";
import { requireStaff } from "@/lib/dal";
import { getDb } from "@/lib/db";
import { getOrganizationDetail, listActivity } from "@/lib/hiring";
import PartnerLifecycleActions from "@/components/app/partners/PartnerLifecycleActions";
import { SELF_PACED_ORG_ID } from "@/lib/account";
import type { PartnerLifecycleStatus } from "@/app/actions/partners";

const cardStyle = { background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 22 } as const;
const labelStyle = { fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "var(--bow-slate)" };
const valueStyle = { fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-ink)" };
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
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px clamp(16px,4vw,32px) 96px", display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionHeader kicker="Partners" title={org.name} level={1} />
      <div style={{ display: "flex", gap: 10 }}>
        <Badge status="info">{org.type}</Badge>
        <Badge status="neutral">{org.status}</Badge>
      </div>

      <div style={cardStyle}>
        <span style={labelStyle}>Location</span>
        <p style={valueStyle}>{org.location || "—"}</p>
      </div>

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
        <div role="alert" style={{ ...cardStyle, borderLeft: "4px solid var(--bow-negative)" }}>
          <span style={{ ...labelStyle, color: "var(--bow-negative)" }}>Lifecycle needs reconciliation</span>
          <p style={{ ...valueStyle, lineHeight: 1.55 }}>
            This legacy organization uses an unsupported status. An administrator must reconcile it before staff can change its lifecycle.
          </p>
        </div>
      )}

      <div style={cardStyle}>
        <span style={{ ...labelStyle, display: "block", marginBottom: 12 }}>Partner contacts</span>
        {contacts.length === 0 && <p style={valueStyle}>No active contact relationship is connected yet.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {contacts.map((contact) => {
            const unavailable = contact.name.trim().toLowerCase() === "deleted account"
              || contact.email.trim().toLowerCase().endsWith("@deleted.invalid");
            return (
              <div key={contact.id} style={{ borderBottom: "1px solid var(--border-rule)", paddingBottom: 10 }}>
                <span style={{ ...valueStyle, fontWeight: 700 }}>{unavailable ? "Contact unavailable" : contact.name}</span>
                <span style={{ ...labelStyle, display: "block", marginTop: 3 }}>
                  {contact.relationship_types.split(",").map((relationship) => relationship.replace(/_/g, " ")).join(" · ")}{contact.is_primary === 1 ? " · primary" : ""}
                </span>
                {!unavailable && <a href={`mailto:${encodeURIComponent(contact.email)}`} style={{ ...valueStyle, color: "var(--bow-blue)" }}>{contact.email}</a>}
              </div>
            );
          })}
        </div>
      </div>

      <div style={cardStyle}>
        <span style={{ ...labelStyle, display: "block", marginBottom: 12 }}>Demand and inquiry history</span>
        {inquiries.length === 0 && <p style={valueStyle}>No public inquiry is connected to this partner.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {inquiries.map((inquiry) => {
            const canConvert = !inquiry.program_id && ["new", "reviewing", "contacted"].includes(inquiry.status);
            return (
              <article id={`inquiry-${inquiry.id}`} key={inquiry.id} style={{ border: "1px solid var(--border-rule)", borderRadius: 4, padding: 14, scrollMarginTop: 84 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <span style={{ ...valueStyle, fontWeight: 700 }}>{inquiry.type} inquiry from {inquiry.name}</span>
                    <span style={{ ...labelStyle, display: "block", marginTop: 3 }}>{inquiry.date} · {inquiry.status.replace(/_/g, " ")}</span>
                  </div>
                  {inquiry.program_id ? <Badge status="positive">Converted</Badge> : <Badge status="info">Intake</Badge>}
                </div>
                <p style={{ ...valueStyle, lineHeight: 1.55, margin: "10px 0" }}>{inquiry.summary}</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <a href={`mailto:${encodeURIComponent(inquiry.email)}`} style={{ ...valueStyle, color: "var(--bow-blue)" }}>Email contact</a>
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
      </div>

      <div style={cardStyle}>
        <span style={{ ...labelStyle, display: "block", marginBottom: 12 }}>Programs with this partner</span>
        {programs.length === 0 && <p style={valueStyle}>No Program operating record exists yet.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {programs.map((program) => (
            <div key={program.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <Link href={`/app/programs/${program.id}`} style={{ ...valueStyle, color: "var(--bow-blue)", fontWeight: 700 }}>{program.name}</Link>
                <span style={{ ...labelStyle, display: "block", marginTop: 3 }}>{program.stage.replace(/_/g, " ")}</span>
              </div>
              {program.outcome_summary && <Badge status="positive">Outcome captured</Badge>}
            </div>
          ))}
        </div>
      </div>

      <div style={cardStyle}>
        <span style={{ ...labelStyle, display: "block", marginBottom: 12 }}>Classes with this partner</span>
        {relatedClasses.length === 0 && <p style={valueStyle}>No classes yet.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {relatedClasses.map((c) => (
            <Link key={c.id} href={`/app/classes/${c.id}`} style={{ ...valueStyle, color: "var(--bow-blue)" }}>
              {c.title} — {c.status}
            </Link>
          ))}
        </div>
      </div>

      <div style={cardStyle}>
        <span style={{ ...labelStyle, display: "block", marginBottom: 12 }}>Activity</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {activity.length === 0 && <span style={valueStyle}>No activity yet.</span>}
          {activity.map((a) => (
            <div key={a.id} style={{ borderBottom: "1px solid var(--border-rule)", paddingBottom: 8 }}>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)" }}>
                {new Date(a.createdAt).toLocaleString()} · {a.kind}
              </span>
              <p style={{ ...valueStyle, margin: "2px 0 0" }}>{a.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
