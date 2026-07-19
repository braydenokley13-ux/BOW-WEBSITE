import type { Metadata } from "next";
import Link from "next/link";
import TradeMachine from "@/components/analytics/TradeMachine";
import { getAnalyticsPlayers, getDataProvenance } from "@/lib/nba";

const TITLE = "Trade Machine — BOW Sports Capital Analytics";
const DESCRIPTION =
  "The apron era's defining trick, made interactive: the same contract has a different true cost on a different team, so a swap can create surplus out of nothing but the cap. Swap any two tracked contracts and watch the value move.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { type: "website", title: TITLE, description: DESCRIPTION, url: "/analytics/trade" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

// Values come from the live cache; render per-request so a data refresh shows without a rebuild.
export const dynamic = "force-dynamic";

export default async function TradePage() {
  const players = (await getAnalyticsPlayers());
  const provenance = (await getDataProvenance());

  return (
    <div data-screen-label="Trade Machine">
      {/* HERO — front-office mode */}
      <section className="bow-front-office" style={{ background: "var(--bow-ink)", color: "#fff", padding: "clamp(44px,6vw,80px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--bow-dark-border)" }}>
        <div className="bow-container-wide">
          <nav aria-label="Breadcrumb" style={{ display: "flex", flexWrap: "wrap", gap: 8, fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.04em", color: "#9a9da6", marginBottom: 20 }}>
            <Link href="/analytics" style={{ color: "#6f8bff" }}>
              Analytics
            </Link>
            <span aria-hidden>/</span>
            <span>Trade Machine</span>
          </nav>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
            BOW Analytics · Value in Transit
          </span>
          <h1 style={{ margin: "14px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(32px,5vw,56px)", lineHeight: 1.05, letterSpacing: "-0.018em", maxWidth: "20ch", color: "#fff", textWrap: "pretty" }}>
            Who won the trade? Sometimes both teams did.
          </h1>
          <p style={{ margin: "18px 0 0", fontFamily: "var(--font-interface)", fontSize: "clamp(15px,1.5vw,18px)", lineHeight: 1.6, color: "#c8cad0", maxWidth: 660 }}>
            Under the CBA, the apron multiplier belongs to the <em>team</em>, not the player — so the same contract
            costs more on a taxed roster than on a clean one. Production, meanwhile, travels with the player unchanged.
            Move the pricier deal to the cheaper books and you create surplus before either roster plays a game. That
            asymmetry is going to drive the next five years of star movement. Here it is — priced under your
            assumptions, on the contracts we track.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginTop: 22 }}>
            <Link href="/analytics" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", color: "#6f8bff" }}>
              ← Back to the desk
            </Link>
            <Link href="/analytics/articles/the-second-apron-is-a-tax-on-stars" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", color: "#6f8bff" }}>
              Read the apron piece →
            </Link>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.05em", color: "#6d7078" }}>
              value created = (cap gap) × (apron-multiplier gap)
            </span>
          </div>
          <p style={{ margin: "16px 0 0", fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.04em", color: "#6d7078" }}>
            {provenance.playerCount} tracked contracts{provenance.asOf ? ` · curated as of ${provenance.asOf}` : ""} · salary matching and apron
            aggregation only, not the full CBA ·{" "}
            <Link href="/analytics/methods" style={{ color: "#6f8bff" }}>
              methods →
            </Link>
          </p>
        </div>
      </section>

      {/* THE MACHINE */}
      <section style={{ background: "var(--bow-paper)", padding: "clamp(28px,4vw,48px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container-wide">
          <TradeMachine players={players} />
          <p style={{ margin: "18px 0 0", fontFamily: "var(--font-interface)", fontSize: 13.5, lineHeight: 1.6, color: "var(--bow-slate)", maxWidth: "72ch" }}>
            The multipliers you set on the{" "}
            <Link href="/analytics" style={{ color: "var(--bow-blue)" }}>
              dashboard sliders
            </Link>{" "}
            drive this — think the first apron is a speed bump, not a wall? Drop it toward 1.2× and watch how much less
            value a below-apron destination creates. The model is only ever as confident as your assumptions.
          </p>
        </div>
      </section>
    </div>
  );
}
