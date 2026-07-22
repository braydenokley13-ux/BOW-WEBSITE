import { redirect } from "next/navigation";
import { CUTOVER_ENABLED } from "@/lib/learn/cutover";
import LegacyStudentTrack from "./LegacyStudentTrack";

/**
 * Stage 11 cutover. The legacy track view is superseded by the CareerMap
 * on the new StudentHome at /dashboard. Set BOW_LEARN_CUTOVER=off to roll
 * back instantly — see lib/learn/cutover.ts.
 */
export default function StudentTrackEntry() {
  if (CUTOVER_ENABLED) redirect("/dashboard");
  return <LegacyStudentTrack />;
}
