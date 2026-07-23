import { redirect } from "next/navigation";

/**
 * Students is now a filtered facet of the unified People hub (Stage 3) —
 * see docs/redesign/route-disposition.md ("MERGE" -> `/app/people?type=student`).
 */
export default function StudentsIndexRedirect() {
  redirect("/app/people?type=student");
}
