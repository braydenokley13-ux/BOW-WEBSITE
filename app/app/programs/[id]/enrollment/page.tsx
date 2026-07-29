import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, PageHeader, PageSection } from "@/components/ds";
import { requireStaff } from "@/lib/dal";
import { sweepExpirations } from "@/lib/enrollment";
import {
  enrollmentCounts,
  listRegistrations,
  loadProgramSummary,
  loadRegistrationDetail,
  needsAttention,
} from "@/lib/program-admin";
import RegistrationDetailPanel from "@/components/admin/enrollment/RegistrationDetailPanel";

function fmtDeadline(ms: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const ATTENTION_LABEL: Record<string, string> = {
  reservation_expiring: "Reservation expiring",
  reservation_expired: "Reservation expired",
  requirement_missing: "Requirement missing",
  under_review: "Needs review",
  duplicate_child: "Possible duplicate",
  activation_failed: "Activation failed",
  offer_expiring: "Offer expiring",
  family_request: "Family request",
  missing_class_placement: "Not placed in class",
};

export default async function EnrollmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; q?: string; open?: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const { status, q, open } = await searchParams;

  const summary = await loadProgramSummary(id);
  if (!summary) notFound();

  // Opportunistic convergence: an admin loading this page should never see a
  // stale reservation or offer sitting past its deadline just because no
  // scheduled sweep has run yet.
  await sweepExpirations();

  const [counts, attention, registrations] = await Promise.all([
    enrollmentCounts(id),
    needsAttention(id),
    listRegistrations(id, { status: status || null, q: q || null }),
  ]);
  const detail = open ? await loadRegistrationDetail(open) : null;

  const statusFilters = [
    { key: "", label: "All" },
    { key: "confirmed", label: "Confirmed" },
    { key: "seat_reserved", label: "Reserved" },
    { key: "under_review", label: "Under review" },
    { key: "waitlisted", label: "Waitlisted" },
    { key: "offer_sent", label: "Offer sent" },
    { key: "withdrawn", label: "Withdrawn" },
    { key: "cancelled", label: "Cancelled" },
    { key: "completed", label: "Completed" },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Programs · Enrollment"
        title={summary.name}
        context="Registration lifecycle, requirements, and seat decisions for this program."
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <Link href={`/app/programs/${id}/waitlist`} className="bow-button bow-button-secondary bow-button-sm">
              Waitlist board
            </Link>
            <Link href={`/app/programs/${id}/requirements`} className="bow-button bow-button-secondary bow-button-sm">
              Requirements
            </Link>
            <Link href={`/app/programs/${id}/setup`} className="bow-button bow-button-secondary bow-button-sm">
              Setup
            </Link>
          </div>
        }
      />

      <PageSection title="Summary" noRule>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
          {[
            ["Capacity", counts.capacity ?? "—"],
            ["Remaining", counts.remaining ?? "—"],
            ["Confirmed", counts.confirmed],
            ["Reserved", counts.reserved],
            ["Requirements pending", counts.requirementsPending],
            ["Under review", counts.underReview],
            ["Waitlisted", counts.waitlisted],
            ["Offers outstanding", counts.offersOutstanding],
            ["Withdrawn", counts.withdrawn],
            ["Cancelled", counts.cancelled],
            ["Completed", counts.completed],
          ].map(([label, value]) => (
            <div key={label as string} style={{ border: "1px solid var(--border-rule)", borderRadius: 6, padding: "10px 12px" }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--bow-slate)" }}>{label}</div>
              <div style={{ fontFamily: "var(--font-data)", fontSize: 22 }}>{value}</div>
            </div>
          ))}
        </div>
      </PageSection>

      <PageSection title={`Needs attention (${attention.length})`}>
        {attention.length === 0 ? (
          <p style={{ color: "var(--bow-slate)" }}>Nothing needs attention right now.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {attention.map((item, i) => (
              <div
                key={`${item.registrationId ?? item.studentId}-${i}`}
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
                    <Badge status="warning">{ATTENTION_LABEL[item.kind] ?? item.kind}</Badge>
                    <span className="ops-record-name" style={{ fontSize: 14 }}>{item.studentName}</span>
                    {item.guardianName && <span className="ops-record-meta">· {item.guardianName}</span>}
                  </div>
                  <span className="ops-record-meta">{item.problem}</span>
                  {item.deadline && <span className="ops-record-meta">Deadline {fmtDeadline(item.deadline)}</span>}
                </div>
                <Link href={item.actionHref} className="bow-button bow-button-ghost bow-button-sm">
                  {item.actionLabel}
                </Link>
              </div>
            ))}
          </div>
        )}
      </PageSection>

      {detail && (
        <PageSection title={`Registration — ${detail.studentName}`}>
          <RegistrationDetailPanel detail={detail} programId={id} classId={summary.classId} />
        </PageSection>
      )}

      <PageSection title="Registrations">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {statusFilters.map((f) => (
            <Link
              key={f.key || "all"}
              href={`/app/programs/${id}/enrollment${f.key ? `?status=${f.key}` : ""}`}
              className="bow-button bow-button-ghost bow-button-sm"
              style={(status || "") === f.key ? { textDecoration: "underline" } : undefined}
            >
              {f.label}
            </Link>
          ))}
        </div>
        {registrations.length === 0 ? (
          <div className="ops-empty">
            <p className="ops-empty__body" style={{ margin: 0 }}>No registrations match this filter.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {registrations.map((r) => (
              <div
                key={r.id}
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
                    <span className="ops-record-name" style={{ fontSize: 14 }}>{r.studentName}</span>
                    {r.grade && <span className="ops-record-meta">· Grade {r.grade}</span>}
                    <Badge status="info">{r.statusLabel}</Badge>
                  </div>
                  <span className="ops-record-meta">
                    {r.guardianName ?? "No guardian"}
                    {r.guardianEmail ? ` (${r.guardianEmail})` : ""}
                  </span>
                  <span className="ops-record-meta">
                    {r.className ?? "Not placed"} · Reservation {fmtDeadline(r.reservationExpiresAt)} ·{" "}
                    {r.requirementsOutstanding > 0 ? `${r.requirementsOutstanding} requirement${r.requirementsOutstanding === 1 ? "" : "s"} pending` : "Requirements complete"}
                  </span>
                </div>
                <Link href={`/app/programs/${id}/enrollment?open=${r.id}`} className="bow-button bow-button-ghost bow-button-sm">
                  Open
                </Link>
              </div>
            ))}
          </div>
        )}
      </PageSection>
    </div>
  );
}
