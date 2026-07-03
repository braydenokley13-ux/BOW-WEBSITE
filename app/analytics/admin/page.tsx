import AdminArticleList from "@/components/analytics/AdminArticleList";
import { getAllArticlesAdmin } from "@/lib/articles";
import { getStatsFreshness } from "@/lib/nba";

export const dynamic = "force-dynamic";

export default function AnalyticsAdminPage() {
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
