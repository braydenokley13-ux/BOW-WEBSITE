import { notFound } from "next/navigation";
import ArticleEditor from "@/components/analytics/ArticleEditor";
import { getArticleByIdAdmin, getArticleRevisions } from "@/lib/articles";
import { getAllPlayerSeasonHistories, getAnalyticsPlayers } from "@/lib/nba";
import type { AnalyticsPlayer } from "@/lib/aasv";

export const dynamic = "force-dynamic";

/**
 * The authoring surface. `id` is an article id, or the literal "new"
 * for a fresh draft. The full curated player list ships to the client
 * so the live preview can render any embed the author types without a
 * round-trip.
 */
export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === "new";
  const article = isNew ? null : getArticleByIdAdmin(id);
  if (!isNew && !article) notFound();

  const players = getAnalyticsPlayers();
  const playerMap: Record<string, AnalyticsPlayer> = {};
  for (const p of players) playerMap[p.slug] = p;

  // One query for every player's history — cheap at this data size, and it
  // lets the live preview render <TrendChart/> for ANY slug the author types,
  // not just the ones already referenced in the body.
  const playerHistories = getAllPlayerSeasonHistories();

  const revisions = article ? getArticleRevisions(article.id) : [];

  return (
    <div style={{ padding: "clamp(18px,2.6vw,32px) clamp(14px,3vw,32px)" }}>
      <ArticleEditor article={article} players={playerMap} playerHistories={playerHistories} revisions={revisions} />
    </div>
  );
}
