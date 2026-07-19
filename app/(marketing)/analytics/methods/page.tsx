import type { Metadata } from "next";
import Link from "next/link";
import { DEFAULT_ASSUMPTIONS, fmtMillions } from "@/lib/aasv";
import { getDataProvenance } from "@/lib/nba";

const TITLE = "Methods & Data — BOW Sports Capital Analytics";
const DESCRIPTION =
  "How AASV works, where every default number comes from, what the impact metric actually is, and the honest limits of the dataset. No black boxes.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { type: "website", title: TITLE, description: DESCRIPTION, url: "/analytics/methods" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export const dynamic = "force-dynamic";

const h2: React.CSSProperties = {
  margin: "0 0 12px",
  fontFamily: "var(--font-editorial)",
  fontWeight: 600,
  fontSize: "clamp(21px,2.6vw,27px)",
  lineHeight: 1.2,
  color: "var(--bow-ink)",
};

const body: React.CSSProperties = {
  margin: "0 0 14px",
  fontFamily: "var(--font-interface)",
  fontSize: 15,
  lineHeight: 1.65,
  color: "var(--bow-ink)",
  maxWidth: 720,
};

const mono: React.CSSProperties = {
  fontFamily: "var(--font-data)",
  fontSize: 13,
  background: "var(--bow-paper)",
  border: "1px solid var(--border-rule)",
  padding: "12px 14px",
  display: "block",
  margin: "0 0 14px",
  maxWidth: 720,
  lineHeight: 1.7,
  overflowX: "auto",
};

function Section({ children }: { children: React.ReactNode }) {
  return (
    <section style={{ padding: "clamp(24px,3.4vw,40px) 0", borderBottom: "1px solid var(--border-rule)" }}>
      {children}
    </section>
  );
}

export default async function MethodsPage() {
  const a = DEFAULT_ASSUMPTIONS;
  const p = (await getDataProvenance());

  return (
    <div data-screen-label="Methods & Data">
      {/* HERO */}
      <section
        className="bow-front-office"
        style={{ background: "var(--bow-ink)", color: "#fff", padding: "clamp(44px,6vw,80px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--bow-dark-border)" }}
      >
        <div className="bow-container-wide">
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
            BOW Analytics · Methods &amp; Data
          </span>
          <h1 style={{ margin: "14px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(30px,4.6vw,52px)", lineHeight: 1.05, letterSpacing: "-0.015em", color: "#fff", maxWidth: "22ch", textWrap: "pretty" }}>
            Every number on this site can be traced back to this page.
          </h1>
          <p style={{ margin: "16px 0 0", fontFamily: "var(--font-interface)", fontSize: "clamp(14.5px,1.4vw,17px)", lineHeight: 1.6, color: "#c8cad0", maxWidth: 660 }}>
            A model you can&rsquo;t interrogate is a take with a spreadsheet. This page states the arithmetic, names the
            data sources, admits which defaults are judgment calls, and lists what the model leaves out — so you can
            decide how much to trust it, and where to disagree.
          </p>
        </div>
      </section>

      <div style={{ background: "#fff", padding: "0 clamp(18px,4vw,40px)" }}>
        <div className="bow-container-wide">
          <Section>
            <h2 style={h2}>The model, in full</h2>
            <p style={body}>
              <strong>Apron-Adjusted Surplus Value (AASV)</strong> prices a player twice. First, what he produces:
              his estimated impact above a replacement-level player, scaled by his minutes into net points, converted
              into wins, and priced at the market rate for a win. Second, what he truly costs: his cap hit, multiplied
              up if his team sits in the CBA&rsquo;s luxury-tax aprons, where every payroll dollar carries penalties.
              AASV is the gap.
            </p>
            <span style={mono}>
              production&nbsp;&nbsp;= (impact − replacement level) × possessions ÷ points-per-win × $-per-win
              <br />
              true cost&nbsp;&nbsp;&nbsp;= cap hit × apron multiplier
              <br />
              AASV&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;= production − true cost
            </span>
            <p style={body}>
              Worked example: a player with +4.0 estimated impact over 2,400 minutes clears replacement level
              ({a.replacementLevel.toFixed(1)}) by 6.0 points per 100 possessions. That&rsquo;s 5,000 possessions →
              300 net points → about {(300 / a.pointsPerWin).toFixed(1)} wins → roughly{" "}
              {fmtMillions((300 / a.pointsPerWin) * a.dollarsPerWin)} of production. If he earns $30M on a
              second-apron team (×{a.apronMultipliers.second.toFixed(1)}), his true cost is $60M — and a &ldquo;max
              player&rdquo; becomes a net negative on the ledger. Move the sliders and that verdict moves with you.
            </p>
          </Section>

          <Section>
            <h2 style={h2}>What the impact metric actually is</h2>
            <p style={body}>
              The number the site labels <strong>est. impact</strong> is the NBA&rsquo;s own{" "}
              <em>estimated net rating</em> from stats.nba.com&rsquo;s estimated-player-metrics endpoint — an
              estimate of the score margin per 100 possessions with the player on the floor. It is{" "}
              <strong>not EPM, RAPM, or any proprietary all-in-one metric</strong>, and it is noisier than the best of
              those: it does not fully separate a player from his lineup. Where the live feed has never run, the site
              falls back to a checked-in snapshot of Box Plus-Minus (BPM) approximations, and each player page says
              which source it is using. When two sources disagree about the same player, the model treats that
              disagreement as a research question, not an inconvenience — see the{" "}
              <Link href="/analytics/questions" className="bow-link" style={{ color: "var(--bow-blue)" }}>docket</Link>.
            </p>
          </Section>

          <Section>
            <h2 style={h2}>Where the defaults come from</h2>
            <p style={body}>
              Honesty first: the defaults are <strong>editorial judgment anchored to public analysis, not fitted
              parameters</strong>. Nobody regressed {fmtMillions(a.dollarsPerWin)}-per-win out of a dataset; it sits
              in the range public estimates of the market price of a marginal win have occupied in recent CBA
              seasons, and the {a.pointsPerWin}-points-per-win conversion is a standard rule of thumb from the
              public analytics literature. The apron multipliers ({a.apronMultipliers.below.toFixed(1)}× /{" "}
              {a.apronMultipliers.first.toFixed(1)}× / {a.apronMultipliers.second.toFixed(1)}×) encode a view about
              how much tax penalties and roster restrictions really cost a front office — a view reasonable people
              price differently. That is exactly why every one of them is a slider with named presets: the model
              refuses to pretend its calibration is a fact. If you disagree with a default, you don&rsquo;t have to
              trust us — <Link href="/analytics" className="bow-link" style={{ color: "var(--bow-blue)" }}>change it</Link>.
            </p>
          </Section>

          <Section>
            <h2 style={h2}>The data</h2>
            <p style={body}>
              The site currently tracks <strong>{p.playerCount} contracts across {p.teamCount} teams</strong> — the
              top of each team&rsquo;s cap sheet, not full 15-man rosters. Contract figures are hand-curated from
              public reporting{p.asOf ? ` (last curated ${p.asOf})` : ""} and are approximations, not licensed
              cap-sheet data; treat dollar figures as close, not exact. Stats refresh nightly from stats.nba.com when
              the feed cooperates{p.statsUpdatedAt ? ` (last successful refresh ${new Date(p.statsUpdatedAt).toISOString().slice(0, 10)})` : " — this deployment is still running on the snapshot"}.
            </p>
          </Section>

          <Section>
            <h2 style={h2}>What the model leaves out</h2>
            <p style={body}>
              The honest limits, in one place: <strong>team rollups cover tracked players only</strong>, so a team
              with more tracked contracts shows more total production — team figures compare cap-sheet tops, not
              full rosters. <strong>There are no player ages in the data</strong>; aging risk is proxied from
              contract length and multi-season trends, and says so where it appears. <strong>The trade machine
              checks salary matching and apron aggregation, not the full CBA</strong> — no trade exceptions,
              base-year rules, or signed-and-trade mechanics. And the <strong>Franchise Strategy Index is an
              experimental composite</strong> whose weights have not been backtested against real outcomes. Every
              verdict on this site should be read the way the badges now say it: <em>under these assumptions</em>.
            </p>
            <p style={{ ...body, marginBottom: 0 }}>
              When the model changes its mind as real data moves, it says so in public — that record is{" "}
              <Link href="/analytics/ledger" className="bow-link" style={{ color: "var(--bow-blue)" }}>the Open Ledger</Link>.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}
