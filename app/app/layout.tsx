import type { Metadata } from "next";
import { AppStateProvider } from "@/components/app/AppState";
import AppShell from "@/components/app/AppShell";
import { requireUser, loadAppData } from "@/lib/dal";
import { scopeAppDataForUser, EMPTY_APP_DATA } from "@/lib/account";

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
  const scoped = me.role === "growth" ? EMPTY_APP_DATA : scopeAppDataForUser(await loadAppData(), me);

  return (
    <AppStateProvider me={me} data={scoped}>
      <AppShell>{children}</AppShell>
    </AppStateProvider>
  );
}
