import { requireAdmin } from "@/lib/dal";
import { getCurriculumTree } from "@/app/actions/learn-author";
import CurriculumManagerClient from "./CurriculumManagerClient";

export const metadata = {
  title: "Playbook Studio · BOW HQ",
  description: "Build, publish, and manage Playbook Engine lessons visually — no code.",
  robots: { index: false, follow: false },
};

export default async function LearnAdminPage() {
  await requireAdmin();
  const tree = await getCurriculumTree();

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 20px" }}>
      <h1 style={{ marginBottom: 4 }}>Playbook Studio</h1>
      <p style={{ marginBottom: 24, color: "var(--bow-muted-text, #767a85)" }}>
        Tracks, modules, and lessons for the Playbook Engine. Open a lesson to build it visually.
      </p>
      {tree.ok ? (
        <CurriculumManagerClient tree={tree} />
      ) : (
        <p role="alert" style={{ color: "var(--bow-negative, #b3261e)" }}>
          {tree.error}
        </p>
      )}
    </div>
  );
}
