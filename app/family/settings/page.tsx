import type { Metadata } from "next";
import { requireRole } from "@/lib/dal";
import { guardianPersonForUser, studentIdsForGuardian } from "@/lib/parent-activation";
import { loadFamilyDashboard, guardiansForStudent } from "@/lib/family-portal";
import ChildSelfService from "@/components/family/ChildSelfService";

export const metadata: Metadata = { title: "Account" };

/**
 * Self-service is organized per child rather than as one giant form, because
 * every action (withdraw, transfer, add a guardian, revoke access) is scoped
 * to a single student and must stay that way through the UI, not just the
 * server check.
 */
export default async function FamilySettingsPage() {
  const me = await requireRole("parent");
  const personId = await guardianPersonForUser(me.id);
  if (!personId) {
    return <p>Your account isn&apos;t linked to a family record yet. Contact support.</p>;
  }

  const studentIds = await studentIdsForGuardian(personId);
  const dashboard = await loadFamilyDashboard(personId);
  const seenStudents = new Map<string, string>();
  for (const child of dashboard.children) seenStudents.set(child.studentId, child.studentName);
  for (const p of dashboard.completedPrograms) seenStudents.set(p.studentId, p.studentName);

  const students = await Promise.all(
    studentIds.map(async (id) => ({
      id,
      name: seenStudents.get(id) ?? "Student",
      registrations: dashboard.children.filter((c) => c.studentId === id),
      guardians: await guardiansForStudent(id, personId),
    })),
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 24, margin: "0 0 6px" }}>Account &amp; family settings</h1>
        <p style={{ fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-slate, #55585f)", margin: 0 }}>
          Signed in as {me.email}. Anything that affects a seat, safety, or staffing goes to BOW staff as a request rather
          than changing immediately.
        </p>
      </div>
      {students.map((student) => (
        <ChildSelfService key={student.id} studentId={student.id} studentName={student.name} registrations={student.registrations} guardians={student.guardians} />
      ))}
    </div>
  );
}
