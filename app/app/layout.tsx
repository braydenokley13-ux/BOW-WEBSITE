import type { Metadata } from "next";
import { AppStateProvider } from "@/components/app/AppState";
import AppShell from "@/components/app/AppShell";
import { requireUser, loadAppData } from "@/lib/dal";
import { scopeAppDataForUser } from "@/lib/account";

export const metadata: Metadata = {
  title: "Front Office",
  description: "Your BOW Sports Capital front office — cohorts, lessons, and progress.",
  // The authenticated app is private; keep it out of search indexes.
  robots: { index: false, follow: false },
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Authoritative auth check (the proxy only does an optimistic cookie check).
  const me = await requireUser();
  const data = await loadAppData();
  // Never ship other users' PII, other cohorts' rosters, or admin-only data
  // to a student/instructor browser — see scopeAppDataForUser for why this
  // can't just be a route-level guard.
  const scoped = scopeAppDataForUser(data, me);

  return (
    <AppStateProvider me={me} data={scoped}>
      <AppShell>{children}</AppShell>
    </AppStateProvider>
  );
}
