import { requireRole } from "@/lib/dal";
import {
  getSelfModuleViews,
  getQuizModuleSections,
  getActiveScenario,
  getScenarioArchive,
} from "@/lib/self-paced";
import StudentDashboard from "@/components/selfpaced/StudentDashboard";

export default async function DashboardPage() {
  const me = await requireRole("student");
  // Everything is read live from SQLite — no static data.
  const modules = getSelfModuleViews(me.id);
  const quizSections = getQuizModuleSections(me.id);
  const activeScenario = getActiveScenario(me.id);
  const scenarioArchive = getScenarioArchive(me.id);

  return (
    <StudentDashboard
      firstName={me.first}
      modules={modules}
      quizSections={quizSections}
      activeScenario={activeScenario}
      scenarioArchive={scenarioArchive}
    />
  );
}
