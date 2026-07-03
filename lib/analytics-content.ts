/* ============================================================
 * Analytics publication — first-boot seed articles.
 *
 * Content only (no database imports) so lib/db.ts can seed from it
 * without a circular dependency, the same way lib/account feeds the
 * LMS seed. These three pieces demonstrate the publication's core
 * trick: articles that embed live model output via shortcodes
 * (<PlayerCard/>, <AASVChart/>, <AASVTable/>) instead of pasted
 * screenshots that go stale.
 * ============================================================ */

export interface SeedArticle {
  id: string;
  slug: string;
  title: string;
  dek: string;
  body: string;
  status: "draft" | "published";
  author: string;
  category: string;
  tags: string;
  featured: number;
  /** Days ago it was published (relative stamps keep the seed evergreen). */
  publishedDaysAgo: number | null;
}

export const SEED_ARTICLES: SeedArticle[] = [
  {
    id: "art-seed-brown",
    slug: "why-the-jaylen-brown-contract-actually-made-sense",
    title: "Why the Jaylen Brown Contract Actually Made Sense",
    dek: "The largest deal in league history looked reckless on signing day. Run it through apron-adjusted surplus value and the picture gets more interesting — in both directions.",
    body: `When Jaylen Brown signed the biggest contract in NBA history, the instant reaction split into two camps: "you pay your stars" and "this breaks the cap sheet." Both camps were arguing about the wrong number.

The sticker price is not the cost. Under the current CBA, what a contract costs depends on **where your team sits against the aprons**. A dollar spent by a team below the tax line is just a dollar. The same dollar spent by a first-apron team drags a tax multiplier and shrinking roster tools behind it. At the second apron it starts costing you draft picks and the ability to aggregate salary at all.

That is the entire idea behind **Apron-Adjusted Surplus Value (AASV)** — the model this site runs on:

> AASV = (marginal wins × $/win) − (cap hit × apron multiplier)

Here is Brown's live card, computed from the current database every time this page loads:

<PlayerCard player="jaylen-brown" />

## The Boston math

Boston is a first-apron team, so the model charges every Brown dollar at a premium before asking whether his production covers it. That is a deliberately hostile test. Two things stand out:

- His raw production value clears his **raw** cap hit comfortably in a healthy season. On sticker price alone, the deal is fine.
- The apron multiplier is what turns the debate. Whether Brown is a surplus or a deficit at the apron-adjusted price depends almost entirely on what you believe a win is worth on the open market — which is why the $/win assumption is a slider on the [dashboard](/analytics), not a constant we hide in the code.

Compare him to the two teammates who define the rest of Boston's cap sheet:

<AASVChart players="jaylen-brown,jayson-tatum,derrick-white" />

Derrick White is the quiet hero of this chart: near-star impact at roughly half the cap number. Contracts like White's are *why* a team can afford one Brown-sized deal at the apron. Tatum's line is the cautionary one — a supermax plus a lost season is the single most expensive combination the CBA can produce, and no model setting makes it look good.

<AASVTable players="jaylen-brown,jayson-tatum,derrick-white" />

## What would change the answer

The model is only as good as its assumptions, so argue with them directly:

1. **$/win.** At $3.5M a win, apron-priced supermaxes are nearly impossible to justify. Slide it toward $4.5M–$5M (closer to what recent trades imply contenders actually pay) and Brown's deal moves toward break-even.
2. **The apron multiplier itself.** If you think the first apron is a speed bump rather than a wall, drop the multiplier toward 1.2× and watch half the league's "overpays" become fair deals.
3. **Availability.** Brown's durability is the deal's real moat. The wins term is built from minutes actually played — not reputation.

The honest conclusion: the contract was rational *for Boston specifically* — a team whose title window, supporting cost structure, and tolerance for the tax made an apron-priced star the least-bad option. Copy-paste the same deal onto a team without a Derrick White on the books and the model says something much uglier.

*Every number in this piece is generated live from the model at its default assumptions. Disagree with a default? [Change it and see.](/analytics)*`,
    status: "published",
    author: "BOW Front Office",
    category: "Contract Deep Dives",
    tags: "aprons,celtics,supermax,aasv",
    featured: 1,
    publishedDaysAgo: 3,
  },
  {
    id: "art-seed-apron",
    slug: "the-second-apron-is-a-tax-on-stars",
    title: "The Second Apron Is a Tax on Stars",
    dek: "The 2023 CBA didn't cap spending — it repriced it. Cleveland and New York are the live experiment in what a star costs when every dollar counts double.",
    body: `The second apron was sold as a competitive-balance tool. In practice it is a **repricing mechanism**: it takes the exact same contract and makes it cost more depending on who signs it. No other major league does this so aggressively, and most public analysis still ignores it entirely.

Watch it work on the two teams currently living above the line:

<AASVChart players="donovan-mitchell,evan-mobley,jalen-brunson,karl-anthony-towns,mikal-bridges" />

## Same contracts, different league

At a 2× second-apron multiplier — the model's default, and adjustable if you think it's too cruel — a "team-friendly" deal stops existing. Jalen Brunson's contract is the most celebrated bargain in basketball, *and the model still struggles to clear it at apron prices*, because the multiplier applies to every dollar on the sheet, hero discounts included:

<PlayerCard player="jalen-brunson" />

That is the point people miss about the apron era. The penalty isn't that your worst contract gets worse. It's that **your best contract stops bailing you out.**

## The Cleveland problem

Cleveland's core is young, homegrown, and productive — and the model still flags the roster, because four near-max deals stacked above the second apron price even excellent production at a loss:

<AASVTable players="donovan-mitchell,evan-mobley" />

The uncomfortable arithmetic: a second-apron team needs its stars to produce at historic levels just to break even on them. The teams the model actually likes are the ones paying *below*-apron prices for star production — which, not coincidentally, is a list headed by Oklahoma City.

## What this means for trades

When an apron team trades a big contract to a below-apron team, **value is created out of thin air** — the same production, the same salary, but a lower true cost on the receiving end. That asymmetry is going to drive the next five years of star movement, and it's why "who won the trade?" now has a third answer: sometimes both teams did, because the contract itself changed price in transit.

*Slide the second-apron multiplier on the [dashboard](/analytics) to your own number — the argument in this piece survives anywhere above about 1.4×.*`,
    status: "published",
    author: "BOW Front Office",
    category: "Trade Analysis",
    tags: "aprons,cba,cavaliers,knicks",
    featured: 0,
    publishedDaysAgo: 10,
  },
  {
    id: "art-seed-rookie",
    slug: "rookie-deals-are-the-last-free-lunch",
    title: "Rookie Deals Are the Last Free Lunch",
    dek: "In an apron league, the rookie scale is the only place left where production is systematically underpriced. Draft notes on the surplus engine in Oklahoma City and San Antonio.",
    body: `Every mechanism in the new CBA pushes veteran star prices up. Exactly one mechanism still pushes prices down: the **rookie scale**, which fixes a player's salary for four years no matter how good he turns out to be.

That makes the draft the last reliable source of surplus value in the league, and the model shows it in the most extreme terms possible:

<AASVChart players="victor-wembanyama,jalen-williams,chet-holmgren,shai-gilgeous-alexander" />

<PlayerCard player="victor-wembanyama" />

Wembanyama produces like a max player and costs like a rotation guard. The gap between those two numbers is the single largest surplus in the database — larger than any veteran bargain, at any slider setting. And because San Antonio sits below the aprons, the model charges his dollars at face value.

## Draft economics, stated plainly

- A top-five pick who hits is worth **$30M+ a year in free surplus** during the scale years.
- That surplus is what *pays for* an apron-priced star elsewhere on the roster. Oklahoma City's whole cap sheet is this trick performed three times at once.
- The corollary is brutal: trading a rookie-scale contributor for a veteran on a fair-value deal almost always destroys value, even when it upgrades talent.

This piece is a draft — the full version will walk through pick-value curves and what the model implies about trading up.

<AASVTable players="victor-wembanyama,jalen-williams,chet-holmgren" />`,
    status: "draft",
    author: "BOW Front Office",
    category: "Draft Economics",
    tags: "draft,rookie-scale,thunder,spurs",
    featured: 0,
    publishedDaysAgo: null,
  },
];
