import AdminArticleList from "@/components/analytics/AdminArticleList";
import { getAllArticlesAdmin, rehydrateArticlesFromMirror } from "@/lib/articles";
import { getStatsFreshness } from "@/lib/nba";

export const dynamic = "force-dynamic";

export default async function AnalyticsAdminPage() {
  // Reader submissions must survive a cold start — pull the mirror
  // back before the desk reads its queue.
  await rehydrateArticlesFromMirror();
  const articles = getAllArticlesAdmin();
  const freshness = getStatsFreshness();
  return (
    <div style={{ padding: "clamp(24px,3.4vw,44px) clamp(18px,4vw,40px)" }}>
      <div className="bow-container-wide">
        <AdminArticleList articles={articles} freshness={freshness} />
      </div>
    </div>
  );
}
