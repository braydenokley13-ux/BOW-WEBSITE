import { redirect } from "next/navigation";
import { getLearnCutoverEnabled } from "@/lib/learn/cutover";
import LegacyStudentHome from "./LegacyStudentHome";

/**
 * Stage 11 cutover. When the runtime learn_cutover flag is enabled, the
 * legacy cohort-portal home is superseded by the new StudentHome at
 * /dashboard. Admins can roll back immediately from Playbook Studio; see
 * lib/learn/cutover.ts.
 */
export default async function StudentHomeEntry() {
  if (await getLearnCutoverEnabled()) redirect("/dashboard");
  return <LegacyStudentHome />;
}
