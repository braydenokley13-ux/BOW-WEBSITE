import { redirect } from "next/navigation";

/**
 * Instructors is now a filtered facet of the unified People hub (Stage 3) —
 * see docs/redesign/route-disposition.md ("MERGE" -> `/app/people?type=instructor`).
 */
export default function InstructorsIndexRedirect() {
  redirect("/app/people?type=instructor");
}
