/* ============================================================
 * Daily Question (Feature 1) — the core retention hook.
 *
 * A single multiple-choice question that changes every day and lives
 * at the very top of the student dashboard. It is always available
 * regardless of module progress, takes ~30 seconds, and every question
 * ties an economics concept to a real front-office decision.
 *
 * This module holds the seed bank (60 questions, pure data) AND the
 * read layer. db.ts imports the seed array to load it on boot; the
 * read functions hit the `daily_questions` / `daily_responses` tables.
 *
 * Rotation: the active question is the one whose `active_date` equals
 * today (UTC). If none is dated for today, fall back to a stable
 * rotation by day number so there is ALWAYS a question. Sixty
 * questions = two months of daily use without repeating.
 *
 * Server-only for the read functions (they import getDb). The seed
 * array and pure helpers are client-safe.
 * ============================================================ */

import { getDb } from "@/lib/db";

/** One Daily Question (reference data). */
export interface DailyQuestion {
  id: string;
  /** Stable display/rotation order, 1..60. */
  ordinal: number;
  questionText: string;
  choiceA: string;
  choiceB: string;
  choiceC: string;
  choiceD: string;
  /** The correct choice letter, "A".."D". */
  correctAnswer: string;
  explanation: string;
  /** snake_case BOW concept tag, e.g. "opportunity_cost". */
  conceptTag: string;
  /** 1 = recall, 2 = application, 3 = analysis. */
  difficulty: number;
  /** Optional fixed calendar date (YYYY-MM-DD) this question is scheduled for. */
  activeDate: string | null;
}

/** The Daily Question as the dashboard card renders it (fully serializable). */
export interface DailyQuestionView {
  id: string;
  ordinal: number;
  questionText: string;
  choices: { key: string; text: string }[];
  conceptTag: string;
  conceptLabel: string;
  difficulty: number;
  /** True once this student has answered today's question. */
  answered: boolean;
  selectedChoice: string | null;
  isCorrect: boolean | null;
  /** Revealed only after answering. */
  correctAnswer: string | null;
  explanation: string | null;
  /** Epoch-ms of the next UTC midnight — the client ticks a countdown to it. */
  nextResetAt: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC day number since the epoch (stable rotation key). */
function utcDayNumber(now: number): number {
  return Math.floor(now / DAY_MS);
}

/** Today's date as YYYY-MM-DD (UTC), matching the rest of the app. */
function todayUtcIso(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** Epoch-ms of the next UTC midnight (when tomorrow's question goes live). */
export function nextResetAt(now: number = Date.now()): number {
  return (utcDayNumber(now) + 1) * DAY_MS;
}

/** Turn a snake_case concept tag into a Title Case label for the pill. */
export function conceptLabel(tag: string): string {
  const overrides: Record<string, string> = {
    gdp: "GDP",
    war: "WAR",
    mle: "Mid-Level Exception",
    pick_value_decay: "Pick Value",
  };
  if (overrides[tag]) return overrides[tag];
  return tag
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/* ============================================================
 * Seed bank — 60 questions.
 *  Difficulty spread: 30 × d1, 20 × d2, 10 × d3.
 *  Eight questions involve real math (the explanation shows the work).
 *  Every BOW concept is covered at least twice.
 *  Reading level: 5th–8th grade, short sentences, real sports examples.
 * ============================================================ */
export const DAILY_QUESTIONS: DailyQuestion[] = [
  {
    id: "dq-001", ordinal: 1, difficulty: 1, conceptTag: "opportunity_cost", activeDate: null,
    questionText:
      "You have $10M in cap space. You can sign a backup point guard or a backup shooting guard — not both. You pick the point guard. What is the opportunity cost?",
    choiceA: "The $10M you spent",
    choiceB: "The shooting guard you didn't sign",
    choiceC: "The point guard's salary",
    choiceD: "Nothing — you got what you wanted",
    correctAnswer: "B",
    explanation:
      "Opportunity cost is what you give up when you make a choice. By picking the point guard, you gave up the shooting guard. Every cap decision has an opportunity cost.",
  },
  {
    id: "dq-002", ordinal: 2, difficulty: 1, conceptTag: "scarcity", activeDate: null,
    questionText:
      "There are 30 GM jobs in the NBA and thousands of people who want one. What economic concept explains why these jobs are so hard to get?",
    choiceA: "Inflation",
    choiceB: "Revenue sharing",
    choiceC: "Scarcity",
    choiceD: "The luxury tax",
    correctAnswer: "C",
    explanation:
      "Scarcity means there isn't enough of something for everyone who wants it. When something is scarce, competition is fierce. GM jobs are scarce — so the bar to get one is extremely high.",
  },
  {
    id: "dq-003", ordinal: 3, difficulty: 1, conceptTag: "demand", activeDate: null,
    questionText:
      "A team raises ticket prices from $100 to $150. Attendance drops by 15%. What does this illustrate?",
    choiceA: "The law of supply",
    choiceB: "Revenue sharing",
    choiceC: "The law of demand",
    choiceD: "Inflation",
    correctAnswer: "C",
    explanation:
      "The law of demand says when price goes up, quantity demanded goes down. Fans responded to higher prices by buying fewer tickets. This is one of the most reliable patterns in economics.",
  },
  {
    id: "dq-004", ordinal: 4, difficulty: 1, conceptTag: "salary_cap", activeDate: null,
    questionText: "The NBA salary cap is calculated as:",
    choiceA: "Whatever each team wants to spend",
    choiceB: "A fixed number set by the commissioner every decade",
    choiceC: "A percentage of total league revenue divided among all teams",
    choiceD: "The average of the top five teams' payrolls",
    correctAnswer: "C",
    explanation:
      "The cap is tied directly to league revenue — called Basketball Related Income. When the league makes more money (like from a bigger TV deal), the cap goes up for every team.",
  },
  {
    id: "dq-005", ordinal: 5, difficulty: 1, conceptTag: "incentives", activeDate: null,
    questionText:
      "A player has one year left on his contract and is playing the best basketball of his career. A teammate with five years guaranteed is coasting. What economic concept explains the difference?",
    choiceA: "Scarcity",
    choiceB: "Incentives",
    choiceC: "Revenue sharing",
    choiceD: "Surplus value",
    correctAnswer: "B",
    explanation:
      "Incentives are reasons to act a certain way. One year left = major financial incentive to perform. Five years guaranteed = less pressure. Smart contracts align incentives across the full term.",
  },
  {
    id: "dq-006", ordinal: 6, difficulty: 2, conceptTag: "luxury_tax", activeDate: null,
    questionText:
      "A team is $10M over the luxury tax line. The tax rate for the first $5M over is $1.50 per dollar and $1.75 per dollar for the next $5M. How much do they owe in luxury tax?",
    choiceA: "$10M",
    choiceB: "$16.25M",
    choiceC: "$15M",
    choiceD: "$8.75M",
    correctAnswer: "B",
    explanation:
      "First $5M: 5 × $1.50 = $7.50M. Next $5M: 5 × $1.75 = $8.75M. Total: $16.25M. The progressive structure means going deeper in the tax costs exponentially more — by design.",
  },
  {
    id: "dq-007", ordinal: 7, difficulty: 1, conceptTag: "bird_rights", activeDate: null,
    questionText: "Bird Rights let a team:",
    choiceA: "Draft any player they want",
    choiceB: "Sign their own free agent over the salary cap",
    choiceC: "Avoid the luxury tax",
    choiceD: "Trade without cap implications",
    correctAnswer: "B",
    explanation:
      "Bird Rights are earned after a player spends three years with the same team. They let the team re-sign him even if it means going over the cap — so teams can keep players they developed.",
  },
  {
    id: "dq-008", ordinal: 8, difficulty: 2, conceptTag: "surplus_value", activeDate: null,
    questionText:
      "A rookie drafted 5th overall is paid $8M per year but plays like a $25M player. What is his annual surplus value?",
    choiceA: "$8M",
    choiceB: "$33M",
    choiceC: "$17M",
    choiceD: "$25M",
    correctAnswer: "C",
    explanation:
      "Surplus value = market value minus actual salary. $25M − $8M = $17M per year. That gap is why teams that draft stars get a massive competitive advantage — they're getting elite production at a steep discount.",
  },
  {
    id: "dq-009", ordinal: 9, difficulty: 1, conceptTag: "revenue_sharing", activeDate: null,
    questionText: "Revenue sharing in the NBA means:",
    choiceA: "Players share revenue with coaches",
    choiceB: "Large-market teams share some revenue with small-market teams",
    choiceC: "Teams split gate revenue 50/50 with the league",
    choiceD: "All teams pay equal amounts into a central fund",
    correctAnswer: "B",
    explanation:
      "The Lakers and Knicks generate far more local revenue than small-market teams. Revenue sharing redistributes some of that money so small-market franchises can stay competitive. Without it, the economic gap between markets would be much larger.",
  },
  {
    id: "dq-010", ordinal: 10, difficulty: 2, conceptTag: "analytics", activeDate: null,
    questionText:
      "A player averages 12 points per game (below average by traditional stats) but has the league's 3rd-best defensive rating and a top-10 WAR. He is most likely:",
    choiceA: "Overpaid",
    choiceB: "A bad player",
    choiceC: "Undervalued because his impact doesn't show in basic stats",
    choiceD: "A good candidate to be cut",
    correctAnswer: "C",
    explanation:
      "Traditional stats miss most of what makes a player valuable — defense, off-ball movement, spacing. Advanced metrics like WAR capture that hidden value. Players like this are underpriced because most GMs still lean on basic stats.",
  },
  {
    id: "dq-011", ordinal: 11, difficulty: 1, conceptTag: "market_size", activeDate: null,
    questionText:
      "Why can the New York Knicks earn far more local TV money than the Memphis Grizzlies?",
    choiceA: "The Knicks are a better team",
    choiceB: "New York is a much bigger media market",
    choiceC: "Memphis chooses not to sell its TV rights",
    choiceD: "The NBA forces it",
    correctAnswer: "B",
    explanation:
      "Market size is the number of fans and businesses a team can reach. New York has millions more potential viewers than Memphis, so its local TV deals are worth far more. Market size shapes how much money a team makes before it ever plays a game.",
  },
  {
    id: "dq-012", ordinal: 12, difficulty: 1, conceptTag: "inflation", activeDate: null,
    questionText:
      "In 2000 a hot dog at the ballpark cost $3. Today a similar hot dog costs $6. The hot dog isn't any better. What best explains the price increase?",
    choiceA: "Scarcity",
    choiceB: "Inflation",
    choiceC: "The luxury tax",
    choiceD: "Surplus value",
    correctAnswer: "B",
    explanation:
      "Inflation is the general rise in prices over time. The same hot dog costs more dollars today because each dollar buys less than it used to. Inflation is why prices and salaries from different decades can't be compared directly.",
  },
  {
    id: "dq-013", ordinal: 13, difficulty: 1, conceptTag: "gdp", activeDate: null,
    questionText:
      "GDP measures the total value of all goods and services a country produces in a year. If you wanted one number to describe how big a country's whole economy is, which would you use?",
    choiceA: "The inflation rate",
    choiceB: "The unemployment rate",
    choiceC: "GDP",
    choiceD: "The federal funds rate",
    correctAnswer: "C",
    explanation:
      "GDP — Gross Domestic Product — adds up everything an economy produces in a year. It's the most common measure of an economy's size. When GDP grows, the economy is producing more; when it shrinks, the economy is contracting.",
  },
  {
    id: "dq-014", ordinal: 14, difficulty: 1, conceptTag: "fiscal_policy", activeDate: null,
    questionText:
      "When a government changes its spending or taxes to influence the economy, what is that called?",
    choiceA: "Monetary policy",
    choiceB: "Fiscal policy",
    choiceC: "Revenue sharing",
    choiceD: "Inflation",
    correctAnswer: "B",
    explanation:
      "Fiscal policy is the government using taxes and spending to steer the economy. Cutting taxes or spending more can speed it up; raising taxes or spending less can slow it down. It's one of two main tools, alongside monetary policy.",
  },
  {
    id: "dq-015", ordinal: 15, difficulty: 1, conceptTag: "market_structures", activeDate: null,
    questionText:
      "Your city has only one pro hockey team, and the next nearest team is 300 miles away. Fans who want live pro hockey have nowhere else to go. What market structure is this?",
    choiceA: "Perfect competition",
    choiceB: "Monopoly",
    choiceC: "Oligopoly",
    choiceD: "A free market",
    correctAnswer: "B",
    explanation:
      "A monopoly is when one seller controls a market with no close competition. With no other local team, fans can't shop around, so the team has pricing power. Monopolies can charge more than they could if rivals existed.",
  },
  {
    id: "dq-016", ordinal: 16, difficulty: 2, conceptTag: "opportunity_cost", activeDate: null,
    questionText:
      "Your team can spend its $20M in cap space on one veteran star OR two role players. The star adds 7 wins. The two role players would have added 12 wins together. You sign the star. What did the choice cost you?",
    choiceA: "$20M",
    choiceB: "7 wins",
    choiceC: "5 wins of value you gave up",
    choiceD: "Nothing",
    correctAnswer: "C",
    explanation:
      "Opportunity cost is the value of the best option you passed up. The role players would have added 12 wins; the star adds 7. By choosing the star you gave up 12 − 7 = 5 wins of value. Naming what you gave up keeps decisions honest.",
  },
  {
    id: "dq-017", ordinal: 17, difficulty: 2, conceptTag: "demand", activeDate: null,
    questionText:
      "A team raises parking from $20 to $30 and almost no one stops driving to games. It raises hot dog prices from $5 to $7 and sales fall by half. Why the difference?",
    choiceA: "Parking is inelastic; hot dogs are elastic",
    choiceB: "Hot dogs are inelastic; parking is elastic",
    choiceC: "Both are elastic",
    choiceD: "Prices don't affect demand",
    correctAnswer: "A",
    explanation:
      "Elasticity measures how much demand changes when price changes. Fans need parking and have few alternatives (inelastic), so they keep paying. They can easily skip a hot dog (elastic), so sales drop. Smart teams raise prices most on the inelastic stuff.",
  },
  {
    id: "dq-018", ordinal: 18, difficulty: 1, conceptTag: "incentives", activeDate: null,
    questionText:
      "A team offers a bonus to any player who makes the All-Star team. Suddenly players are putting in extra practice. What economic idea is at work?",
    choiceA: "Scarcity",
    choiceB: "Incentives",
    choiceC: "Inflation",
    choiceD: "Revenue sharing",
    correctAnswer: "B",
    explanation:
      "Incentives are rewards or penalties that change behavior. The bonus gives players a clear reason to work harder. Front offices design contracts full of incentives to line up a player's goals with the team's.",
  },
  {
    id: "dq-019", ordinal: 19, difficulty: 2, conceptTag: "luxury_tax", activeDate: null,
    questionText:
      "A team's payroll is $8M over the luxury tax line. The tax is a flat $1.50 per dollar over the line. How much is their tax bill?",
    choiceA: "$8M",
    choiceB: "$12M",
    choiceC: "$1.5M",
    choiceD: "$9.5M",
    correctAnswer: "B",
    explanation:
      "Tax = amount over the line × rate = $8M × 1.50 = $12M. The luxury tax is a penalty on high-spending teams, charged on top of the salaries themselves — so going over costs far more than the contracts alone.",
  },
  {
    id: "dq-020", ordinal: 20, difficulty: 1, conceptTag: "bird_rights", activeDate: null,
    questionText:
      "A player has been with the same team for four straight seasons. The team is over the cap but wants to re-sign him. What lets them do it?",
    choiceA: "The luxury tax",
    choiceB: "Bird Rights",
    choiceC: "Revenue sharing",
    choiceD: "The draft",
    correctAnswer: "B",
    explanation:
      "Bird Rights let a team exceed the salary cap to re-sign its own veteran free agent after he's been with the team for three seasons. They exist so teams can keep the players they drafted and developed.",
  },
  {
    id: "dq-021", ordinal: 21, difficulty: 1, conceptTag: "mle", activeDate: null,
    questionText:
      "A team is over the salary cap but wants to sign a free agent from another team. Which tool is built exactly for that?",
    choiceA: "Bird Rights",
    choiceB: "The Mid-Level Exception",
    choiceC: "The draft",
    choiceD: "Revenue sharing",
    correctAnswer: "B",
    explanation:
      "The Mid-Level Exception (MLE) lets a capped-out team sign an outside free agent for a set, league-determined amount. It's one of the few ways to add outside talent without cap space — a key tool for contenders.",
  },
  {
    id: "dq-022", ordinal: 22, difficulty: 2, conceptTag: "surplus_value", activeDate: null,
    questionText:
      "A player produces like he's worth $30M a year. He's on a contract paying $12M. What's his surplus value per season?",
    choiceA: "$42M",
    choiceB: "$18M",
    choiceC: "$12M",
    choiceD: "$30M",
    correctAnswer: "B",
    explanation:
      "Surplus value = market value − salary = $30M − $12M = $18M. Every dollar of surplus value is production a team gets essentially for free, which is why cheap, productive contracts are so prized.",
  },
  {
    id: "dq-023", ordinal: 23, difficulty: 2, conceptTag: "revenue_sharing", activeDate: null,
    questionText:
      "A small-market team makes far less local revenue than a big-market team, yet still fields a competitive roster partly thanks to checks from the league's shared revenue pool. What is this system?",
    choiceA: "The luxury tax",
    choiceB: "Revenue sharing",
    choiceC: "Bird Rights",
    choiceD: "Fiscal policy",
    correctAnswer: "B",
    explanation:
      "Revenue sharing pools some league income and redistributes it, sending more to smaller-market teams. It keeps small markets financially viable so the whole league stays competitive.",
  },
  {
    id: "dq-024", ordinal: 24, difficulty: 3, conceptTag: "war", activeDate: null,
    questionText:
      "Player A scores 25 points a game but his team is much worse when he's on the floor. Player B scores 11, but his team outscores opponents by 10 points per 100 possessions when he plays. Which player likely has the higher WAR, and why?",
    choiceA: "Player A, because points matter most",
    choiceB: "Player B, because his overall impact is bigger even if his scoring is low",
    choiceC: "They're equal",
    choiceD: "You can't tell from this",
    correctAnswer: "B",
    explanation:
      "WAR — Wins Above Replacement — estimates total contribution to winning, not just scoring. Player B's team plays far better with him on the court, so his all-around impact (defense, passing, spacing) likely gives him the higher WAR. Points alone can mislead.",
  },
  {
    id: "dq-025", ordinal: 25, difficulty: 1, conceptTag: "war", activeDate: null,
    questionText: "What does the stat WAR try to capture?",
    choiceA: "A player's points per game",
    choiceB: "How many wins a player adds compared to a replacement-level player",
    choiceC: "A player's salary",
    choiceD: "A team's total revenue",
    correctAnswer: "B",
    explanation:
      "WAR stands for Wins Above Replacement. It estimates how many extra wins a player provides versus a freely available 'replacement' player. It rolls many skills into one number so you can compare very different players.",
  },
  {
    id: "dq-026", ordinal: 26, difficulty: 2, conceptTag: "roster_windows", activeDate: null,
    questionText:
      "Your core stars are all 27–29 years old, healthy, and signed for three more years. Analysts say your 'window' is open. What does that mean?",
    choiceA: "You should rebuild now",
    choiceB: "You have a limited stretch where this roster can realistically win a title",
    choiceC: "Your arena lease is expiring",
    choiceD: "Your TV deal is ending",
    correctAnswer: "B",
    explanation:
      "A roster window is the limited period when a team is good enough to truly contend — usually set by its stars' prime years and contracts. Windows close as players age or get expensive, so front offices push hardest while the window is open.",
  },
  {
    id: "dq-027", ordinal: 27, difficulty: 3, conceptTag: "pick_value_decay", activeDate: null,
    questionText:
      "A pick projected to land at #2 overall is worth far more than one at #20, and a pick three years away is worth less than the same pick this year. What two ideas explain this?",
    choiceA: "Inflation and scarcity",
    choiceB: "Pick value by slot, and the time value of picks (discounting future picks)",
    choiceC: "Bird Rights and the MLE",
    choiceD: "Revenue sharing and market size",
    correctAnswer: "B",
    explanation:
      "Higher picks are worth more because better players are available early (value falls as the slot number rises). And a pick years away is worth less today because it's uncertain and far off — like money, future picks are 'discounted.' Both shape every trade.",
  },
  {
    id: "dq-028", ordinal: 28, difficulty: 3, conceptTag: "fiscal_policy", activeDate: null,
    questionText:
      "During a recession, a government cuts taxes and boosts spending on building projects, including a new public sports complex, to get people working again. What kind of fiscal policy is this?",
    choiceA: "Contractionary",
    choiceB: "Expansionary",
    choiceC: "Monetary",
    choiceD: "Neutral",
    correctAnswer: "B",
    explanation:
      "Expansionary fiscal policy means cutting taxes and/or raising spending to speed up a slow economy. The goal is to put more money in people's hands and create jobs. The opposite — raising taxes or cutting spending to cool things down — is contractionary.",
  },
  {
    id: "dq-029", ordinal: 29, difficulty: 2, conceptTag: "gdp", activeDate: null,
    questionText:
      "A new stadium project employs thousands of workers, who spend their paychecks at local shops, which hire more staff. Each dollar spent creates more economic activity. What is this ripple effect called?",
    choiceA: "Inflation",
    choiceB: "The multiplier effect",
    choiceC: "Revenue sharing",
    choiceD: "Surplus value",
    correctAnswer: "B",
    explanation:
      "The multiplier effect describes how one dollar of spending circulates and generates more than a dollar of total activity (which shows up in GDP). Teams use it to argue cities should help fund stadiums — though economists debate how big the real effect is.",
  },
  {
    id: "dq-030", ordinal: 30, difficulty: 1, conceptTag: "salary_cap", activeDate: null,
    questionText: "A 'soft' salary cap means:",
    choiceA: "Teams can never go over it",
    choiceB: "Teams can go over it, but only by using specific exceptions",
    choiceC: "There is no cap at all",
    choiceD: "The cap changes every game",
    correctAnswer: "B",
    explanation:
      "A soft cap sets a spending limit but allows teams to exceed it through exceptions like Bird Rights or the MLE. A hard cap, by contrast, is a firm ceiling no team can cross. The NBA uses a soft cap with a hard ceiling (the 'apron') above it.",
  },
  {
    id: "dq-031", ordinal: 31, difficulty: 1, conceptTag: "opportunity_cost", activeDate: null,
    questionText:
      "You spend your one first-round pick on a quarterback, so you can't use it on the elite pass rusher who was also available. The pass rusher is your:",
    choiceA: "Sunk cost",
    choiceB: "Opportunity cost",
    choiceC: "Surplus value",
    choiceD: "Salary cap hit",
    correctAnswer: "B",
    explanation:
      "Opportunity cost is the best alternative you give up. Using the pick on the quarterback means losing the pass rusher. With only one pick, every selection has a real opportunity cost.",
  },
  {
    id: "dq-032", ordinal: 32, difficulty: 1, conceptTag: "scarcity", activeDate: null,
    questionText:
      "Only one player each year can be named MVP. Why does that make the award so valuable to sponsors and fans?",
    choiceA: "Because it's scarce — there can only be one",
    choiceB: "Because of inflation",
    choiceC: "Because of revenue sharing",
    choiceD: "Because of the luxury tax",
    correctAnswer: "A",
    explanation:
      "Scarcity creates value. Because only one MVP exists each season, the title is rare and therefore prized. The same logic explains why championships and Hall-of-Fame spots carry so much weight.",
  },
  {
    id: "dq-033", ordinal: 33, difficulty: 1, conceptTag: "demand", activeDate: null,
    questionText:
      "A team makes the playoffs for the first time in years. Suddenly ticket prices on the resale market shoot up. Why?",
    choiceA: "Supply increased",
    choiceB: "Demand jumped while the number of seats stayed fixed",
    choiceC: "Inflation",
    choiceD: "The salary cap rose",
    correctAnswer: "B",
    explanation:
      "When more people want tickets but the arena still has the same number of seats, higher demand against fixed supply pushes prices up. Winning raises demand, and prices follow.",
  },
  {
    id: "dq-034", ordinal: 34, difficulty: 2, conceptTag: "market_structures", activeDate: null,
    questionText:
      "Four giant TV networks control almost all the bidding for a league's broadcast rights. No single one dominates, but together they shape the market. What structure is this?",
    choiceA: "Monopoly",
    choiceB: "Perfect competition",
    choiceC: "Oligopoly",
    choiceD: "A public good",
    correctAnswer: "C",
    explanation:
      "An oligopoly is a market dominated by a few large players. With only a handful of networks bidding, each has real power, and their choices heavily influence the price of media rights.",
  },
  {
    id: "dq-035", ordinal: 35, difficulty: 1, conceptTag: "inflation", activeDate: null,
    questionText:
      "Player salaries from the 1990s look tiny compared to today's. Before saying today's players are 'overpaid,' an economist would first:",
    choiceA: "Ignore it",
    choiceB: "Adjust the old salaries for inflation",
    choiceC: "Check the luxury tax",
    choiceD: "Look at GDP",
    correctAnswer: "B",
    explanation:
      "Because inflation makes a dollar worth less over time, comparing salaries across decades requires adjusting old figures into today's dollars. Only then is the comparison fair.",
  },
  {
    id: "dq-036", ordinal: 36, difficulty: 2, conceptTag: "market_size", activeDate: null,
    questionText:
      "A league lets teams keep most of their LOCAL TV money. How does this affect big-market vs. small-market teams?",
    choiceA: "It makes them equal",
    choiceB: "It widens the gap, since big markets earn far more locally",
    choiceC: "It only affects ticket prices",
    choiceD: "It has no effect",
    correctAnswer: "B",
    explanation:
      "When local TV money isn't shared, big-market teams in cities with millions of viewers pull far ahead financially. Market size becomes a built-in advantage — which is exactly why leagues add revenue sharing to push back.",
  },
  {
    id: "dq-037", ordinal: 37, difficulty: 2, conceptTag: "mle", activeDate: null,
    questionText:
      "The Mid-Level Exception this season is worth about $12M over three years, paid evenly. Roughly how much can a capped-out team offer per year using it?",
    choiceA: "$12M",
    choiceB: "$3M",
    choiceC: "$4M",
    choiceD: "$6M",
    correctAnswer: "C",
    explanation:
      "$12M ÷ 3 years = $4M per year. The MLE is a fixed, league-set amount, so teams over the cap know exactly how much outside spending power they have. It's often the difference-maker in free agency for contenders.",
  },
  {
    id: "dq-038", ordinal: 38, difficulty: 3, conceptTag: "luxury_tax", activeDate: null,
    questionText:
      "Two teams each go $5M over the tax line. Team A has paid the tax three years in a row; Team B is over for the first time. Team A's bill is much higher for the same overage. Why?",
    choiceA: "A math error",
    choiceB: "The 'repeater' tax — habitual spenders pay higher rates",
    choiceC: "Revenue sharing",
    choiceD: "Inflation",
    correctAnswer: "B",
    explanation:
      "The luxury tax has a 'repeater' penalty: teams that pay it in multiple consecutive years face steeper rates. The system is designed to punish teams that live above the line year after year, not just go over once.",
  },
  {
    id: "dq-039", ordinal: 39, difficulty: 1, conceptTag: "bird_rights", activeDate: null,
    questionText: "Bird Rights, named after Larry Bird, reward teams for:",
    choiceA: "Winning titles",
    choiceB: "Keeping a player long enough to re-sign him over the cap",
    choiceC: "Drafting well",
    choiceD: "Selling out their arena",
    correctAnswer: "B",
    explanation:
      "Bird Rights let a team exceed the cap to retain its own free agent after three seasons together. They reward continuity — keeping and re-signing the players a franchise developed.",
  },
  {
    id: "dq-040", ordinal: 40, difficulty: 3, conceptTag: "surplus_value", activeDate: null,
    questionText:
      "A rookie on a $5M deal plays like a $22M player. A veteran on a $28M deal plays like a $24M player. Which contract has positive surplus value, and how much?",
    choiceA: "The veteran, +$4M",
    choiceB: "The rookie, +$17M",
    choiceC: "Both are equal",
    choiceD: "Neither",
    correctAnswer: "B",
    explanation:
      "Surplus value = production value − salary. Rookie: $22M − $5M = +$17M (positive). Veteran: $24M − $28M = −$4M (negative). The rookie deal is a bargain; the veteran is slightly overpaid. Cheap production is how teams win the math.",
  },
  {
    id: "dq-041", ordinal: 41, difficulty: 2, conceptTag: "revenue_sharing", activeDate: null,
    questionText:
      "Critics say heavy revenue sharing can reduce a small-market team's reason to improve, since it gets paid either way. This worry is an example of:",
    choiceA: "Inflation",
    choiceB: "A possible downside of revenue sharing (weakened incentives)",
    choiceC: "Scarcity",
    choiceD: "The multiplier effect",
    correctAnswer: "B",
    explanation:
      "Revenue sharing keeps small markets afloat, but if a team profits whether it wins or not, the incentive to invest in winning can weaken. Leagues try to design sharing rules that help small markets without rewarding complacency.",
  },
  {
    id: "dq-042", ordinal: 42, difficulty: 1, conceptTag: "analytics", activeDate: null,
    questionText:
      "A front office hires a group of statisticians to find players whose value isn't obvious from basic stats. This approach is generally called:",
    choiceA: "Scouting by eye only",
    choiceB: "Analytics",
    choiceC: "Revenue sharing",
    choiceD: "Fiscal policy",
    correctAnswer: "B",
    explanation:
      "Analytics is using data and advanced statistics to make better decisions. Teams use it to spot undervalued players, optimize lineups, and avoid overpaying — turning hidden information into a competitive edge.",
  },
  {
    id: "dq-043", ordinal: 43, difficulty: 3, conceptTag: "analytics", activeDate: null,
    questionText:
      "A few smart teams start valuing three-point shooting before the rest of the league catches on, signing great shooters cheaply. Within a few years everyone copies them and those shooters get expensive. What happened?",
    choiceA: "Inflation erased the edge",
    choiceB: "A market inefficiency was found and then closed as others copied it",
    choiceC: "Revenue sharing",
    choiceD: "The luxury tax",
    correctAnswer: "B",
    explanation:
      "A market inefficiency is a gap between a player's price and his true value. Early movers exploited undervalued shooting, but as rivals copied the insight, demand rose and prices corrected — the inefficiency closed. Edges in analytics are real but temporary.",
  },
  {
    id: "dq-044", ordinal: 44, difficulty: 2, conceptTag: "roster_windows", activeDate: null,
    questionText:
      "A team's stars are aging and their contracts are getting expensive, but it trades away future picks to add win-now veterans. What is it betting on?",
    choiceA: "That its window is closing and it must win now",
    choiceB: "That it is rebuilding",
    choiceC: "Revenue sharing",
    choiceD: "Inflation",
    correctAnswer: "A",
    explanation:
      "Trading future assets for immediate help is a 'win-now' move that makes sense when a roster window is closing. The bet: cash in while the stars can still contend, because the chance may not come again.",
  },
  {
    id: "dq-045", ordinal: 45, difficulty: 3, conceptTag: "pick_value_decay", activeDate: null,
    questionText:
      "Using a common draft-value chart, the #1 pick is worth 3000 points and the #16 pick is worth 1000. A team trades the #1 pick for the #16 plus two picks worth 900 and 800. Did they get fair point value?",
    choiceA: "No, they lost 300 points",
    choiceB: "Yes — they got 2700 vs 3000, close but slightly under",
    choiceC: "Yes, they gained 600",
    choiceD: "You can't compare picks",
    correctAnswer: "B",
    explanation:
      "Add the received picks: 1000 + 900 + 800 = 2700, versus 3000 given up — slightly under fair value. Draft-value charts put numbers on how steeply pick value falls by slot, so front offices can compare lopsided trades.",
  },
  {
    id: "dq-046", ordinal: 46, difficulty: 1, conceptTag: "gdp", activeDate: null,
    questionText: "If a country's GDP grows 3% in a year, it means:",
    choiceA: "Prices rose 3%",
    choiceB: "The economy produced about 3% more goods and services",
    choiceC: "Unemployment fell 3%",
    choiceD: "The stock market rose 3%",
    correctAnswer: "B",
    explanation:
      "GDP growth measures how much more an economy produced than the year before. 3% growth means roughly 3% more total output. It's the headline number for whether an economy is expanding or shrinking.",
  },
  {
    id: "dq-047", ordinal: 47, difficulty: 1, conceptTag: "fiscal_policy", activeDate: null,
    questionText:
      "A city council votes to raise local taxes to fund new schools and roads. This decision is an example of:",
    choiceA: "Monetary policy",
    choiceB: "Fiscal policy",
    choiceC: "Revenue sharing",
    choiceD: "The luxury tax",
    correctAnswer: "B",
    explanation:
      "Fiscal policy is government decisions about taxing and spending. Raising taxes to pay for public projects is a classic fiscal-policy move. (Monetary policy, by contrast, is about interest rates and the money supply.)",
  },
  {
    id: "dq-048", ordinal: 48, difficulty: 2, conceptTag: "incentives", activeDate: null,
    questionText:
      "A contract pays a player a huge bonus only if he plays at least 65 games. Late in a meaningless season, he pushes to suit up despite a minor injury. The bonus changed his behavior — this shows:",
    choiceA: "Incentives can have unintended effects",
    choiceB: "Scarcity",
    choiceC: "Inflation",
    choiceD: "Revenue sharing",
    correctAnswer: "A",
    explanation:
      "Incentives shape behavior — sometimes in ways you didn't intend. A games-played bonus can push a player to risk his health for the threshold. Front offices must design incentives carefully so they encourage the right actions.",
  },
  {
    id: "dq-049", ordinal: 49, difficulty: 1, conceptTag: "scarcity", activeDate: null,
    questionText:
      "A franchise has just 15 roster spots but 30 talented players in camp. Coaches must make cuts. This tough decision exists because of:",
    choiceA: "Inflation",
    choiceB: "Scarcity of roster spots",
    choiceC: "Revenue sharing",
    choiceD: "The multiplier effect",
    correctAnswer: "B",
    explanation:
      "Scarcity means limited resources against unlimited wants. With only 15 spots and more deserving players than openings, the team is forced to choose. Scarcity is what makes every roster decision a trade-off.",
  },
  {
    id: "dq-050", ordinal: 50, difficulty: 2, conceptTag: "demand", activeDate: null,
    questionText:
      "A team finds that lowering ticket prices 10% increases attendance enough that TOTAL ticket revenue actually rises. This tells you demand for those tickets was:",
    choiceA: "Inelastic",
    choiceB: "Elastic",
    choiceC: "Fixed",
    choiceD: "Zero",
    correctAnswer: "B",
    explanation:
      "When a price cut raises total revenue, demand is elastic — fans are very responsive to price. Lower prices brought in enough extra buyers to more than make up for the lower price each. Pricing teams study elasticity to find the revenue sweet spot.",
  },
  {
    id: "dq-051", ordinal: 51, difficulty: 1, conceptTag: "salary_cap", activeDate: null,
    questionText: "The salary cap exists mainly to:",
    choiceA: "Make owners richer",
    choiceB: "Keep competition balanced by limiting how much any one team can spend",
    choiceC: "Lower ticket prices",
    choiceD: "Pay for stadiums",
    correctAnswer: "B",
    explanation:
      "A salary cap limits team payrolls so wealthy teams can't simply buy every star. The goal is competitive balance — giving more teams a realistic shot and keeping the league's games meaningful.",
  },
  {
    id: "dq-052", ordinal: 52, difficulty: 1, conceptTag: "market_size", activeDate: null,
    questionText: "Market size in sports business mainly refers to:",
    choiceA: "The size of the stadium",
    choiceB: "The number of fans and businesses a team can reach",
    choiceC: "The number of players on the roster",
    choiceD: "The team's total payroll",
    correctAnswer: "B",
    explanation:
      "Market size is the reach of a team's potential audience — population, wealth, and businesses in its region. Bigger markets mean more ticket buyers, viewers, and sponsors, which translates into more revenue.",
  },
  {
    id: "dq-053", ordinal: 53, difficulty: 2, conceptTag: "luxury_tax", activeDate: null,
    questionText:
      "A contending team is $1M under the tax line and can add a useful veteran for $3M. Going over would trigger a tax bill plus stricter roster rules, so the front office hesitates. This hesitation shows the tax acts as:",
    choiceA: "A reward for spending",
    choiceB: "A deterrent that raises the true cost of adding salary",
    choiceC: "Revenue sharing",
    choiceD: "A draft pick",
    correctAnswer: "B",
    explanation:
      "The luxury tax makes each dollar of payroll above the line cost extra, so the 'real' price of that $3M veteran is much higher once tax is added. That's the point: it deters spending and nudges teams toward restraint.",
  },
  {
    id: "dq-054", ordinal: 54, difficulty: 3, conceptTag: "war", activeDate: null,
    questionText:
      "An analyst notices two different websites list slightly different WAR values for the same player. Why can that happen?",
    choiceA: "One site is lying",
    choiceB: "WAR is an estimate built from models, and different models weigh skills differently",
    choiceC: "The player changed teams",
    choiceD: "Inflation",
    correctAnswer: "B",
    explanation:
      "WAR isn't a single official number — it's an estimate produced by statistical models, and different models make different assumptions about defense, position, and value. Treat WAR as a strong guide, not an exact truth.",
  },
  {
    id: "dq-055", ordinal: 55, difficulty: 1, conceptTag: "surplus_value", activeDate: null,
    questionText: "Why is finding surplus value especially important for a SMALL-market team?",
    choiceA: "It isn't important for them",
    choiceB: "With less money to spend, getting extra production per dollar is how they keep up with richer teams",
    choiceC: "They don't use contracts",
    choiceD: "They ignore analytics",
    correctAnswer: "B",
    explanation:
      "Small-market teams can't outspend the giants, so they must out-value them — squeezing more production from every dollar through smart drafting and bargain contracts. Surplus value is the great equalizer for teams with smaller budgets.",
  },
  {
    id: "dq-056", ordinal: 56, difficulty: 2, conceptTag: "bird_rights", activeDate: null,
    questionText:
      "A team lets a homegrown star leave in free agency even though Bird Rights would let it pay him the most. What's the most likely reason a front office would do this?",
    choiceA: "They forgot about Bird Rights",
    choiceB: "They judged the long-term cost (salary plus luxury tax) wasn't worth the production",
    choiceC: "Bird Rights are illegal",
    choiceD: "The player demanded less money",
    correctAnswer: "B",
    explanation:
      "Bird Rights let you pay your own star the most — but 'can' isn't 'should.' If the total cost, including a rising luxury-tax bill, outweighs the wins he'd add, a disciplined front office may let him walk. Every right still has a cost.",
  },
  {
    id: "dq-057", ordinal: 57, difficulty: 1, conceptTag: "revenue_sharing", activeDate: null,
    questionText: "Revenue sharing is best described as a tool to promote:",
    choiceA: "Higher ticket prices",
    choiceB: "Competitive balance across markets",
    choiceC: "Bigger player contracts",
    choiceD: "Lower GDP",
    correctAnswer: "B",
    explanation:
      "Revenue sharing moves money from richer to poorer franchises so small markets can stay competitive. Like the salary cap, its core aim is competitive balance — keeping the whole league healthy, not just the big-city teams.",
  },
  {
    id: "dq-058", ordinal: 58, difficulty: 2, conceptTag: "gdp", activeDate: null,
    questionText:
      "A national recession hits. Even good teams see season-ticket renewals drop and sponsors cut budgets. This shows that a league's business is tied to:",
    choiceA: "Only its own decisions",
    choiceB: "The broader economy (the business cycle)",
    choiceC: "The salary cap",
    choiceD: "Bird Rights",
    correctAnswer: "B",
    explanation:
      "Leagues don't operate in a bubble. When the overall economy slows — falling GDP, rising unemployment — fans and sponsors spend less, and teams feel it. The business cycle of expansions and recessions reaches even pro sports.",
  },
  {
    id: "dq-059", ordinal: 59, difficulty: 3, conceptTag: "market_structures", activeDate: null,
    questionText:
      "A league grants each team an exclusive local territory, so no rival team can set up nearby. Economically, the league is handing each team a local:",
    choiceA: "Oligopoly",
    choiceB: "Monopoly",
    choiceC: "Public good",
    choiceD: "Surplus",
    correctAnswer: "B",
    explanation:
      "By blocking nearby competition, the league gives each team a local monopoly on its sport. That protected territory is part of why franchises are so valuable — and why ticket and concession prices can run high with no local rival to undercut them.",
  },
  {
    id: "dq-060", ordinal: 60, difficulty: 3, conceptTag: "opportunity_cost", activeDate: null,
    questionText:
      "A GM keeps an aging, expensive star out of loyalty instead of trading him for younger talent and picks. An economist would say the GM is ignoring:",
    choiceA: "The sunk cost",
    choiceB: "The opportunity cost of the assets he could have gotten instead",
    choiceC: "Revenue sharing",
    choiceD: "Inflation",
    correctAnswer: "B",
    explanation:
      "By holding the star, the GM gives up the young players and picks a trade would bring — that's the opportunity cost. Loyalty is admirable, but every roster spot and dollar tied up in one player is value not used elsewhere.",
  },
];

/* ============================================================
 * Read layer (server-only — these hit the database).
 * ============================================================ */

/* eslint-disable @typescript-eslint/no-explicit-any */

/** All daily questions, ordered (DB first, falling back to the seed bank). */
export function getDailyQuestions(): DailyQuestion[] {
  const rows = getDb().prepare("SELECT * FROM daily_questions ORDER BY ordinal ASC").all() as any[];
  if (rows.length === 0) return [...DAILY_QUESTIONS].sort((a, b) => a.ordinal - b.ordinal);
  return rows.map(rowToDailyQuestion);
}

function rowToDailyQuestion(r: any): DailyQuestion {
  return {
    id: r.id,
    ordinal: Number(r.ordinal) || 0,
    questionText: r.question_text,
    choiceA: r.choice_a,
    choiceB: r.choice_b,
    choiceC: r.choice_c,
    choiceD: r.choice_d,
    correctAnswer: String(r.correct_answer ?? "").toUpperCase(),
    explanation: r.explanation,
    conceptTag: r.concept_tag,
    difficulty: Number(r.difficulty) || 1,
    activeDate: r.active_date ?? null,
  };
}

/**
 * The question that is "live" right now. Prefers a question scheduled for
 * today's date; otherwise rotates by day number so there is always one.
 */
export function getActiveDailyQuestion(now: number = Date.now()): DailyQuestion | null {
  const all = getDailyQuestions();
  if (all.length === 0) return null;
  const today = todayUtcIso(now);
  const dated = all.find((q) => q.activeDate === today);
  if (dated) return dated;
  // Stable fallback: rotate by day number across the whole bank.
  return all[utcDayNumber(now) % all.length];
}

/** The student's stored response to a specific daily question, if any. */
export function getDailyResponse(
  studentId: string,
  questionId: string,
): { selectedChoice: string; isCorrect: boolean; respondedAt: number } | null {
  const r = getDb()
    .prepare("SELECT selected_choice, is_correct, responded_at FROM daily_responses WHERE student_id = ? AND question_id = ?")
    .get(studentId, questionId) as any;
  if (!r) return null;
  return {
    selectedChoice: String(r.selected_choice ?? "").toUpperCase(),
    isCorrect: Number(r.is_correct) === 1,
    respondedAt: Number(r.responded_at) || 0,
  };
}

/** Build the dashboard view of today's question for a student. */
export function getDailyQuestionView(studentId: string, now: number = Date.now()): DailyQuestionView | null {
  const q = getActiveDailyQuestion(now);
  if (!q) return null;
  const answer = getDailyResponse(studentId, q.id);
  const choices = [
    { key: "A", text: q.choiceA },
    { key: "B", text: q.choiceB },
    { key: "C", text: q.choiceC },
    { key: "D", text: q.choiceD },
  ];
  return {
    id: q.id,
    ordinal: q.ordinal,
    questionText: q.questionText,
    choices,
    conceptTag: q.conceptTag,
    conceptLabel: conceptLabel(q.conceptTag),
    difficulty: q.difficulty,
    answered: !!answer,
    selectedChoice: answer?.selectedChoice ?? null,
    isCorrect: answer ? answer.isCorrect : null,
    correctAnswer: answer ? q.correctAnswer : null,
    explanation: answer ? q.explanation : null,
    nextResetAt: nextResetAt(now),
  };
}

/** How many distinct students answered today's question (admin overview). */
export function countDailyAnswersToday(now: number = Date.now()): number {
  const q = getActiveDailyQuestion(now);
  if (!q) return 0;
  const row = getDb()
    .prepare("SELECT COUNT(*) AS n FROM daily_responses WHERE question_id = ?")
    .get(q.id) as any;
  return Number(row?.n) || 0;
}

/* eslint-enable @typescript-eslint/no-explicit-any */
