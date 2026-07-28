import Link from "next/link";
import { getDb } from "@/lib/db";
import { requireStaff } from "@/lib/dal";
import { PageHeader, PageSection, DataTable, Badge } from "@/components/ds";
import { registrationLabel } from "@/lib/enrollment-shared";
import ResendActivationButton from "@/components/admin/enrollment/ResendActivationButton";
import ExtendReservationButton from "@/components/admin/enrollment/ExtendReservationButton";

function fmt(ms: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function FamilySupportPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; studentId?: string }>;
}) {
  await requireStaff();
  const { q, studentId } = await searchParams;
  const db = getDb();

  let matches: { person_id: string; name: string; email: string | null }[] = [];
  if (q && q.trim()) {
    const like = `%${q.trim()}%`;
    matches = (await db
      .prepare(
        `SELECT DISTINCT pe.id AS person_id, pe.name, pe.email
           FROM people pe
           LEFT JOIN student_guardians sg ON sg.person_id = pe.id
           LEFT JOIN students s ON s.id = sg.student_id
          WHERE pe.name ILIKE ? OR pe.email ILIKE ? OR s.name ILIKE ?
          ORDER BY pe.name LIMIT 30`,
      )
      .all(like, like, like)) as unknown as { person_id: string; name: string; email: string | null }[];
  }

  let focusStudentId = studentId ?? null;
  if (!focusStudentId && matches.length === 1) {
    const first = (await db
      .prepare("SELECT student_id FROM student_guardians WHERE person_id = ? ORDER BY is_primary DESC LIMIT 1")
      .get(matches[0].person_id)) as { student_id: string } | undefined;
    focusStudentId = first?.student_id ?? null;
  }

  const student = focusStudentId
    ? ((await db
        .prepare("SELECT id, name, grade, duplicate_review_status FROM students WHERE id = ?")
        .get(focusStudentId)) as { id: string; name: string; grade: string | null; duplicate_review_status: string | null } | undefined)
    : undefined;

  const guardians = student
    ? ((await db
        .prepare(
          `SELECT pe.id AS person_id, pe.name, pe.email, pe.phone, sg.is_primary, sg.status,
                  (SELECT state FROM parent_activations WHERE person_id = pe.id ORDER BY created_at DESC LIMIT 1) AS activation_state
             FROM student_guardians sg JOIN people pe ON pe.id = sg.person_id
            WHERE sg.student_id = ? ORDER BY sg.is_primary DESC`,
        )
        .all(student.id)) as unknown as Array<{
        person_id: string;
        name: string;
        email: string | null;
        phone: string | null;
        is_primary: boolean;
        status: string;
        activation_state: string | null;
      }>)
    : [];

  const registrations = student
    ? ((await db
        .prepare(
          `SELECT r.id, p.id AS program_id, p.name AS program_name, r.status, r.reservation_expires_at, r.class_id, c.title AS class_title,
                  (SELECT COUNT(*) FROM registration_requirements rr JOIN program_requirements pr ON pr.id = rr.requirement_id
                    WHERE rr.registration_id = r.id AND pr.active = true AND rr.status NOT IN ('approved','waived')) AS requirements_outstanding
             FROM program_registrations r JOIN programs p ON p.id = r.program_id
             LEFT JOIN classes c ON c.id = r.class_id
            WHERE r.student_id = ? ORDER BY r.created_at DESC`,
        )
        .all(student.id)) as unknown as Array<{
        id: string;
        program_id: string;
        program_name: string;
        status: string;
        reservation_expires_at: number | null;
        class_id: string | null;
        class_title: string | null;
        requirements_outstanding: number | string;
      }>)
    : [];

  const requests = student
    ? ((await db
        .prepare(
          `SELECT id, kind, status, detail, reason, created_at FROM family_requests
            WHERE student_id = ? ORDER BY created_at DESC LIMIT 20`,
        )
        .all(student.id)) as unknown as Array<{ id: string; kind: string; status: string; detail: string | null; reason: string | null; created_at: number }>)
    : [];

  return (
    <div>
      <PageHeader
        eyebrow="Family support centre"
        title="Find a family"
        context="Search a guardian, child, or email to resolve common issues without touching the database directly."
      />

      <PageSection noRule>
        <form style={{ display: "flex", gap: 8 }}>
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Guardian name, child name, or email"
            style={{ flex: 1, padding: 8, border: "1px solid var(--border-rule)", borderRadius: 6 }}
          />
          <button type="submit" className="bow-button bow-button--primary bow-button--sm">
            Search
          </button>
        </form>
      </PageSection>

      {matches.length > 1 && !student && (
        <PageSection title={`${matches.length} guardians match`}>
          <div style={{ display: "grid", gap: 6 }}>
            {matches.map((m) => (
              <div key={m.person_id}>
                <Link href={`/app/family-support?q=${encodeURIComponent(q ?? "")}&studentId=${m.person_id}`}>{m.name}</Link> — {m.email ?? "no email"}
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "var(--bow-slate)", marginTop: 8 }}>
            Refine the search to a child&apos;s name to jump straight to their record.
          </p>
        </PageSection>
      )}

      {q && matches.length === 0 && <PageSection>No family matched that search.</PageSection>}

      {student && (
        <>
          <PageSection title={`${student.name} — grade ${student.grade ?? "—"}`}>
            {student.duplicate_review_status === "open" && (
              <div style={{ marginBottom: 8 }}>
                <Badge status="warning">Possible duplicate child — needs identity review</Badge>
              </div>
            )}
            <div style={{ display: "grid", gap: 8 }}>
              {guardians.map((g) => (
                <div key={g.person_id} style={{ border: "1px solid var(--border-rule)", borderRadius: 6, padding: 10, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <strong>{g.name}</strong> {g.is_primary ? "(primary)" : ""} — {g.email ?? "no email"} {g.phone ? `· ${g.phone}` : ""}
                    <div style={{ fontSize: 12, color: "var(--bow-slate)" }}>
                      Guardian link: {g.status} · Activation: {g.activation_state ?? "not started"}
                    </div>
                  </div>
                  {["failed", "support_required", "expired", null].includes(g.activation_state) && (
                    <ResendActivationButton personId={g.person_id} guardianName={g.name} />
                  )}
                </div>
              ))}
            </div>
          </PageSection>

          <PageSection title="Registrations">
            <DataTable columns={["Program", "Status", "Class", "Reservation", "Requirements", ""]} minWidth={760} isEmpty={registrations.length === 0}>
              {registrations.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--border-rule)" }}>
                  <td style={{ padding: "10px 12px" }}>{r.program_name}</td>
                  <td style={{ padding: "10px 12px" }}>{registrationLabel(r.status)}</td>
                  <td style={{ padding: "10px 12px" }}>{r.class_title ?? "Not placed"}</td>
                  <td style={{ padding: "10px 12px" }}>
                    {fmt(r.reservation_expires_at)}
                    {["seat_reserved", "requirements_pending"].includes(r.status) && (
                      <div style={{ marginTop: 4 }}>
                        <ExtendReservationButton registrationId={r.id} />
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "10px 12px" }}>{Number(r.requirements_outstanding) > 0 ? `${r.requirements_outstanding} pending` : "Complete"}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>
                    <Link href={`/app/programs/${r.program_id}/enrollment?open=${r.id}`} className="bow-button bow-button--ghost bow-button--sm">
                      Open in program
                    </Link>
                  </td>
                </tr>
              ))}
            </DataTable>
          </PageSection>

          {requests.length > 0 && (
            <PageSection title="Family requests">
              <div style={{ display: "grid", gap: 6 }}>
                {requests.map((r) => (
                  <div key={r.id} style={{ fontSize: 13 }}>
                    {fmt(r.created_at)} — {r.kind.replace("_", " ")} ({r.status}){r.detail ? `: ${r.detail}` : ""}
                  </div>
                ))}
              </div>
            </PageSection>
          )}
        </>
      )}
    </div>
  );
}
