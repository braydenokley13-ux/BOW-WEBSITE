import Link from "next/link";
import { requireAdmin } from "@/lib/dal";
import { getCurriculumTree } from "@/app/actions/learn-author";
import CurriculumManagerClient from "./CurriculumManagerClient";

export const metadata = {
  title: "Playbook Studio",
  description: "Build, publish, and manage Playbook Engine lessons visually — no code.",
  robots: { index: false, follow: false },
};

export default async function LearnAdminPage() {
  await requireAdmin();
  const tree = await getCurriculumTree();

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 20px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Playbook Studio</h1>
          <p style={{ marginBottom: 24, color: "var(--bow-muted-text, #767a85)" }}>
            Tracks, modules, and lessons for the Playbook Engine. Open a lesson to build it visually.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link
          href="/app/admin/learn/achievements"
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--bow-ink)",
            background: "transparent",
            border: "1px solid var(--bow-border, #d7d7db)",
            borderRadius: 999,
            padding: "10px 18px",
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          Achievements →
        </Link>
        <Link
          href="/app/admin/learn/map"
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--bow-white)",
            background: "var(--bow-orange-solid)",
            border: "1px solid var(--bow-orange-solid)",
            borderRadius: 999,
            padding: "10px 18px",
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          Career Map Editor →
        </Link>
        </div>
      </div>
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
