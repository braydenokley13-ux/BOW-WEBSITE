import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import TeamCapSheet from "@/components/analytics/TeamCapSheet";
import { getAnalyticsPlayers } from "@/lib/nba";
import { teamFromSlug, teamName } from "@/lib/nba-teams";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ team: string }> }): Promise<Metadata> {
  const { team: slug } = await params;
  const team = teamFromSlug(slug);
  const name = teamName(team);
  const title = `${name} — Cap Sheet | BOW Sports Capital Analytics`;
  const description = `Apron-Adjusted Surplus Value for every tracked ${name} contract: production value vs. true, apron-adjusted cost.`;
  return {
    title,
    description,
    openGraph: { type: "website", title, description, url: `/analytics/teams/${slug}` },
    twitter: { card: "summary", title, description },
  };
}

export default async function TeamPage({ params }: { params: Promise<{ team: string }> }) {
  const { team: slug } = await params;
  const team = teamFromSlug(slug);

  // Filter the full curated list in-memory rather than adding a
  // team-scoped query to lib/nba — the whole player set is already
  // cheap to load and this keeps team math entirely in lib/team-aasv.
  const allPlayers = getAnalyticsPlayers();
  const players = allPlayers.filter((p) => p.team === team);
  if (players.length === 0) notFound();

  return (
    <div data-screen-label="Team Cap Sheet">
      {/* breadcrumb + header, same pattern as the player page */}
      <section style={{ background: "var(--bow-paper)", padding: "clamp(20px,3vw,32px) clamp(18px,4vw,40px) clamp(24px,3vw,36px)", borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container-wide">
          <nav aria-label="Breadcrumb" style={{ display: "flex", flexWrap: "wrap", gap: 8, fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.04em", color: "var(--bow-slate)" }}>
            <Link href="/analytics" style={{ color: "var(--bow-blue)" }}>
              Analytics
            </Link>
            <span aria-hidden>/</span>
            <Link href="/analytics/teams" style={{ color: "var(--bow-blue)" }}>
              Teams
            </Link>
            <span aria-hidden>/</span>
            <span style={{ color: "var(--bow-ink)" }}>{teamName(team)}</span>
          </nav>
          <h1 style={{ margin: "18px 0 0", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(34px,5.5vw,60px)", lineHeight: 0.92, textTransform: "uppercase", letterSpacing: "-0.015em", color: "var(--bow-ink)" }}>
            {teamName(team)}
          </h1>
        </div>
      </section>

      {/* the cap sheet */}
      <section style={{ background: "var(--bow-paper)", padding: "clamp(24px,3.4vw,44px) clamp(18px,4vw,40px)" }}>
        <div className="bow-container-wide">
          <TeamCapSheet team={team} players={allPlayers} />
        </div>
      </section>
    </div>
  );
}
