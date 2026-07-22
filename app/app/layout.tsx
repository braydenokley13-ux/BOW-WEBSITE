import type { Metadata } from "next";
import { AppStateProvider } from "@/components/app/AppState";
import AppShell from "@/components/app/AppShell";
import { requireUser, loadAppData } from "@/lib/dal";
import { scopeAppDataForUser, EMPTY_APP_DATA } from "@/lib/account";
import { getInstructorByUserId } from "@/lib/hiring";
import { CUTOVER_ENABLED } from "@/lib/learn/cutover";

export const metadata: Metadata = {
  title: "Front Office",
  description: "Your BOW Sports Capital front office — cohorts, lessons, and progress.",
  // The authenticated app is private; keep it out of search indexes.
  robots: { index: false, follow: false },
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Authoritative auth check (the proxy only does an optimistic cookie check).
  const me = await requireUser();
  // growth-role users work entirely in the new BOW HQ data layer — never
  // load or ship the LMS snapshot to them.
  const instructor = me.role === "instructor" ? (await getInstructorByUserId(me.id)) : null;
  const instructorCanReceiveDeliveryData = !instructor
    || (instructor.stage === "active" && instructor.eligibilityStatus === "eligible");
  const scoped = me.role === "growth" || (me.role === "instructor" && !instructorCanReceiveDeliveryData)
    ? EMPTY_APP_DATA
    : scopeAppDataForUser(await loadAppData(), me);

  return (
    <AppStateProvider me={me} data={scoped}>
      <AppShell instructorCanDeliver={instructorCanReceiveDeliveryData} cutoverEnabled={CUTOVER_ENABLED}>{children}</AppShell>
    </AppStateProvider>
  );
}
