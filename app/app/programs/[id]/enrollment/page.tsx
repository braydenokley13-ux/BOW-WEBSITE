import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, DataTable, PageHeader, PageSection } from "@/components/ds";
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
            <Link href={`/app/programs/${id}/waitlist`} className="bow-button bow-button--secondary bow-button--sm">
              Waitlist board
            </Link>
            <Link href={`/app/programs/${id}/requirements`} className="bow-button bow-button--secondary bow-button--sm">
              Requirements
            </Link>
            <Link href={`/app/programs/${id}/setup`} className="bow-button bow-button--secondary bow-button--sm">
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
          <DataTable columns={["Child", "Guardian", "Problem", "Deadline", ""]} minWidth={760}>
            {attention.map((item, i) => (
              <tr key={`${item.registrationId ?? item.studentId}-${i}`} style={{ borderBottom: "1px solid var(--border-rule)" }}>
                <td style={{ padding: "10px 12px" }}>{item.studentName}</td>
                <td style={{ padding: "10px 12px" }}>{item.guardianName ?? "—"}</td>
                <td style={{ padding: "10px 12px" }}>
                  <Badge status="warning">{ATTENTION_LABEL[item.kind] ?? item.kind}</Badge>{" "}
                  <span style={{ color: "var(--bow-slate)" }}>{item.problem}</span>
                </td>
                <td style={{ padding: "10px 12px" }}>{fmtDeadline(item.deadline)}</td>
                <td style={{ padding: "10px 12px", textAlign: "right" }}>
                  <Link href={item.actionHref} className="bow-button bow-button--ghost bow-button--sm">
                    {item.actionLabel}
                  </Link>
                </td>
              </tr>
            ))}
          </DataTable>
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
              className="bow-button bow-button--ghost bow-button--sm"
              style={(status || "") === f.key ? { textDecoration: "underline" } : undefined}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <DataTable
          columns={["Child", "Grade", "Guardian", "Status", "Class", "Reservation", "Requirements", ""]}
          minWidth={880}
          isEmpty={registrations.length === 0}
          emptyLabel="No registrations match this filter."
        >
          {registrations.map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid var(--border-rule)" }}>
              <td style={{ padding: "10px 12px" }}>{r.studentName}</td>
              <td style={{ padding: "10px 12px" }}>{r.grade ?? "—"}</td>
              <td style={{ padding: "10px 12px" }}>
                {r.guardianName ?? "—"}
                {r.guardianEmail ? <div style={{ fontSize: 11, color: "var(--bow-slate)" }}>{r.guardianEmail}</div> : null}
              </td>
              <td style={{ padding: "10px 12px" }}>{r.statusLabel}</td>
              <td style={{ padding: "10px 12px" }}>{r.className ?? "—"}</td>
              <td style={{ padding: "10px 12px" }}>{fmtDeadline(r.reservationExpiresAt)}</td>
              <td style={{ padding: "10px 12px" }}>{r.requirementsOutstanding > 0 ? `${r.requirementsOutstanding} pending` : "Complete"}</td>
              <td style={{ padding: "10px 12px", textAlign: "right" }}>
                <Link href={`/app/programs/${id}/enrollment?open=${r.id}`} className="bow-button bow-button--ghost bow-button--sm">
                  Open
                </Link>
              </td>
            </tr>
          ))}
        </DataTable>
      </PageSection>
    </div>
  );
}
