import NotebookTray from "@/components/research/NotebookTray";

/** Rides every analytics route: the notebook tray is a constant presence
 *  wherever a reader might clip a verdict, scenario, or trade breakdown. */
export default function AnalyticsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {children}
      <NotebookTray />
    </>
  );
}
