import Link from "next/link";
import { requireAdmin } from "@/lib/dal";
import { listAchievementBadges } from "@/app/actions/learn-achievements";
import AchievementEditor from "@/components/learn/builder/AchievementEditor";

export const metadata = {
  title: "Achievements · Playbook Studio · BOW HQ",
  description: "Create and manage badges awarded by the Playbook Engine's declarative rule system.",
  robots: { index: false, follow: false },
};

export default async function AchievementsAdminPage() {
  await requireAdmin();
  const badges = await listAchievementBadges();

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 20px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <Link
            href="/app/admin/learn"
            style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-muted-text, #767a85)", textDecoration: "none" }}
          >
            ← Playbook Studio
          </Link>
          <h1 style={{ margin: "6px 0 4px" }}>Achievements</h1>
          <p style={{ marginBottom: 24, color: "var(--bow-muted-text, #767a85)" }}>
            Badges awarded automatically when a rule is satisfied — evaluated inside every lesson completion. System
            badges (streak/accuracy/volume/etc) are copy-editable but their rules stay fixed; create custom badges
            below with rules built from dropdowns, no JSON.
          </p>
        </div>
      </div>
      {badges.ok ? (
        <AchievementEditor initialBadges={badges.badges} />
      ) : (
        <p role="alert" style={{ color: "var(--bow-negative, #b3261e)" }}>
          {badges.error}
        </p>
      )}
    </div>
  );
}
