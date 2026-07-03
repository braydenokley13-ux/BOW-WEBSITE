import type { Metadata } from "next";
import TeamsDashboard from "@/components/analytics/TeamsDashboard";
import { getAnalyticsPlayers } from "@/lib/nba";

const TITLE = "Team Cap Intelligence — BOW Sports Capital Analytics";
const DESCRIPTION =
  "Apron-Adjusted Surplus Value rolled up by team: which front offices are sitting on tracked surplus, and which are carrying tracked overpays. Every model assumption is a slider.";

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
    <div data-screen-label="Team Cap Intelligence">
      {/* HERO — front-office mode, matches /analytics */}
      <section className="bow-front-office" style={{ background: "var(--bow-ink)", color: "#fff", padding: "clamp(44px,6vw,88px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--bow-dark-border)" }}>
        <div className="bow-container-wide">
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
            BOW Analytics · Team Cap Intelligence
          </span>
          <h1 style={{ margin: "14px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(32px,5vw,58px)", lineHeight: 1.04, letterSpacing: "-0.018em", maxWidth: "18ch", color: "#fff", textWrap: "pretty" }}>
            Which front offices are actually beating their cap sheet.
          </h1>
          <p style={{ margin: "18px 0 0", fontFamily: "var(--font-interface)", fontSize: "clamp(15px,1.5vw,18px)", lineHeight: 1.6, color: "#c8cad0", maxWidth: 640 }}>
            Every team&rsquo;s tracked contracts rolled into one number: total production value minus total true,
            apron-adjusted cost. Same AASV model as the player pages, same sliders — just summed by roster.
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
