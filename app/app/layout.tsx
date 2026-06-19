import { AppStateProvider } from "@/components/app/AppState";
import AppShell from "@/components/app/AppShell";
import { requireUser, loadAppData } from "@/lib/dal";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Authoritative auth check (the proxy only does an optimistic cookie check).
  const me = await requireUser();
  const data = await loadAppData();

  return (
    <AppStateProvider me={me} data={data}>
      <AppShell>{children}</AppShell>
    </AppStateProvider>
  );
}
