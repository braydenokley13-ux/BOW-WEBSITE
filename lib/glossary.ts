/* ============================================================
 * Front Office Glossary (Feature 5) — public, login-free.
 *
 * A searchable glossary of every term used in BOW curriculum. Each
 * entry: a plain-English definition (5th–8th grade), which module it's
 * taught in, and a one-sentence real-world usage example.
 *
 * Seed bank (pure data) + read layer. db.ts seeds the `glossary_terms`
 * table on boot. category ∈ { cap_mechanics, economics, analytics, business }.
 * ============================================================ */

import { getDb } from "@/lib/db";

export type GlossaryCategory = "cap_mechanics" | "economics" | "analytics" | "business";

export interface GlossaryTerm {
  id: string;
  ordinal: number;
  term: string;
  definition: string;
  moduleName: string;
  track: string;
  realWorldExample: string;
  category: GlossaryCategory;
}

/** Human label for a glossary category (used by the filter bar). */
export const GLOSSARY_CATEGORY_LABEL: Record<GlossaryCategory, string> = {
  cap_mechanics: "Cap Mechanics",
  economics: "Economics",
  analytics: "Analytics",
  business: "Business",
};

/** The glossary seed — 42 terms across both tracks. */
export const GLOSSARY_TERMS: GlossaryTerm[] = [
  /* ---- Cap mechanics (Track 201, Module 1) ---- */
  {
    id: "gl-01", ordinal: 1, term: "Salary Cap", track: "201", moduleName: "Track 201, Module 1", category: "cap_mechanics",
    definition: "A limit on how much money a team can spend on player salaries in a season. It's set as a share of league revenue, so it rises when the league earns more. The cap exists to keep richer teams from buying up all the best players.",
    realWorldExample: "When the NBA signed a huge new TV deal, the salary cap jumped and teams suddenly had millions more to spend that summer.",
  },
  {
    id: "gl-02", ordinal: 2, term: "Soft Cap", track: "201", moduleName: "Track 201, Module 1", category: "cap_mechanics",
    definition: "A salary cap that teams are allowed to go over, but only by using special exceptions. It sets a limit while still giving teams ways to keep their own players. The NBA uses a soft cap.",
    realWorldExample: "A team already over the soft cap can still re-sign its own star by using Bird Rights.",
  },
  {
    id: "gl-03", ordinal: 3, term: "Hard Cap", track: "201", moduleName: "Track 201, Module 1", category: "cap_mechanics",
    definition: "A spending limit that a team absolutely cannot cross, no matter what. Unlike a soft cap, there are no exceptions to get around it. The NFL uses a hard cap.",
    realWorldExample: "An NFL team that wants a new player but is at the hard cap must first cut or trade someone to make room.",
  },
  {
    id: "gl-04", ordinal: 4, term: "Luxury Tax", track: "201", moduleName: "Track 201, Module 1", category: "cap_mechanics",
    definition: "A penalty fee teams pay when their payroll goes above a set line. The more they go over, the higher the rate they pay. It's meant to discourage the richest teams from outspending everyone.",
    realWorldExample: "The 2023 Warriors paid over $170M in luxury tax — the biggest bill in NBA history — to keep their championship roster.",
  },
  {
    id: "gl-05", ordinal: 5, term: "Second Apron", track: "201", moduleName: "Track 201, Module 1", category: "cap_mechanics",
    definition: "An extra-high spending line above the luxury tax with especially harsh penalties. Teams that cross it lose access to many roster tools. It acts like a hard ceiling on the very biggest spenders.",
    realWorldExample: "Teams now break up rosters before crossing the second apron because the restrictions make future moves nearly impossible.",
  },
  {
    id: "gl-06", ordinal: 6, term: "Bird Rights", track: "201", moduleName: "Track 201, Module 1", category: "cap_mechanics",
    definition: "A rule that lets a team go over the salary cap to re-sign its own free agent. A player earns them after three seasons with the same team. They reward teams for keeping the players they developed.",
    realWorldExample: "Bird Rights are why the Warriors could give Stephen Curry a record extension even though they were far over the cap.",
  },
  {
    id: "gl-07", ordinal: 7, term: "Mid-Level Exception", track: "201", moduleName: "Track 201, Module 1", category: "cap_mechanics",
    definition: "A tool that lets a team already over the cap sign one outside free agent for a set amount of money. The league decides the amount each year. It's often a contender's only way to add new talent.",
    realWorldExample: "Many championship teams fill their last rotation spot using the mid-level exception because they have no cap space left.",
  },
  {
    id: "gl-08", ordinal: 8, term: "Bi-Annual Exception", track: "201", moduleName: "Track 201, Module 1", category: "cap_mechanics",
    definition: "A smaller signing tool that a capped-out team can use only once every two years. It lets the team add a player for a modest set amount. It's a backup option alongside the mid-level exception.",
    realWorldExample: "A team that used its bi-annual exception last summer has to wait a year before it can use it again.",
  },
  {
    id: "gl-09", ordinal: 9, term: "Basketball Related Income", track: "201", moduleName: "Track 201, Module 2", category: "cap_mechanics",
    definition: "The total money the NBA makes from basketball — tickets, TV deals, and more. Players get a fixed share of it, and that share sets the salary cap. When this income grows, every team's budget grows too.",
    realWorldExample: "A jump in Basketball Related Income from a new media deal is what pushes the salary cap higher for all 30 teams.",
  },
  {
    id: "gl-10", ordinal: 10, term: "Rookie Scale", track: "201", moduleName: "Track 201, Module 1", category: "cap_mechanics",
    definition: "A fixed pay chart for first-round draft picks based on where they were drafted. It means rookies don't negotiate their first salary — it's set in advance. Cheap rookie deals can be huge bargains if the player is good.",
    realWorldExample: "A star drafted near the top still earns only his rookie-scale salary, giving his team elite production at a low price.",
  },
  {
    id: "gl-11", ordinal: 11, term: "Max Contract", track: "201", moduleName: "Track 201, Module 1", category: "cap_mechanics",
    definition: "The largest contract a player is allowed to sign, capped at a percentage of the salary cap. The exact max rises with experience. It exists so no single player can take up the entire team budget.",
    realWorldExample: "A 10-year veteran can earn a higher max than a younger star, even on the same team.",
  },
  {
    id: "gl-12", ordinal: 12, term: "Veteran Minimum", track: "201", moduleName: "Track 201, Module 1", category: "cap_mechanics",
    definition: "The smallest salary a team is allowed to pay a veteran player. The amount rises slightly with years of experience. Contenders often fill their bench with veterans on minimum deals.",
    realWorldExample: "A respected veteran chasing a ring will often sign a veteran-minimum contract to join a title team.",
  },
  {
    id: "gl-13", ordinal: 13, term: "Trade Exception", track: "201", moduleName: "Track 201, Module 1", category: "cap_mechanics",
    definition: "A credit a team gets when it trades away a player and takes back less salary. It lets the team add a matching contract later without sending out a player. Trade exceptions expire after one year.",
    realWorldExample: "A team that traded a star for picks kept a trade exception to absorb a useful contract months later.",
  },
  {
    id: "gl-14", ordinal: 14, term: "Sign-and-Trade", track: "201", moduleName: "Track 201, Module 1", category: "cap_mechanics",
    definition: "A deal where a team re-signs its own free agent and immediately trades him to another team. It lets the player get a bigger contract and the old team get something back instead of nothing. Both sides can benefit.",
    realWorldExample: "Instead of losing a star for free, a team used a sign-and-trade to turn him into draft picks and players.",
  },
  {
    id: "gl-15", ordinal: 15, term: "Stretch Provision", track: "201", moduleName: "Track 201, Module 1", category: "cap_mechanics",
    definition: "A rule that lets a team waive a player and spread his remaining pay across more years. This lowers the yearly cap hit but keeps it on the books longer. It's a way to clear short-term room.",
    realWorldExample: "A team stretched a waived player's contract to free up cap space to chase a free agent that summer.",
  },
  /* ---- Economics (Track 101) ---- */
  {
    id: "gl-16", ordinal: 16, term: "Opportunity Cost", track: "101", moduleName: "Track 101, Module 1", category: "economics",
    definition: "What you give up when you choose one option over another. It's the value of the next-best thing you didn't pick. Every choice has an opportunity cost, even good ones.",
    realWorldExample: "Spending a draft pick on a quarterback means the opportunity cost is the pass rusher the team could have taken instead.",
  },
  {
    id: "gl-17", ordinal: 17, term: "Scarcity", track: "101", moduleName: "Track 101, Module 1", category: "economics",
    definition: "When there isn't enough of something for everyone who wants it. Scarcity forces people and teams to make choices. It's the basic reason economics exists.",
    realWorldExample: "With only 15 roster spots and dozens of hopefuls, scarcity forces a team to cut talented players every preseason.",
  },
  {
    id: "gl-18", ordinal: 18, term: "Incentives", track: "101", moduleName: "Track 101, Module 1", category: "economics",
    definition: "Rewards or penalties that influence how people behave. A good incentive makes someone want to do the right thing. Contracts are full of incentives designed to shape a player's effort.",
    realWorldExample: "A bonus for making the All-Star team is an incentive that pushes a player to practice harder.",
  },
  {
    id: "gl-19", ordinal: 19, term: "Law of Demand", track: "101", moduleName: "Track 101, Module 2", category: "economics",
    definition: "When the price of something goes up, people usually buy less of it. When the price drops, people buy more. It's one of the most reliable patterns in economics.",
    realWorldExample: "When a team raised ticket prices sharply, the law of demand kicked in and attendance fell.",
  },
  {
    id: "gl-20", ordinal: 20, term: "Law of Supply", track: "101", moduleName: "Track 101, Module 2", category: "economics",
    definition: "When the price of something rises, sellers usually want to produce more of it. Higher prices make selling more worthwhile. It pairs with the law of demand to explain markets.",
    realWorldExample: "When ticket resale prices soar for a playoff game, more fans list their seats for sale.",
  },
  {
    id: "gl-21", ordinal: 21, term: "Equilibrium", track: "101", moduleName: "Track 101, Module 2", category: "economics",
    definition: "The price where the amount people want to buy equals the amount sellers want to sell. At equilibrium there's no shortage and no surplus. Markets tend to drift toward it.",
    realWorldExample: "A team finds ticket equilibrium when seats sell out at the highest price fans will still pay.",
  },
  {
    id: "gl-22", ordinal: 22, term: "Comparative Advantage", track: "101", moduleName: "Track 101, Module 2", category: "economics",
    definition: "Doing the job you give up the least to do, and letting others do the rest. Even if one person is better at everything, splitting tasks this way produces more overall. It's why teamwork beats trying to do it all.",
    realWorldExample: "A star who is both the best scorer and passer focuses on scoring, his comparative advantage, while a teammate runs the offense.",
  },
  {
    id: "gl-23", ordinal: 23, term: "Market Failure", track: "101", moduleName: "Track 101, Module 4", category: "economics",
    definition: "When a market doesn't reach a fair or efficient result on its own. It can happen when there's no competition or when costs land on people who weren't part of the deal. Governments sometimes step in to fix it.",
    realWorldExample: "When one ticket company controls all sales and adds huge hidden fees, that's a market failure with no competition to fix it.",
  },
  {
    id: "gl-24", ordinal: 24, term: "Externality", track: "101", moduleName: "Track 101, Module 4", category: "economics",
    definition: "A side effect of a choice that affects people who weren't part of it. It can be good (a positive externality) or bad (a negative one). Stadiums create both.",
    realWorldExample: "Busy restaurants near a new arena are a positive externality; the extra traffic and noise are a negative one.",
  },
  {
    id: "gl-25", ordinal: 25, term: "Public Good", track: "101", moduleName: "Track 101, Module 4", category: "economics",
    definition: "Something everyone can use and no one can be blocked from using. One person using it doesn't stop others from using it too. Because you can't sell it, governments usually pay for it.",
    realWorldExample: "Free post-game fireworks anyone in the city can watch are a public good, which is why a private company rarely funds them alone.",
  },
  {
    id: "gl-26", ordinal: 26, term: "Monopoly", track: "101", moduleName: "Track 101, Module 2", category: "economics",
    definition: "When one seller controls a market with no real competition. With nowhere else to go, customers must accept that seller's prices. Monopolies can charge more than they could with rivals.",
    realWorldExample: "A city's only pro team holds a local monopoly, letting it charge premium prices fans can't get elsewhere.",
  },
  {
    id: "gl-27", ordinal: 27, term: "Oligopoly", track: "101", moduleName: "Track 101, Module 2", category: "economics",
    definition: "A market controlled by just a few large sellers (or buyers). No single one dominates, but together they shape prices. Their decisions heavily influence the whole market.",
    realWorldExample: "A handful of TV networks bidding on sports rights form an oligopoly that shapes how much those rights cost.",
  },
  {
    id: "gl-28", ordinal: 28, term: "GDP", track: "101", moduleName: "Track 101, Module 3", category: "economics",
    definition: "Short for Gross Domestic Product, the total value of everything a country produces in a year. It's the main way to measure how big an economy is. When GDP grows, the economy is producing more.",
    realWorldExample: "Economists watch GDP to gauge the whole economy, much like a league watches its total revenue to gauge its health.",
  },
  {
    id: "gl-29", ordinal: 29, term: "Inflation", track: "101", moduleName: "Track 101, Module 3", category: "economics",
    definition: "The general rise in prices over time, which makes each dollar buy a little less. A small amount is normal; too much is a problem. It's why old prices look so cheap compared to today's.",
    realWorldExample: "Because of inflation, a salary that made a player rich in 1990 would barely beat the minimum today.",
  },
  {
    id: "gl-30", ordinal: 30, term: "Fiscal Policy", track: "101", moduleName: "Track 101, Module 3", category: "economics",
    definition: "The government using taxes and spending to influence the economy. Cutting taxes or spending more can speed it up; doing the opposite can slow it down. It's one of two main tools to steer the economy.",
    realWorldExample: "When a city offers a team tax breaks to build a stadium, that's fiscal policy in action.",
  },
  {
    id: "gl-31", ordinal: 31, term: "Monetary Policy", track: "101", moduleName: "Track 101, Module 3", category: "economics",
    definition: "A central bank managing the economy by changing interest rates and the money supply. Raising rates cools spending; lowering them encourages it. It works alongside fiscal policy.",
    realWorldExample: "When the Federal Reserve raised interest rates, financing a new arena got more expensive for owners.",
  },
  {
    id: "gl-32", ordinal: 32, term: "Market Inefficiency", track: "201", moduleName: "Track 201, Module 3", category: "economics",
    definition: "A gap between what something costs and what it's truly worth. Smart buyers exploit it before others notice. Once everyone catches on, the gap usually closes.",
    realWorldExample: "Teams that valued three-point shooting early signed great shooters cheaply until the rest of the league caught up.",
  },
  /* ---- Analytics (Track 201, Module 3 & 4) ---- */
  {
    id: "gl-33", ordinal: 33, term: "Wins Above Replacement", track: "201", moduleName: "Track 201, Module 3", category: "analytics",
    definition: "An estimate of how many extra wins a player adds compared to a freely available replacement. It rolls many skills into one number. It helps compare very different players fairly.",
    realWorldExample: "A low-scoring defender can post a high WAR because his team plays much better when he's on the floor.",
  },
  {
    id: "gl-34", ordinal: 34, term: "Player Efficiency Rating", track: "201", moduleName: "Track 201, Module 3", category: "analytics",
    definition: "A single number that sums up a player's per-minute production. It rewards positive plays and subtracts negative ones. It's a quick snapshot, though it can undervalue defense.",
    realWorldExample: "A scorer with a high Player Efficiency Rating still might not help his team if his defense is poor.",
  },
  {
    id: "gl-35", ordinal: 35, term: "True Shooting Percentage", track: "201", moduleName: "Track 201, Module 3", category: "analytics",
    definition: "A shooting stat that counts two-pointers, three-pointers, and free throws together. It shows how efficiently a player scores, not just how often. It's fairer than basic field-goal percentage.",
    realWorldExample: "A sharpshooter who makes lots of threes can have a high true shooting percentage even with a modest field-goal percentage.",
  },
  {
    id: "gl-36", ordinal: 36, term: "Surplus Value", track: "201", moduleName: "Track 201, Module 4", category: "analytics",
    definition: "The difference between a player's true value and what he's actually paid. Positive surplus means the team is getting a bargain. It's the heart of smart roster building.",
    realWorldExample: "A star on a cheap rookie deal can deliver $20M a year in surplus value, the financial engine of most contenders.",
  },
  {
    id: "gl-37", ordinal: 37, term: "Pick Value", track: "201", moduleName: "Track 201, Module 4", category: "analytics",
    definition: "How much a draft pick is worth, based on where it lands and how soon it arrives. Higher picks are worth more, and picks years away are worth less today. Teams use value charts to judge trades.",
    realWorldExample: "Front offices check a pick-value chart to decide whether trading down for extra picks is a fair deal.",
  },
  /* ---- Business (Track 201, Module 2) ---- */
  {
    id: "gl-38", ordinal: 38, term: "Revenue Sharing", track: "201", moduleName: "Track 201, Module 2", category: "business",
    definition: "A system where richer teams share some of their money with smaller-market teams. It helps keep small markets competitive. Its goal is a healthier, more balanced league.",
    realWorldExample: "MLB's revenue sharing sends hundreds of millions a year to smaller-market clubs to help them keep up.",
  },
  {
    id: "gl-39", ordinal: 39, term: "Market Size", track: "201", moduleName: "Track 201, Module 2", category: "business",
    definition: "The number of fans and businesses a team can reach. Bigger markets mean more ticket buyers, viewers, and sponsors. It sets a ceiling on how much money a team can earn.",
    realWorldExample: "New York's huge market lets the Knicks earn far more local TV money than a small-market team ever could.",
  },
  {
    id: "gl-40", ordinal: 40, term: "Gate Revenue", track: "201", moduleName: "Track 201, Module 2", category: "business",
    definition: "The money a team makes from selling tickets to its games. It was once a team's biggest income source. Today TV deals often earn even more.",
    realWorldExample: "When the pandemic emptied arenas, teams lost almost all their gate revenue overnight.",
  },
  {
    id: "gl-41", ordinal: 41, term: "Naming Rights", track: "201", moduleName: "Track 201, Module 2", category: "business",
    definition: "The right to put a company's name on a stadium or arena, sold for a large fee. The company gets years of advertising; the team gets steady income. Deals can run into the hundreds of millions.",
    realWorldExample: "Companies pay hundreds of millions for stadium naming rights so their brand appears every time the venue is mentioned.",
  },
  {
    id: "gl-42", ordinal: 42, term: "Roster Window", track: "201", moduleName: "Track 201, Module 4", category: "business",
    definition: "The limited stretch of time when a team is good enough to truly contend. It's usually set by the stars' prime years and contracts. Front offices push hardest while the window is open.",
    realWorldExample: "The Suns traded a haul of picks for Kevin Durant, betting their roster window was open right now.",
  },
];

/* eslint-disable @typescript-eslint/no-explicit-any */

/** All glossary terms, ordered alphabetically (DB first, falling back to seed). */
export function getGlossaryTerms(): GlossaryTerm[] {
  const rows = getDb().prepare("SELECT * FROM glossary_terms ORDER BY term ASC").all() as any[];
  if (rows.length === 0) return [...GLOSSARY_TERMS].sort((a, b) => a.term.localeCompare(b.term));
  return rows.map((r) => ({
    id: r.id,
    ordinal: Number(r.ordinal) || 0,
    term: r.term,
    definition: r.definition,
    moduleName: r.module_name,
    track: r.track,
    realWorldExample: r.real_world_example,
    category: r.category as GlossaryCategory,
  }));
}

/** Total glossary terms (admin overview). */
export function countGlossaryTerms(): number {
  const row = getDb().prepare("SELECT COUNT(*) AS n FROM glossary_terms").get() as any;
  return Number(row?.n) || 0;
}

/* eslint-enable @typescript-eslint/no-explicit-any */
