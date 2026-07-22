import { redirect } from "next/navigation";
import { CUTOVER_ENABLED } from "@/lib/learn/cutover";
import LegacyStudentHome from "./LegacyStudentHome";

/**
 * Stage 11 cutover. When CUTOVER_ENABLED, the legacy cohort-portal home
 * is superseded by the new StudentHome at /dashboard (components/learn/home/StudentHome).
 * Set BOW_LEARN_CUTOVER=off to roll back instantly — see lib/learn/cutover.ts.
 */
export default function StudentHomeEntry() {
  if (CUTOVER_ENABLED) redirect("/dashboard");
  return <LegacyStudentHome />;
}
