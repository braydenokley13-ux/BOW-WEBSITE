import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, PageSection, RecordShell } from "@/components/ds";
import { requireStaff } from "@/lib/dal";
import { getFirstSessionPrep } from "@/lib/program-admin";
import { resolveSupportNote } from "@/app/actions/family-support";
import { resendActivation } from "@/app/actions/registration-admin";
import { retryDelivery } from "@/app/actions/family-notifications";
import { sessionStatusLabel, prepStatusLabel, assignmentStatusLabel, assignmentRoleLabel } from "@/lib/delivery-shared";
import ContactFamilyButton from "@/components/admin/first-session/ContactFamilyButton";
import ConfirmActionButton from "@/components/admin/first-session/ConfirmActionButton";
import ExtendReservationButton from "@/components/admin/first-session/ExtendReservationButton";
import AssignClassButton from "@/components/admin/first-session/AssignClassButton";

/**
 * One prep view per program's upcoming start. Every row here comes from a
 * read this codebase already trusts elsewhere (needsAttention,
 * enrollmentCounts, listFailedCommunications) plus two reads that had no
 * home before this page: portal-access gaps (students.user_id) and open
 * family_support_notes "issue" rows. Every action button below calls an
 * existing server action — nothing here writes a registration directly.
 */
export default async function FirstSessionPrepPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const prep = await getFirstSessionPrep(id);
  if (!prep) notFound();

  const classOptions = prep.classes.map((c) => ({ id: c.classId, title: c.className }));

  const reservationItems = prep.attention.filter(
    (a) => a.kind === "reservation_expiring" || a.kind === "reservation_expired",
  );
  const requirementItems = prep.attention.filter((a) => a.kind === "requirement_missing");
  const placementItems = prep.attention.filter((a) => a.kind === "missing_class_placement");
  const otherItems = prep.attention.filter(
    (a) =>
      a.kind !== "reservation_expiring" &&
      a.kind !== "reservation_expired" &&
      a.kind !== "requirement_missing" &&
      a.kind !== "missing_class_placement",
  );

  return (
    <RecordShell
      eyebrow="Programs · First-session prep"
      title={prep.programName}
      subtitle={`${prep.startDate ? `Starts ${prep.startDate} · ` : ""}${prep.confirmed} confirmed · ${prep.reserved} reserved`}
      actions={<Link href={`/app/programs/${id}`} className="bow-button bow-button-secondary bow-button-sm">Back to program</Link>}
    >
      <PageSection title="Enrollment snapshot" noRule>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 14 }}>
          <Stat label="Confirmed students" value={prep.confirmed} />
          <Stat label="Reserved (not yet confirmed)" value={prep.reserved} />
          <Stat label="Missing requirements" value={requirementItems.length} tone={requirementItems.length ? "warning" : undefined} />
          <Stat label="Failed activations" value={prep.activationFailures.length} tone={prep.activationFailures.length ? "negative" : undefined} />
          <Stat label="Missing portal access" value={prep.studentsMissingPortalAccess.length} tone={prep.studentsMissingPortalAccess.length ? "warning" : undefined} />
          <Stat label="Missing class placement" value={placementItems.length} tone={placementItems.length ? "warning" : undefined} />
          <Stat label="Unresolved logistics questions" value={prep.unresolvedLogistics.length} tone={prep.unresolvedLogistics.length ? "warning" : undefined} />
          <Stat label="Failed reminders" value={prep.failedReminders.length} tone={prep.failedReminders.length ? "negative" : undefined} />
        </div>
      </PageSection>

      <PageSection title="Instructor assignment & session readiness">
        {prep.classes.length === 0 && <p style={{ color: "var(--bow-slate)" }}>No live class attached to this program yet.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {prep.classes.map((c) => (
            <div key={c.classId} style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <strong>{c.className}</strong>
                {c.firstSession ? (
                  <Badge status={c.firstSession.prepStatus === "ready" ? "positive" : c.firstSession.prepStatus === "in_preparation" ? "warning" : "negative"}>
                    {prepStatusLabel(c.firstSession.prepStatus)}
                  </Badge>
                ) : (
                  <Badge status="neutral">No session scheduled</Badge>
                )}
              </div>
              {c.firstSession && (
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--bow-slate)" }}>
                  First session {new Date(c.firstSession.sessionDate).toLocaleString()} · {sessionStatusLabel(c.firstSession.status)}
                </p>
              )}
              {c.assignments.length === 0 ? (
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--bow-negative)" }}>No instructor assigned.</p>
              ) : (
                <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13 }}>
                  {c.assignments.map((a) => (
                    <li key={a.id}>
                      {a.instructorName ?? "Unnamed instructor"} — {assignmentRoleLabel(a.role)}, {assignmentStatusLabel(a.status)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </PageSection>

      <PageSection title="Reservations at risk">
        {reservationItems.length === 0 ? (
          <p style={{ color: "var(--bow-slate)" }}>Nothing expiring soon.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {reservationItems.map((item) => (
              <div key={`${item.kind}-${item.registrationId}`} style={cardStyle}>
                <RowHead studentName={item.studentName} guardianName={item.guardianName} problem={item.problem} />
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  {item.registrationId && <ExtendReservationButton registrationId={item.registrationId} studentName={item.studentName} />}
                  <ContactFamilyButton studentId={item.studentId} programId={id} registrationId={item.registrationId} />
                </div>
              </div>
            ))}
          </div>
        )}
      </PageSection>

      <PageSection title="Missing forms / requirements">
        {requirementItems.length === 0 ? (
          <p style={{ color: "var(--bow-slate)" }}>Nothing outstanding.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {requirementItems.map((item) => (
              <div key={`${item.kind}-${item.registrationId}`} style={cardStyle}>
                <RowHead studentName={item.studentName} guardianName={item.guardianName} problem={item.problem} />
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <Link href={item.actionHref} className="bow-button bow-button-secondary bow-button-sm">
                    Review requirement
                  </Link>
                  <ContactFamilyButton studentId={item.studentId} programId={id} registrationId={item.registrationId} />
                </div>
              </div>
            ))}
          </div>
        )}
      </PageSection>

      <PageSection title="Failed activations">
        {prep.activationFailures.length === 0 ? (
          <p style={{ color: "var(--bow-slate)" }}>No guardian activation failures for this program.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {prep.activationFailures.map((a) => (
              <div key={a.personId} style={cardStyle}>
                <RowHead studentName={a.studentName} guardianName={a.guardianName} problem="Guardian account activation failed." />
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <ConfirmActionButton
                    action={() => resendActivation(a.personId)}
                    title="Resend activation"
                    description={`Re-queues the account activation invitation for ${a.guardianName ?? "this guardian"}.`}
                    confirmLabel="Resend activation"
                    notice="Sends a new activation email to the guardian."
                  >
                    Resend activation
                  </ConfirmActionButton>
                  <ContactFamilyButton personId={a.personId} studentId={a.studentId} programId={id} registrationId={a.registrationId} />
                </div>
              </div>
            ))}
          </div>
        )}
      </PageSection>

      <PageSection title="Students missing portal access">
        {prep.studentsMissingPortalAccess.length === 0 ? (
          <p style={{ color: "var(--bow-slate)" }}>Every confirmed student has portal access.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {prep.studentsMissingPortalAccess.map((s) => (
              <div key={s.registrationId} style={cardStyle}>
                <RowHead studentName={s.studentName} guardianName={null} problem="Confirmed, but this student has no portal login yet." />
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <ContactFamilyButton studentId={s.studentId} programId={id} registrationId={s.registrationId} />
                </div>
              </div>
            ))}
          </div>
        )}
      </PageSection>

      <PageSection title="Class placement missing">
        {placementItems.length === 0 ? (
          <p style={{ color: "var(--bow-slate)" }}>Every confirmed seat has a class.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {placementItems.map((item) => (
              <div key={`${item.kind}-${item.registrationId}`} style={cardStyle}>
                <RowHead studentName={item.studentName} guardianName={item.guardianName} problem={item.problem} />
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  {item.registrationId && (
                    <AssignClassButton registrationId={item.registrationId} studentName={item.studentName} classes={classOptions} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </PageSection>

      <PageSection title="Unresolved logistics questions">
        {prep.unresolvedLogistics.length === 0 ? (
          <p style={{ color: "var(--bow-slate)" }}>Nothing open.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {prep.unresolvedLogistics.map((q) => (
              <div key={q.id} style={cardStyle}>
                <RowHead studentName={q.studentName ?? q.guardianName ?? "Family"} guardianName={q.guardianName} problem={q.note} />
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <ConfirmActionButton
                    action={() => resolveSupportNote(q.id)}
                    title="Mark issue resolved"
                    description="Marks this open logistics question as resolved."
                    confirmLabel="Mark resolved"
                    notice="No message is sent to the family."
                  >
                    Mark resolved
                  </ConfirmActionButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </PageSection>

      <PageSection title="Failed reminders">
        {prep.failedReminders.length === 0 ? (
          <p style={{ color: "var(--bow-slate)" }}>No failed deliveries for this program.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {prep.failedReminders.map((n) => (
              <div key={n.id} style={cardStyle}>
                <RowHead studentName={n.studentName ?? "Family"} guardianName={null} problem={n.title} />
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <ConfirmActionButton
                    action={() => retryDelivery(n.id)}
                    title="Resend reminder"
                    description={`Retries delivery of "${n.title}".`}
                    confirmLabel="Resend"
                    notice="Sends the message again to the family."
                  >
                    Resend
                  </ConfirmActionButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </PageSection>

      {otherItems.length > 0 && (
        <PageSection title="Other open items">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {otherItems.map((item) => (
              <div key={`${item.kind}-${item.registrationId ?? item.studentId}`} style={cardStyle}>
                <RowHead studentName={item.studentName} guardianName={item.guardianName} problem={item.problem} />
                <div style={{ marginTop: 8 }}>
                  <Link href={item.actionHref} className="bow-button bow-button-secondary bow-button-sm">
                    {item.actionLabel}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </PageSection>
      )}
    </RecordShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warning" | "negative" }) {
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 800, color: tone === "negative" ? "var(--bow-negative)" : tone === "warning" ? "var(--bow-warning)" : "inherit" }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: "var(--bow-slate)" }}>{label}</div>
    </div>
  );
}

function RowHead({ studentName, guardianName, problem }: { studentName: string; guardianName: string | null; problem: string }) {
  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 14 }}>
        {studentName}
        {guardianName && <span style={{ fontWeight: 400, color: "var(--bow-slate)" }}> · guardian: {guardianName}</span>}
      </div>
      <div style={{ fontSize: 13, color: "var(--bow-slate)", marginTop: 2 }}>{problem}</div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  border: "1px solid var(--border-rule)",
  borderRadius: 8,
  padding: "12px 14px",
};
