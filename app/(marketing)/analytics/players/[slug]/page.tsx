import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PlayerMemo from "@/components/analytics/PlayerMemo";
import ArticleCard from "@/components/analytics/ArticleCard";
import ApronBadge from "@/components/analytics/ApronBadge";
import { getAnalyticsPlayer, getAnalyticsPlayers, getPlayerSeasonHistory } from "@/lib/nba";
import { getArticlesMentioningPlayer } from "@/lib/articles";
import { buildPlayerMemo } from "@/lib/intelligence";
import { ACTION_LABELS } from "@/lib/intelligence-types";
import { fmtMillions, DEFAULT_ASSUMPTIONS } from "@/lib/aasv";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const player = getAnalyticsPlayer(slug);
  if (!player) return { title: "Player Not Found — BOW Analytics" };
  const allPlayers = getAnalyticsPlayers();
  const history = getPlayerSeasonHistory(slug);
  const memo = buildPlayerMemo(player, allPlayers, DEFAULT_ASSUMPTIONS, history);
  const title = `${player.name} — Investment Memo | BOW Sports Capital Analytics`;
  const description = `${player.name} (${player.team}): ${memo.verdict.headline}. Value thesis, upside/downside cases, risk factors, and a ${ACTION_LABELS[memo.recommendation.action].toLowerCase()} recommendation — built live from the model's apron-adjusted surplus value.`;
  return {
    title,
    description,
    openGraph: { type: "profile", title, description, url: `/analytics/players/${player.slug}` },
    twitter: { card: "summary", title, description },
  };
}

export default async function PlayerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const player = getAnalyticsPlayer(slug);
  if (!player) notFound();

  const allPlayers = getAnalyticsPlayers();
  const coverage = getArticlesMentioningPlayer(player.slug, 3);
  const history = getPlayerSeasonHistory(player.slug);

  return (
    <div data-screen-label="Player Breakdown">
      {/* breadcrumb + header */}
      <section style={{ background: "var(--bow-paper)", padding: "clamp(20px,3vw,32px) clamp(18px,4vw,40px) clamp(24px,3vw,36px)" }}>
        <div className="bow-container-wide">
          <nav aria-label="Breadcrumb" style={{ display: "flex", flexWrap: "wrap", gap: 8, fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.04em", color: "var(--bow-slate)" }}>
            <Link href="/analytics" style={{ color: "var(--bow-blue)" }}>
              Analytics
            </Link>
            <span aria-hidden>/</span>
            <span style={{ color: "var(--bow-ink)" }}>{player.name}</span>
          </nav>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginTop: 18 }}>
            <div>
              <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(34px,5.5vw,60px)", lineHeight: 0.92, textTransform: "uppercase", letterSpacing: "-0.015em", color: "var(--bow-ink)" }}>
                {player.name}
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
                  {player.team} · {player.season || "no season data"}
                </span>
                <ApronBadge status={player.apronStatus} />
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Contract</div>
              <div style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: 18, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
                {fmtMillions(player.capHit)} / yr · {player.yearsRemaining} yr{player.yearsRemaining === 1 ? "" : "s"} · {fmtMillions(player.totalRemaining)} left
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* the investment memo — verdict deck, executive summary, memo sections, and the model's audit trail */}
      <PlayerMemo player={player} allPlayers={allPlayers} history={history} />

      {/* coverage */}
      {coverage.length > 0 && (
        <section style={{ background: "#fff", padding: "clamp(32px,4.5vw,56px) clamp(18px,4vw,40px)" }}>
          <div className="bow-container-wide">
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
              Coverage
            </span>
            <h2 style={{ margin: "10px 0 24px", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(22px,2.8vw,32px)", lineHeight: 1.1 }}>
              Where the model wrote about {player.name.split(" ").slice(-1)[0]}.
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "clamp(14px,2vw,20px)" }}>
              {coverage.map((a) => (
                <ArticleCard key={a.id} article={a} />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
