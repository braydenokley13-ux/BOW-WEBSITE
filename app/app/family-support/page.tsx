import Link from "next/link";
import { getDb } from "@/lib/db";
import { requireStaff } from "@/lib/dal";
import { PageHeader, PageSection, Badge } from "@/components/ds";
import { isTerminal, primaryClassFor, registrationLabel } from "@/lib/enrollment";
import { loadRegistrationDetail } from "@/lib/program-admin";
import { getRestoreCheck, listTransferTargets, type TransferTarget } from "@/app/actions/family-support";
import RegistrationDetailPanel from "@/components/admin/enrollment/RegistrationDetailPanel";
import ResendActivationButton from "@/components/admin/enrollment/ResendActivationButton";
import ContactCorrectionDialog from "@/components/admin/family-support/ContactCorrectionDialog";
import AddGuardianDialog from "@/components/admin/family-support/AddGuardianDialog";
import RemoveGuardianButton from "@/components/admin/family-support/RemoveGuardianButton";
import AddSupportNoteForm from "@/components/admin/family-support/AddSupportNoteForm";
import ResolveRequestButtons from "@/components/admin/family-support/ResolveRequestButtons";
import RestoreRegistrationButton from "@/components/admin/family-support/RestoreRegistrationButton";
import TransferProgramDialog from "@/components/admin/family-support/TransferProgramDialog";

function fmt(ms: number | null | undefined): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const ACTIVATION_DIAGNOSIS: Record<string, string> = {
  invitation_pending: "Invitation sent, not yet opened. Resending replaces the link.",
  identity_created: "Guardian created a Supabase identity but the family link did not finish — usually a dropped step, safe to resend.",
  family_linked: "Family linked; activation should complete on next sign-in. If stuck, resend.",
  complete: "Fully activated. No action needed.",
  expired: "The invitation expired before it was used. Resend to issue a new one.",
  failed: "Provisioning failed on our side. Resend — if it fails again, this needs an engineering look, not another resend.",
  support_required: "This guardian's email matches an existing staff account. Activation cannot proceed automatically — resolve the email collision before resending.",
};

export default async function FamilySupportPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; studentId?: string; personId?: string }>;
}) {
  await requireStaff();
  const { q, studentId: studentIdParam, personId: personIdParam } = await searchParams;
  const db = getDb();

  let matches: { person_id: string; name: string; email: string | null; context: string }[] = [];
  if (q && q.trim()) {
    const term = q.trim();
    const like = `%${term}%`;
    matches = (await db
      .prepare(
        `SELECT DISTINCT pe.id AS person_id, pe.name, pe.email,
                COALESCE(
                  (SELECT s.name FROM students s WHERE s.name ILIKE ? AND EXISTS (
                     SELECT 1 FROM student_guardians sg2 WHERE sg2.student_id = s.id AND sg2.person_id = pe.id)
                   LIMIT 1),
                  (SELECT p.name FROM programs p JOIN program_registrations r ON r.program_id = p.id
                     JOIN student_guardians sg3 ON sg3.student_id = r.student_id
                    WHERE p.name ILIKE ? AND sg3.person_id = pe.id LIMIT 1),
                  ''
                ) AS context
           FROM people pe
           LEFT JOIN student_guardians sg ON sg.person_id = pe.id
           LEFT JOIN students s ON s.id = sg.student_id
           LEFT JOIN program_registrations r ON r.student_id = s.id
           LEFT JOIN programs pr ON pr.id = r.program_id
          WHERE pe.name ILIKE ? OR pe.email ILIKE ? OR pe.phone ILIKE ?
             OR s.name ILIKE ? OR pr.name ILIKE ? OR r.id = ?
          ORDER BY pe.name LIMIT 30`,
      )
      .all(like, like, like, like, like, like, like, term)) as unknown as {
      person_id: string;
      name: string;
      email: string | null;
      context: string;
    }[];
  }

  let focusPersonId = personIdParam ?? null;
  let focusStudentId = studentIdParam ?? null;
  if (!focusPersonId && !focusStudentId && matches.length === 1) {
    focusPersonId = matches[0].person_id;
  }
  if (focusPersonId && !focusStudentId) {
    const first = (await db
      .prepare("SELECT student_id FROM student_guardians WHERE person_id = ? AND status = 'active' ORDER BY is_primary DESC LIMIT 1")
      .get(focusPersonId)) as { student_id: string } | undefined;
    focusStudentId = first?.student_id ?? null;
  }
  // A registration id in the search box jumps straight to its child.
  if (!focusStudentId && q && /^[a-z0-9-]{6,}$/i.test(q.trim())) {
    const byRegistration = (await db.prepare("SELECT student_id FROM program_registrations WHERE id = ?").get(q.trim())) as
      | { student_id: string }
      | undefined;
    if (byRegistration) focusStudentId = byRegistration.student_id;
  }

  const student = focusStudentId
    ? ((await db
        .prepare("SELECT id, name, grade, duplicate_review_status FROM students WHERE id = ?")
        .get(focusStudentId)) as { id: string; name: string; grade: string | null; duplicate_review_status: string | null } | undefined)
    : undefined;

  const guardians = student
    ? ((await db
        .prepare(
          `SELECT pe.id AS person_id, pe.name, pe.email, pe.phone, sg.is_primary, sg.status, sg.can_register, sg.can_view_sensitive,
                  (SELECT state FROM parent_activations WHERE person_id = pe.id ORDER BY created_at DESC LIMIT 1) AS activation_state,
                  pe.user_id IS NOT NULL AS has_account
             FROM student_guardians sg JOIN people pe ON pe.id = sg.person_id
            WHERE sg.student_id = ? AND sg.status != 'revoked' ORDER BY sg.is_primary DESC`,
        )
        .all(student.id)) as unknown as Array<{
        person_id: string;
        name: string;
        email: string | null;
        phone: string | null;
        is_primary: boolean;
        status: string;
        can_register: boolean;
        can_view_sensitive: boolean;
        activation_state: string | null;
        has_account: boolean;
      }>)
    : [];

  // Siblings: every other child reachable from this family's active guardians.
  const siblings = student
    ? ((await db
        .prepare(
          `SELECT DISTINCT s.id, s.name, s.grade
             FROM students s
             JOIN student_guardians sg ON sg.student_id = s.id AND sg.status = 'active'
            WHERE sg.person_id IN (SELECT person_id FROM student_guardians WHERE student_id = ? AND status = 'active')
              AND s.id != ?
            ORDER BY s.name`,
        )
        .all(student.id, student.id)) as unknown as Array<{ id: string; name: string; grade: string | null }>)
    : [];

  const registrationIds = student
    ? ((await db.prepare("SELECT id FROM program_registrations WHERE student_id = ? ORDER BY created_at DESC").all(student.id)) as unknown as { id: string }[])
    : [];

  const registrationDetails = await Promise.all(registrationIds.map((r) => loadRegistrationDetail(r.id, "all")));
  const classByProgram = new Map<string, string | null>();
  for (const detail of registrationDetails) {
    if (!detail || classByProgram.has(detail.programId)) continue;
    const primary = await primaryClassFor(detail.programId);
    classByProgram.set(detail.programId, primary?.id ?? null);
  }

  const restoreChecks = await Promise.all(
    registrationDetails
      .filter((d) => d && ["withdrawn", "cancelled", "declined", "expired"].includes(d.status))
      .map(async (d) => [d!.id, await getRestoreCheck(d!.id)] as const),
  );
  const restoreCheckById = new Map(restoreChecks);

  // Transfer is offered only on a registration that still has a placement to
  // move. A withdrawn or expired one has nothing to transfer — that case is
  // restoration, which is the button directly above.
  const transferTargets = await Promise.all(
    registrationDetails
      .filter((d) => d && !isTerminal(d.status))
      .map(async (d) => [d!.id, await listTransferTargets(d!.id)] as const),
  );
  const transferTargetsById = new Map<string, TransferTarget[]>(
    // A registration with nowhere to go does not get a button that can only
    // fail; the dialog is offered when a real destination exists.
    transferTargets.filter(([, targets]) => targets.length > 0),
  );

  const requests = student
    ? ((await db
        .prepare(
          `SELECT id, kind, status, detail, reason, created_at FROM family_requests
            WHERE student_id = ? ORDER BY created_at DESC LIMIT 20`,
        )
        .all(student.id)) as unknown as Array<{ id: string; kind: string; status: string; detail: string | null; reason: string | null; created_at: number }>)
    : [];

  const supportNotes = student
    ? ((await db
        .prepare(
          `SELECT n.id, n.note, n.kind, n.resolved_at, n.author_label, n.created_at, p.name AS program_name
             FROM family_support_notes n LEFT JOIN programs p ON p.id = n.program_id
            WHERE n.student_id = ? OR n.person_id IN (SELECT person_id FROM student_guardians WHERE student_id = ? AND status = 'active')
            ORDER BY n.created_at DESC LIMIT 50`,
        )
        .all(student.id, student.id)) as unknown as Array<{
        id: string;
        note: string;
        kind: string;
        resolved_at: number | null;
        author_label: string;
        created_at: number;
        program_name: string | null;
      }>)
    : [];

  const completion = student
    ? ((await db
        .prepare(
          `SELECT c.outcome, c.sessions_attended, c.sessions_total, c.attendance_rate, c.certificate_serial, c.certificate_issued_at, p.name AS program_name
             FROM program_completion_records c JOIN programs p ON p.id = c.program_id
            WHERE c.student_id = ? ORDER BY c.created_at DESC`,
        )
        .all(student.id)) as unknown as Array<{
        outcome: string;
        sessions_attended: number;
        sessions_total: number;
        attendance_rate: number | null;
        certificate_serial: string | null;
        certificate_issued_at: number | null;
        program_name: string;
      }>)
    : [];

  return (
    <div>
      <PageHeader
        eyebrow="Family support centre"
        title="Find a family"
        context="Search a guardian, child, program, registration id, or phone number to resolve support issues without touching the database directly."
      />

      <PageSection noRule>
        <form style={{ display: "flex", gap: 8 }}>
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Guardian name, child name, email, phone, program, or registration id"
            style={{ flex: 1, padding: 8, border: "1px solid var(--border-rule)", borderRadius: 6 }}
          />
          <button type="submit" className="bow-button bow-button-primary bow-button-sm">
            Search
          </button>
        </form>
      </PageSection>

      {matches.length > 1 && !student && (
        <PageSection title={`${matches.length} guardians match`}>
          <div style={{ display: "grid", gap: 6 }}>
            {matches.map((m) => (
              <div key={m.person_id}>
                <Link href={`/app/family-support?q=${encodeURIComponent(q ?? "")}&personId=${m.person_id}`}>{m.name}</Link> — {m.email ?? "no email"}
                {m.context ? ` · ${m.context}` : ""}
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "var(--bow-slate)", marginTop: 8 }}>
            Refine the search to a child&apos;s name to jump straight to their record.
          </p>
        </PageSection>
      )}

      {q && matches.length === 0 && !student && <PageSection>No family matched that search.</PageSection>}

      {student && (
        <>
          <PageSection title={`${student.name} — grade ${student.grade ?? "—"}`}>
            {student.duplicate_review_status === "open" && (
              <div style={{ marginBottom: 8 }}>
                <Badge status="warning">Possible duplicate child — needs identity review</Badge>
              </div>
            )}
            {siblings.length > 0 && (
              <div style={{ marginBottom: 10, fontSize: 13 }}>
                Also in this family:{" "}
                {siblings.map((sib, i) => (
                  <span key={sib.id}>
                    {i > 0 && ", "}
                    <Link href={`/app/family-support?studentId=${sib.id}`}>
                      {sib.name} (grade {sib.grade ?? "—"})
                    </Link>
                  </span>
                ))}
              </div>
            )}
            <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
              {guardians.map((g) => (
                <div
                  key={g.person_id}
                  style={{ border: "1px solid var(--border-rule)", borderRadius: 6, padding: 10, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}
                >
                  <div>
                    <strong>{g.name}</strong> {g.is_primary ? "(primary)" : ""} — {g.email ?? "no email"} {g.phone ? `· ${g.phone}` : ""}
                    <div style={{ fontSize: 12, color: "var(--bow-slate)" }}>
                      Guardian link: {g.status} · Activation: {g.activation_state ?? "not started"} · Account: {g.has_account ? "yes" : "no"}
                      {" · "}
                      Can register: {g.can_register ? "yes" : "no"} · Can view sensitive: {g.can_view_sensitive ? "yes" : "no"}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--bow-slate)", marginTop: 2 }}>
                      {ACTIVATION_DIAGNOSIS[g.activation_state ?? ""] ?? "No activation attempted yet."}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                    {["failed", "support_required", "expired", null].includes(g.activation_state) && (
                      <ResendActivationButton personId={g.person_id} guardianName={g.name} />
                    )}
                    <ContactCorrectionDialog personId={g.person_id} guardianName={g.name} currentEmail={g.email} currentPhone={g.phone} />
                    {guardians.length > 1 && (
                      <RemoveGuardianButton studentId={student.id} personId={g.person_id} guardianName={g.name} studentName={student.name} />
                    )}
                  </div>
                </div>
              ))}
            </div>
            <AddGuardianDialog studentId={student.id} studentName={student.name} />
          </PageSection>

          <PageSection title="Registrations">
            {registrationDetails.length === 0 && <p style={{ color: "var(--bow-slate)" }}>No registrations for this child yet.</p>}
            <div style={{ display: "grid", gap: 16 }}>
              {registrationDetails.map((detail) =>
                detail ? (
                  <div key={detail.id} style={{ border: "1px solid var(--border-rule)", borderRadius: 8, padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                      <strong style={{ fontSize: 15 }}>{detail.programName}</strong>
                      <Link href={`/app/programs/${detail.programId}/enrollment?open=${detail.id}`} className="bow-button bow-button-ghost bow-button-sm">
                        Open in program
                      </Link>
                    </div>
                    <RegistrationDetailPanel detail={detail} classId={classByProgram.get(detail.programId) ?? null} />
                    {["withdrawn", "cancelled", "declined", "expired"].includes(detail.status) && restoreCheckById.get(detail.id) && (
                      <div style={{ marginTop: 10 }}>
                        <RestoreRegistrationButton
                          registrationId={detail.id}
                          studentName={detail.studentName}
                          programName={detail.programName}
                          check={restoreCheckById.get(detail.id)!}
                        />
                      </div>
                    )}
                    {transferTargetsById.has(detail.id) && (
                      <div style={{ marginTop: 10 }}>
                        <TransferProgramDialog
                          registrationId={detail.id}
                          studentName={detail.studentName}
                          currentProgramName={detail.programName}
                          currentStatusLabel={registrationLabel(detail.status)}
                          targets={transferTargetsById.get(detail.id)!}
                        />
                      </div>
                    )}
                  </div>
                ) : null,
              )}
            </div>
          </PageSection>

          {completion.length > 0 && (
            <PageSection title="Completion">
              <div style={{ display: "grid", gap: 8 }}>
                {completion.map((c, i) => (
                  <div key={i} style={{ fontSize: 13 }}>
                    <strong>{c.program_name}</strong> — {c.outcome.replace("_", " ")} · {c.sessions_attended}/{c.sessions_total} sessions
                    {c.attendance_rate != null ? ` (${c.attendance_rate}%)` : ""}
                    {c.certificate_serial ? ` · Certificate ${c.certificate_serial} issued ${fmt(c.certificate_issued_at)}` : ""}
                  </div>
                ))}
              </div>
            </PageSection>
          )}

          {requests.length > 0 && (
            <PageSection title="Family requests">
              <div style={{ display: "grid", gap: 10 }}>
                {requests.map((r) => (
                  <div key={r.id} style={{ border: "1px solid var(--border-rule)", borderRadius: 6, padding: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                      <div style={{ fontSize: 13 }}>
                        {fmt(r.created_at)} — <strong>{r.kind.replace("_", " ")}</strong> ({r.status})
                        {r.detail ? `: ${r.detail}` : ""}
                        {r.reason ? ` — ${r.reason}` : ""}
                      </div>
                      {["submitted", "under_review"].includes(r.status) && (
                        <ResolveRequestButtons requestId={r.id} kind={r.kind} studentName={student.name} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </PageSection>
          )}

          <PageSection title="Support history">
            <AddSupportNoteForm personId={guardians[0]?.person_id ?? null} studentId={student.id} />
            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              {supportNotes.length === 0 && <p style={{ color: "var(--bow-slate)" }}>No support notes yet.</p>}
              {supportNotes.map((n) => (
                <div key={n.id} style={{ fontSize: 13, borderBottom: "1px solid var(--border-rule)", paddingBottom: 8 }}>
                  <div style={{ color: "var(--bow-slate)", fontSize: 12 }}>
                    {fmt(n.created_at)} — {n.author_label} · {n.kind}
                    {n.program_name ? ` · ${n.program_name}` : ""}
                    {n.resolved_at ? ` · resolved ${fmt(n.resolved_at)}` : ""}
                  </div>
                  <div>{n.note}</div>
                </div>
              ))}
            </div>
          </PageSection>
        </>
      )}
    </div>
  );
}
