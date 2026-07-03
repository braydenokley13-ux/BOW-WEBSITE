import type { Metadata } from "next";
import TeamsDashboard from "@/components/analytics/TeamsDashboard";
import { getAnalyticsPlayers } from "@/lib/nba";

const TITLE = "Franchise Strategy Index — BOW Sports Capital Analytics";
const DESCRIPTION =
  "BOW's Franchise Strategy Index, ranked: roster quality, cap flexibility, asset base, and four other dimensions, scored off our ~40 curated tracked contracts per team — not a full-roster audit. Every model assumption is a slider.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { type: "website", title: TITLE, description: DESCRIPTION, url: "/analytics/teams" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

// Same reasoning as /analytics: the SQLite cache can refresh between
// deploys, so render per-request rather than at build time.
export const dynamic = "force-dynamic";

export default function TeamsPage() {
  const players = getAnalyticsPlayers();

  return (
    <div data-screen-label="Franchise Strategy Index">
      {/* HERO — front-office mode, matches /analytics */}
      <section className="bow-front-office" style={{ background: "var(--bow-ink)", color: "#fff", padding: "clamp(44px,6vw,88px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--bow-dark-border)" }}>
        <div className="bow-container-wide">
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
            BOW Analytics · Franchise Strategy Index
          </span>
          <h1 style={{ margin: "14px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(32px,5vw,58px)", lineHeight: 1.04, letterSpacing: "-0.018em", maxWidth: "18ch", color: "#fff", textWrap: "pretty" }}>
            Which front offices are actually built to win.
          </h1>
          <p style={{ margin: "18px 0 0", fontFamily: "var(--font-interface)", fontSize: "clamp(15px,1.5vw,18px)", lineHeight: 1.6, color: "#c8cad0", maxWidth: 640 }}>
            This is BOW&rsquo;s curated slice of the league — roughly 40 tracked star contracts, not full 15-man
            rosters — rolled up by team and graded across roster quality, cap flexibility, asset base, and four
            other dimensions into one Franchise Strategy Index. Same AASV model as the player pages, same sliders:
            move an assumption and the ranking below moves with it.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginTop: 22 }}>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.05em", color: "#6d7078" }}>
              Team AASV = Σ(player wins × $/win) − Σ(player cap hit × apron multiplier)
            </span>
          </div>
        </div>
      </section>

      {/* DASHBOARD */}
      <section style={{ background: "var(--bow-paper)", padding: "clamp(28px,4vw,48px) clamp(18px,4vw,40px)" }}>
        <div className="bow-container-wide">
          <TeamsDashboard players={players} />
        </div>
      </section>
    </div>
  );
}
