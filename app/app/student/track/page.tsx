import { redirect } from "next/navigation";
import { getLearnCutoverEnabled } from "@/lib/learn/cutover";
import LegacyStudentTrack from "./LegacyStudentTrack";

/**
 * Stage 11 cutover. When the runtime learn_cutover flag is enabled, the
 * legacy track view is superseded by the CareerMap on /dashboard. Admins
 * can roll back immediately from Playbook Studio; see lib/learn/cutover.ts.
 */
export default async function StudentTrackEntry() {
  if (await getLearnCutoverEnabled()) redirect("/dashboard");
  return <LegacyStudentTrack />;
}
