import { notFound, redirect } from "next/navigation";
import { resolveInstructorPersonId } from "@/lib/people-directory";

/**
 * Instructor detail now lives on the canonical person record (Stage 3) —
 * see docs/redesign/route-disposition.md. Resolves instructors.id ->
 * people.id and redirects to the re-housed Instructor section there. If a
 * legacy instructor row somehow has no person_id (data gap, not expected in
 * practice since instructors.person_id is NOT NULL with a FK), fail safely
 * with notFound() instead of a 500.
 */
export default async function InstructorDetailRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const personId = await resolveInstructorPersonId(id);
  if (!personId) notFound();
  redirect(`/app/people/${personId}?tab=instructor`);
}
