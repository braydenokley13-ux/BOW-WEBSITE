/* ============================================================
 * Front Office Concept Map (Feature 3) — public, login-free.
 *
 * A structured proof of depth for league contacts: every economics
 * concept BOW teaches, which track/module teaches it, how a real
 * front office uses it, and one specific real-world example. Written
 * like a briefing document, not a textbook.
 *
 * Seed bank (pure data) + read layer. db.ts seeds the `concept_map`
 * table on boot. category ∈ { micro, macro, sports_specific }.
 * ============================================================ */

import { getDb } from "@/lib/db";

export type ConceptCategory = "micro" | "macro" | "sports_specific";

export interface ConceptMapEntry {
  id: string;
  ordinal: number;
  conceptName: string;
  track: string;
  moduleName: string;
  frontofficeApplication: string;
  realExample: string;
  category: ConceptCategory;
}

/** Human label for a category (used by the filter bar). */
export const CONCEPT_CATEGORY_LABEL: Record<ConceptCategory, string> = {
  micro: "AP Micro",
  macro: "AP Macro",
  sports_specific: "Sports-Specific",
};

/** The concept map seed — 30 concepts across both tracks. */
export const CONCEPT_MAP: ConceptMapEntry[] = [
  {
    id: "cm-01", ordinal: 1, conceptName: "Opportunity Cost", track: "101", moduleName: "Track 101, Module 1", category: "micro",
    frontofficeApplication: "Every cap dollar, roster spot, and draft pick spent on one player is value not spent on another — front offices price every signing against the best alternative they pass up.",
    realExample: "When Oklahoma City stockpiled future first-round picks instead of chasing win-now veterans, it was choosing long-term flexibility over immediate wins — a deliberate opportunity-cost bet that built a young contender.",
  },
  {
    id: "cm-02", ordinal: 2, conceptName: "Scarcity", track: "101", moduleName: "Track 101, Module 1", category: "micro",
    frontofficeApplication: "Cap space, roster spots, draft picks, and elite talent are all limited — scarcity is why front offices must rank and choose rather than acquire everything.",
    realExample: "With only two max-contract slots realistically available, the 2019 Clippers had to clear money and players to land both Kawhi Leonard and Paul George at once.",
  },
  {
    id: "cm-03", ordinal: 3, conceptName: "Incentives", track: "101", moduleName: "Track 101, Module 1", category: "micro",
    frontofficeApplication: "Contracts are incentive systems — bonuses, guarantees, and option years are engineered to align a player's behavior with the team's goals.",
    realExample: "Performance and games-played bonuses are written into NFL and NBA deals specifically to reward availability and production, nudging players to stay on the field.",
  },
  {
    id: "cm-04", ordinal: 4, conceptName: "Cost-Benefit Analysis", track: "101", moduleName: "Track 101, Module 1", category: "micro",
    frontofficeApplication: "Before any signing, trade, or facility investment, front offices weigh expected wins and revenue against total cost — the core discipline behind every major decision.",
    realExample: "Teams routinely pass on big-name free agents when the projected wins added don't justify the contract plus luxury-tax bill — a cost-benefit call made every July.",
  },
  {
    id: "cm-05", ordinal: 5, conceptName: "Law of Demand", track: "101", moduleName: "Track 101, Module 2", category: "micro",
    frontofficeApplication: "Ticket, concession, and merchandise pricing all assume that as price rises, quantity demanded falls — the foundation of every revenue model.",
    realExample: "Dynamic-pricing systems used across MLB and the NBA raise prices for marquee opponents and cut them for low-demand games, riding the demand curve in real time.",
  },
  {
    id: "cm-06", ordinal: 6, conceptName: "Law of Supply", track: "101", moduleName: "Track 101, Module 2", category: "micro",
    frontofficeApplication: "A fixed supply of seats, suites, and broadcast inventory means front offices manage scarcity on the sell side to protect price.",
    realExample: "Premium courtside and suite inventory is deliberately kept limited so that, against high demand, those few seats command six-figure prices.",
  },
  {
    id: "cm-07", ordinal: 7, conceptName: "Market Equilibrium", track: "101", moduleName: "Track 101, Module 2", category: "micro",
    frontofficeApplication: "Pricing teams hunt for the equilibrium where seats sell out at the highest sustainable price — too high leaves empty seats, too low leaves money on the table.",
    realExample: "Resale markets like StubHub reveal the true equilibrium price for tickets, and teams now price closer to it instead of leaving value to scalpers.",
  },
  {
    id: "cm-08", ordinal: 8, conceptName: "Price Elasticity", track: "101", moduleName: "Track 101, Module 2", category: "micro",
    frontofficeApplication: "Front offices raise prices most on inelastic goods (parking, premium seats) and least on elastic ones (upper-deck tickets, concessions) to maximize revenue without driving fans away.",
    realExample: "Many teams hold concession prices flat or cut them while raising premium-seat and parking prices, exploiting the different elasticities of each.",
  },
  {
    id: "cm-09", ordinal: 9, conceptName: "Competition & Market Structure", track: "101", moduleName: "Track 101, Module 2", category: "micro",
    frontofficeApplication: "Leagues operate as cartels of independent teams, and front offices navigate the rules (drafts, caps, territories) that limit competition among themselves.",
    realExample: "The NFL's collective bargaining and revenue rules let 32 independent teams behave like a single, coordinated business — a structure courts have repeatedly scrutinized.",
  },
  {
    id: "cm-10", ordinal: 10, conceptName: "Monopoly", track: "101", moduleName: "Track 101, Module 2", category: "micro",
    frontofficeApplication: "A team is usually the only seller of its sport in its city, giving it local monopoly power over pricing — and drawing antitrust attention.",
    realExample: "Each MLB club holds an exclusive territory, a form of protected monopoly upheld by baseball's century-old antitrust exemption.",
  },
  {
    id: "cm-11", ordinal: 11, conceptName: "Externalities", track: "101", moduleName: "Track 101, Module 4", category: "micro",
    frontofficeApplication: "A new arena creates positive spillovers (nearby business) and negative ones (traffic, noise) that front offices and cities must weigh and manage.",
    realExample: "The development around Atlanta's Battery district beside Truist Park is a textbook positive externality — restaurants and offices that profit from the stadium next door.",
  },
  {
    id: "cm-12", ordinal: 12, conceptName: "Public Goods", track: "101", moduleName: "Track 101, Module 4", category: "micro",
    frontofficeApplication: "Stadium-financing debates turn on whether a publicly funded arena delivers a true public good or a private benefit dressed up as one.",
    realExample: "The roughly $750M in public money for the Raiders' Allegiant Stadium in Las Vegas reignited the national debate over taxpayer-funded venues.",
  },
  {
    id: "cm-13", ordinal: 13, conceptName: "GDP & Economic Growth", track: "101", moduleName: "Track 101, Module 3", category: "macro",
    frontofficeApplication: "League revenue tracks the broader economy — front offices plan budgets around growth forecasts that move ticket demand and sponsorship dollars.",
    realExample: "The NBA's salary cap, tied to Basketball Related Income, jumped sharply after the 2016 national TV deal — league 'GDP' growth flowing straight to team budgets.",
  },
  {
    id: "cm-14", ordinal: 14, conceptName: "Inflation", track: "101", moduleName: "Track 101, Module 3", category: "macro",
    frontofficeApplication: "Salaries, ticket prices, and operating costs all rise with inflation, so front offices compare contracts and budgets in inflation-adjusted terms.",
    realExample: "A $1M salary that made a player elite in 1990 would be a near-minimum deal today — a gap explained almost entirely by inflation and revenue growth.",
  },
  {
    id: "cm-15", ordinal: 15, conceptName: "Fiscal Policy", track: "101", moduleName: "Track 101, Module 3", category: "macro",
    frontofficeApplication: "Public stadium subsidies and tax breaks are fiscal-policy tools that directly shape where teams build and how much owners pay.",
    realExample: "Cities routinely offer hundreds of millions in tax incentives to keep or attract franchises, as Nashville did to land an NFL stadium deal.",
  },
  {
    id: "cm-16", ordinal: 16, conceptName: "Monetary Policy", track: "101", moduleName: "Track 101, Module 3", category: "macro",
    frontofficeApplication: "Interest rates set by central banks change the cost of borrowing for arenas, franchise purchases, and stadium bonds.",
    realExample: "When the Federal Reserve raised rates in 2022–23, the cost of financing new arena construction climbed, reshaping owners' building timelines.",
  },
  {
    id: "cm-17", ordinal: 17, conceptName: "The Business Cycle", track: "101", moduleName: "Track 101, Module 3", category: "macro",
    frontofficeApplication: "Recessions cut season-ticket renewals and sponsorship budgets, so front offices build financial cushions for the down part of the cycle.",
    realExample: "During the 2020 pandemic shutdown, leagues lost billions in gate revenue, forcing teams to renegotiate budgets and defer spending.",
  },
  {
    id: "cm-18", ordinal: 18, conceptName: "The Multiplier Effect", track: "101", moduleName: "Track 101, Module 3", category: "macro",
    frontofficeApplication: "Teams cite the multiplier — spending that ripples through a local economy — to justify public investment in arenas and events.",
    realExample: "Host cities project that a Super Bowl injects hundreds of millions into the local economy, though independent economists argue the real multiplier is far smaller.",
  },
  {
    id: "cm-19", ordinal: 19, conceptName: "Salary Cap", track: "201", moduleName: "Track 201, Module 1", category: "sports_specific",
    frontofficeApplication: "The cap is the master constraint of roster building — every signing, trade, and extension is engineered to fit under (or work around) it.",
    realExample: "The NBA's cap, set as a share of league revenue, rose past $140M for 2024-25, resetting what every team could spend in a single offseason.",
  },
  {
    id: "cm-20", ordinal: 20, conceptName: "Bird Rights", track: "201", moduleName: "Track 201, Module 1", category: "sports_specific",
    frontofficeApplication: "Bird Rights let a capped-out team re-sign its own free agents, making continuity possible and giving incumbent teams a built-in retention edge.",
    realExample: "Bird Rights are why the Warriors could re-sign Stephen Curry to a supermax extension despite being far over the cap.",
  },
  {
    id: "cm-21", ordinal: 21, conceptName: "Mid-Level Exception", track: "201", moduleName: "Track 201, Module 1", category: "sports_specific",
    frontofficeApplication: "The MLE is often a contender's only tool to add an outside free agent without cap space — front offices guard it carefully each summer.",
    realExample: "Championship rosters routinely fill their final rotation spot using the MLE, since they're capped out from re-signing their own stars.",
  },
  {
    id: "cm-22", ordinal: 22, conceptName: "Luxury Tax", track: "201", moduleName: "Track 201, Module 1", category: "sports_specific",
    frontofficeApplication: "The progressive, repeater-penalized tax makes each dollar over the line cost far more, forcing front offices to weigh wins against an escalating bill.",
    realExample: "The 2023 Golden State Warriors paid over $170M in luxury tax — the highest single-season bill in NBA history — to keep their championship roster together.",
  },
  {
    id: "cm-23", ordinal: 23, conceptName: "Revenue Sharing", track: "201", moduleName: "Track 201, Module 2", category: "sports_specific",
    frontofficeApplication: "Shared revenue keeps small markets solvent and competitive, and shapes how aggressively each franchise can invest in payroll.",
    realExample: "MLB's revenue-sharing system redistributes hundreds of millions a year, and the league has publicly pressed teams to spend those checks on payroll rather than profit.",
  },
  {
    id: "cm-24", ordinal: 24, conceptName: "Market Size", track: "201", moduleName: "Track 201, Module 2", category: "sports_specific",
    frontofficeApplication: "Market size sets the ceiling on local TV, sponsorship, and gate revenue, so front offices in small markets must out-draft and out-value bigger ones.",
    realExample: "The Knicks and Lakers command local media deals worth many times those of small-market clubs purely on the size of their TV audiences.",
  },
  {
    id: "cm-25", ordinal: 25, conceptName: "Media Rights", track: "201", moduleName: "Track 201, Module 2", category: "sports_specific",
    frontofficeApplication: "National media deals are the single largest revenue source in major leagues, and their size directly sets the salary cap and every team's budget.",
    realExample: "The NBA's media-rights agreements reached roughly $76B over 11 years in 2024, a deal that will lift the cap for every franchise for a decade.",
  },
  {
    id: "cm-26", ordinal: 26, conceptName: "Analytics & WAR", track: "201", moduleName: "Track 201, Module 3", category: "sports_specific",
    frontofficeApplication: "Front offices use advanced metrics like WAR to value players beyond the box score, finding contributors that traditional scouting underrates.",
    realExample: "The 2002 Oakland A's, immortalized in 'Moneyball,' used on-base percentage to find undervalued players and reach the playoffs on a fraction of the payroll.",
  },
  {
    id: "cm-27", ordinal: 27, conceptName: "Market Inefficiency", track: "201", moduleName: "Track 201, Module 3", category: "micro",
    frontofficeApplication: "Sustained winning on a budget comes from finding gaps between a player's price and true value — and acting before rivals copy the insight.",
    realExample: "Early adopters of the three-point shot signed elite shooters cheaply for years before the rest of the NBA caught on and prices corrected.",
  },
  {
    id: "cm-28", ordinal: 28, conceptName: "Surplus Value", track: "201", moduleName: "Track 201, Module 4", category: "sports_specific",
    frontofficeApplication: "The whole roster-building game is maximizing surplus value — production above salary — which is why cheap, productive contracts are a team's most prized assets.",
    realExample: "A first-team All-NBA player on a rookie-scale deal can deliver $20M+ in surplus value a year, the financial engine behind nearly every recent champion.",
  },
  {
    id: "cm-29", ordinal: 29, conceptName: "Roster Windows", track: "201", moduleName: "Track 201, Module 4", category: "sports_specific",
    frontofficeApplication: "Front offices time aggressive moves to a roster's contention window — pushing chips in while stars are in their prime and contracts align.",
    realExample: "The 2023 Suns traded a haul of picks and players for Kevin Durant, an all-in bet that their championship window was open right now.",
  },
  {
    id: "cm-30", ordinal: 30, conceptName: "Pick Value & Decay", track: "201", moduleName: "Track 201, Module 4", category: "sports_specific",
    frontofficeApplication: "Draft picks are valued by slot and discounted by time, and front offices use value charts to judge whether a pick-heavy trade is fair.",
    realExample: "The Herschel Walker trade — where Dallas turned one star into a haul of picks that built a dynasty — is the classic case of pick value compounding over time.",
  },
];

/* eslint-disable @typescript-eslint/no-explicit-any */

/** All concept-map entries, ordered (DB first, falling back to the seed). */
export function getConceptMap(): ConceptMapEntry[] {
  const rows = getDb().prepare("SELECT * FROM concept_map ORDER BY ordinal ASC").all() as any[];
  if (rows.length === 0) return [...CONCEPT_MAP].sort((a, b) => a.ordinal - b.ordinal);
  return rows.map((r) => ({
    id: r.id,
    ordinal: Number(r.ordinal) || 0,
    conceptName: r.concept_name,
    track: r.track,
    moduleName: r.module_name,
    frontofficeApplication: r.frontoffice_application,
    realExample: r.real_example,
    category: r.category as ConceptCategory,
  }));
}

/* eslint-enable @typescript-eslint/no-explicit-any */
