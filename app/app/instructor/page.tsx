import { redirect } from "next/navigation";

/**
 * Stage 2: /app/teach is the single stage-aware instructor home.
 * /app/instructor permanently redirects there. The legacy client
 * implementation this file used to contain (cohort/AppState-based
 * "Today" view) is retired; /app/instructor/{cohort,session,learn}
 * remain untouched per the Stage 2 brief.
 */
export default function InstructorHomeEntry() {
  redirect("/app/teach");
}
