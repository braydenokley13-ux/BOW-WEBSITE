import { requireRole } from "@/lib/dal";
import { getSelfModuleViews, getStudentFeedResponses } from "@/lib/self-paced";
import { getFeedStories } from "@/lib/feed";
import StudentDashboard from "@/components/selfpaced/StudentDashboard";

export default async function DashboardPage() {
  const me = await requireRole("student");
  // Everything is read live from SQLite — no static data.
  const modules = getSelfModuleViews(me.id);
  const stories = getFeedStories();
  const answered = getStudentFeedResponses(me.id);

  return <StudentDashboard firstName={me.first} modules={modules} stories={stories} answered={answered} />;
}
