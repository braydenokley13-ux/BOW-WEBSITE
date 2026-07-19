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

/** How a question is answered: multiple choice, numeric, or free response. */
export type QuestionType = "mc" | "math" | "fr";

/** The three difficulty tiers, derived from the integer `difficulty` (1/2/3). */
export type DifficultyTier = "rookie" | "pro" | "executive";

/** One Daily Question (reference data). */
export interface DailyQuestion {
  id: string;
  /** Stable display/rotation order. */
  ordinal: number;
  questionText: string;
  /** How the student answers. MC uses the four choices; math/fr use a text input. */
  type: QuestionType;
  choiceA: string;
  choiceB: string;
  choiceC: string;
  choiceD: string;
  /** MC: the correct choice letter, "A".."D". math/fr: the expected answer text. */
  correctAnswer: string;
  explanation: string;
  /** snake_case BOW concept tag, e.g. "opportunity_cost". */
  conceptTag: string;
  /**
   * 1 = Rookie (recall), 2 = Pro (application), 3 = Executive (analysis).
   * The integer is canonical in storage; {@link difficultyTier} maps it to the
   * rookie/pro/executive labels the UI shows.
   */
  difficulty: number;
  /** Curriculum track this question belongs to: "101" or "201". */
  track: string;
  /** XP awarded for a correct answer (Rookie 10 / Pro 20 / Executive 35). */
  points: number;
  /** Admin can hide a question from rotation without deleting it. */
  active: boolean;
  /** Optional fixed calendar date (YYYY-MM-DD) this question is scheduled for. */
  activeDate: string | null;
}

/**
 * Seed-bank shape. `track`, `type`, and `points` are optional here so the
 * original 60 questions stay terse; {@link seedDefaults} fills them in.
 */
export type DailyQuestionSeed = Omit<DailyQuestion, "track" | "type" | "points" | "active"> & {
  track?: string;
  type?: QuestionType;
  points?: number;
};

/** The Daily Question as the dashboard card renders it (fully serializable). */
export interface DailyQuestionView {
  id: string;
  ordinal: number;
  questionText: string;
  type: QuestionType;
  choices: { key: string; text: string }[];
  conceptTag: string;
  conceptLabel: string;
  difficulty: number;
  /** rookie / pro / executive, derived from `difficulty`. */
  tier: DifficultyTier;
  /** Title-case tier label for the pill ("Rookie" / "Pro" / "Executive"). */
  tierLabel: string;
  /** Curriculum track ("101" / "201"). */
  track: string;
  /** XP a correct answer is worth. */
  points: number;
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

/** XP a correct answer is worth at each difficulty (Rookie/Pro/Executive). */
export function pointsForDifficulty(difficulty: number): number {
  if (difficulty >= 3) return 35;
  if (difficulty === 2) return 20;
  return 10;
}

/** Map the integer difficulty (1/2/3) to its tier key. */
export function difficultyTier(difficulty: number): DifficultyTier {
  if (difficulty >= 3) return "executive";
  if (difficulty === 2) return "pro";
  return "rookie";
}

/** Title-case label for a difficulty tier ("Rookie" / "Pro" / "Executive"). */
export function tierLabel(difficulty: number): string {
  const tier = difficultyTier(difficulty);
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

/** The integer difficulty for a tier key (inverse of {@link difficultyTier}). */
export function tierToDifficulty(tier: DifficultyTier): number {
  return tier === "executive" ? 3 : tier === "pro" ? 2 : 1;
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
export const DAILY_QUESTIONS: DailyQuestionSeed[] = [
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

  /* ============================================================
   * Deep-expansion bank — 30 questions across the track × difficulty
   * matrix. Track "101" = front-office mechanics; "201" = league
   * business. Difficulty 1/2/3 = Rookie/Pro/Executive. Points follow
   * the tier (10/20/35) and are filled by seedDefaults if omitted.
   * ============================================================ */

  /* ---- Track 101 · Rookie (6) — cap basics, luxury tax, the GM role ---- */
  {
    id: "dq-101r-1", ordinal: 61, difficulty: 1, track: "101", type: "mc", conceptTag: "salary_cap", activeDate: null,
    questionText: "What is a salary cap?",
    choiceA: "A tax every team pays the league each year",
    choiceB: "A limit on how much a team can spend on player salaries",
    choiceC: "The most any single player can earn",
    choiceD: "The minimum a team must spend on its arena",
    correctAnswer: "B",
    explanation:
      "A salary cap is a league-set limit on total player payroll. It keeps big-market teams from simply outspending everyone and forces GMs to budget. Every signing has to fit under — or be carved out of — that number.",
  },
  {
    id: "dq-101r-2", ordinal: 62, difficulty: 1, track: "101", type: "mc", conceptTag: "front_office", activeDate: null,
    questionText: "What does a general manager (GM) mainly do?",
    choiceA: "Coach the team during games",
    choiceB: "Sell tickets and run the arena",
    choiceC: "Build the roster — drafting, signing, and trading players within a budget",
    choiceD: "Referee disputes between players",
    correctAnswer: "C",
    explanation:
      "The GM is the architect of the roster: they draft, sign, and trade players while staying inside the cap. It's an economics job as much as a basketball one — every move is a resource-allocation decision.",
  },
  {
    id: "dq-101r-3", ordinal: 63, difficulty: 1, track: "101", type: "mc", conceptTag: "luxury_tax", activeDate: null,
    questionText: "What is the luxury tax?",
    choiceA: "A fee fans pay for premium seats",
    choiceB: "An extra payment teams owe when payroll goes above a set threshold",
    choiceC: "A tax on ticket sales",
    choiceD: "Money the league pays the best teams",
    correctAnswer: "B",
    explanation:
      "The luxury tax is a penalty on teams that spend above a set threshold. It's the league's way of letting teams overspend — but only if they're willing to pay for it. The richest, most aggressive teams treat it as the cost of contending.",
  },
  {
    id: "dq-101r-4", ordinal: 64, difficulty: 1, track: "101", type: "mc", conceptTag: "salary_cap", activeDate: null,
    questionText: "A team's payroll is $20M below the cap. What does that 'cap space' let them do?",
    choiceA: "Nothing — unused space is lost",
    choiceB: "Sign free agents using up to that $20M in room",
    choiceC: "Force another team to make a trade",
    choiceD: "Raise ticket prices by $20M",
    correctAnswer: "B",
    explanation:
      "Cap space is room to add salary. A team $20M under the cap can sign free agents up to that amount. Space is a real asset — teams sometimes trade just to create it so they can chase a big-name player.",
  },
  {
    id: "dq-101r-5", ordinal: 65, difficulty: 1, track: "101", type: "mc", conceptTag: "guaranteed_money", activeDate: null,
    questionText: "A contract is 'fully guaranteed.' What does that mean for the team?",
    choiceA: "They owe the money even if they cut the player",
    choiceB: "They can cancel it any time for free",
    choiceC: "The player can never be traded",
    choiceD: "The league pays half the salary",
    correctAnswer: "A",
    explanation:
      "Guaranteed money is owed no matter what — even if the player is waived or gets hurt. That's why GMs are careful with long guaranteed deals: a bad one stays on the books and eats cap space for years.",
  },
  {
    id: "dq-101r-6", ordinal: 66, difficulty: 1, track: "101", type: "mc", conceptTag: "scarcity", activeDate: null,
    questionText: "Rosters are limited to 15 players. A GM wants to keep a 16th they like. What concept forces a cut?",
    choiceA: "Inflation",
    choiceB: "Scarcity — there are more useful players than roster spots",
    choiceC: "Revenue sharing",
    choiceD: "The luxury tax",
    correctAnswer: "B",
    explanation:
      "Roster spots are scarce, so keeping one player means cutting another. Scarcity is the core of every front-office choice: limited spots, limited dollars, limited minutes. Someone always gets left off.",
  },

  /* ---- Track 101 · Pro (6) — apron math, slot value, exceptions ---- */
  {
    id: "dq-101p-1", ordinal: 67, difficulty: 2, track: "101", type: "mc", conceptTag: "apron", activeDate: null,
    questionText: "The 'first apron' is a spending line above the luxury tax. Why do teams fear crossing it?",
    choiceA: "It bans them from the playoffs",
    choiceB: "It unlocks extra cap space",
    choiceC: "It strips away roster-building tools like certain trades and exceptions",
    choiceD: "It forces them to sell the team",
    correctAnswer: "C",
    explanation:
      "The apron is a hard-ish ceiling: cross it and you lose flexibility — full mid-level exception, taking back more salary in trades, and more. It's designed to make the very top of the market pay a roster-building price, not just a tax bill.",
  },
  {
    id: "dq-101p-2", ordinal: 68, difficulty: 2, track: "101", type: "math", conceptTag: "luxury_tax", activeDate: null,
    questionText: "Your payroll is $5M over the tax line. At a simple 1.5× tax rate on the overage, what is the tax bill, in millions of dollars? (Enter the number.)",
    choiceA: "", choiceB: "", choiceC: "", choiceD: "",
    correctAnswer: "7.5",
    explanation:
      "Tax is charged on the amount above the line: $5M × 1.5 = $7.5M. Real tax rates climb the deeper you go (the 'repeater' rates are even steeper), so the bill grows fast as payroll rises.",
  },
  {
    id: "dq-101p-3", ordinal: 69, difficulty: 2, track: "101", type: "mc", conceptTag: "pick_value_decay", activeDate: null,
    questionText: "Why is the #3 overall pick worth far more than the #33 pick, even though both are 'draft picks'?",
    choiceA: "Higher picks have a much greater chance of landing a star — value decays steeply",
    choiceB: "Lower picks cost more money",
    choiceC: "The league bans trading late picks",
    choiceD: "There is no real difference",
    correctAnswer: "A",
    explanation:
      "Pick value decays steeply: the odds of finding a star drop sharply as you move down the board. That's why a top-5 pick can headline a blockbuster while second-round picks are thrown in as sweeteners.",
  },
  {
    id: "dq-101p-4", ordinal: 70, difficulty: 2, track: "101", type: "mc", conceptTag: "trade_exception", activeDate: null,
    questionText: "A team trades away a $10M player and gets none back. What does the resulting 'trade exception' let them do?",
    choiceA: "Sign any free agent to any amount",
    choiceB: "Absorb an incoming salary up to about that $10M later, without matching it",
    choiceC: "Skip the luxury tax for a year",
    choiceD: "Draft an extra player",
    correctAnswer: "B",
    explanation:
      "A trade exception is like a salary-sized coupon: it lets a team take back an incoming contract up to that amount later without sending matching salary out. It's a flexibility asset that expires — usually within a year.",
  },
  {
    id: "dq-101p-5", ordinal: 71, difficulty: 2, track: "101", type: "mc", conceptTag: "apron", activeDate: null,
    questionText: "Teams above the 'second apron' face the harshest rules. What is the league really trying to do?",
    choiceA: "Help the richest teams build superteams",
    choiceB: "Discourage stacking expensive rosters by removing tools, not just adding cost",
    choiceC: "Eliminate the salary cap entirely",
    choiceD: "Force every team to spend the same",
    correctAnswer: "B",
    explanation:
      "The second apron replaces 'pay more to spend more' with 'you simply can't.' By freezing picks and removing trade tools, it caps competitive concentration through roster rules rather than dollars alone.",
  },
  {
    id: "dq-101p-6", ordinal: 72, difficulty: 2, track: "101", type: "mc", conceptTag: "cap_hold", activeDate: null,
    questionText: "A team's own free agent isn't re-signed yet, but a 'cap hold' still sits on their books. Why does that matter?",
    choiceA: "It counts as placeholder salary, reducing usable cap space until they sign or renounce him",
    choiceB: "It pays the player twice",
    choiceC: "It is money the league owes the team",
    choiceD: "It has no effect on cap space",
    correctAnswer: "A",
    explanation:
      "A cap hold is a placeholder charge that reserves space for re-signing your own free agent. Until you sign or renounce him, that hold eats into your room — so chasing outside free agents often means giving up your own players' rights first.",
  },

  /* ---- Track 101 · Executive (4) — multi-team trades, S&T, supermax ---- */
  {
    id: "dq-101e-1", ordinal: 73, difficulty: 3, track: "101", type: "mc", conceptTag: "multi_team_trade", activeDate: null,
    questionText: "Why would a GM build a three-team trade instead of a simple two-team deal?",
    choiceA: "It avoids the salary cap completely",
    choiceB: "A third team can absorb salary or send an asset that makes the matching and fit work",
    choiceC: "The league requires three teams for any star trade",
    choiceD: "It doubles the number of players allowed",
    correctAnswer: "B",
    explanation:
      "Multi-team trades exist to solve matching and fit problems: a third team uses its cap space or surplus assets to make the money work or route players where they're wanted. Complexity is the price of getting an otherwise-impossible deal done.",
  },
  {
    id: "dq-101e-2", ordinal: 74, difficulty: 3, track: "101", type: "mc", conceptTag: "sign_and_trade", activeDate: null,
    questionText: "In a sign-and-trade, a team re-signs its own free agent and immediately trades him. Why bother?",
    choiceA: "It lets the player leave while the old team gets assets instead of nothing",
    choiceB: "It is the only way to cut a player",
    choiceC: "It erases the player's salary from both teams",
    choiceD: "It guarantees a championship",
    correctAnswer: "A",
    explanation:
      "A sign-and-trade turns a departing free agent into a return of players or picks — value the team would otherwise lose for free. It can also let the new team pay more or add years than straight cap space allows, so both sides can win.",
  },
  {
    id: "dq-101e-3", ordinal: 75, difficulty: 3, track: "101", type: "mc", conceptTag: "supermax", activeDate: null,
    questionText: "The 'supermax' lets a team pay its own star more than any rival can. What's the strategic risk of offering it?",
    choiceA: "There is no risk — more pay is always better",
    choiceB: "One huge guaranteed deal can crush future flexibility if the player declines or gets hurt",
    choiceC: "It forces the team to trade the player",
    choiceD: "The league pays the difference",
    correctAnswer: "B",
    explanation:
      "The supermax is a retention tool, but it concentrates enormous guaranteed money in one player. If his performance dips or injuries hit, that contract becomes an immovable anchor — the analog of over-betting on a single asset.",
  },
  {
    id: "dq-101e-4", ordinal: 76, difficulty: 3, track: "101", type: "math", conceptTag: "stretch_provision", activeDate: null,
    questionText: "You waive a player with $12M left and 'stretch' it evenly across 3 seasons. What is the annual cap hit, in millions? (Enter the number.)",
    choiceA: "", choiceB: "", choiceC: "", choiceD: "",
    correctAnswer: "4",
    explanation:
      "The stretch provision spreads dead money over more years: $12M ÷ 3 = $4M per season. It lowers the yearly hit now but locks 'dead money' on the books longer — paying for nothing in future seasons.",
  },

  /* ---- Track 201 · Rookie (5) — revenue sharing, arena, tickets ---- */
  {
    id: "dq-201r-1", ordinal: 77, difficulty: 1, track: "201", type: "mc", conceptTag: "revenue_sharing", activeDate: null,
    questionText: "What is revenue sharing between teams?",
    choiceA: "Players splitting their salaries with fans",
    choiceB: "Richer teams sending money to smaller-market teams to keep the league healthy",
    choiceC: "Teams sharing their playbooks",
    choiceD: "The league taking all ticket money",
    correctAnswer: "B",
    explanation:
      "Revenue sharing moves money from high-revenue teams to smaller-market ones. A league is only as strong as its weakest franchises, so sharing keeps every market competitive enough to matter — and keeps the product valuable for everyone.",
  },
  {
    id: "dq-201r-2", ordinal: 78, difficulty: 1, track: "201", type: "mc", conceptTag: "arena_economics", activeDate: null,
    questionText: "Besides tickets, which is a major way an arena makes money on game night?",
    choiceA: "Charging players to enter",
    choiceB: "Concessions, parking, and premium suites",
    choiceC: "Selling the building each night",
    choiceD: "Taxing other teams",
    correctAnswer: "B",
    explanation:
      "The arena is a revenue machine well beyond ticket stubs: food and drink, parking, suites, and sponsorship all stack up. That's why owning or controlling the building is so valuable — many revenue streams flow through one night.",
  },
  {
    id: "dq-201r-3", ordinal: 79, difficulty: 1, track: "201", type: "mc", conceptTag: "ticket_pricing", activeDate: null,
    questionText: "A team notices its cheapest seats sell out instantly but premium seats sit empty. What does basic pricing suggest?",
    choiceA: "Cut prices on the premium seats to fill them",
    choiceB: "Raise prices on every seat",
    choiceC: "Stop selling cheap seats",
    choiceD: "Move the team to a new city",
    correctAnswer: "A",
    explanation:
      "When demand is weak at a price, lowering it can fill seats and capture revenue you'd otherwise lose. Empty premium seats earn nothing; a filled seat at a lower price earns something — and sells concessions too.",
  },
  {
    id: "dq-201r-4", ordinal: 80, difficulty: 1, track: "201", type: "mc", conceptTag: "gate_revenue", activeDate: null,
    questionText: "What is 'gate revenue'?",
    choiceA: "Money from the team's TV deal",
    choiceB: "Income from ticket sales to games",
    choiceC: "Fees for entering the parking lot",
    choiceD: "Player salaries",
    correctAnswer: "B",
    explanation:
      "Gate revenue is the money from tickets — the oldest revenue stream in sports. It still matters, but for big franchises it's now often smaller than media and sponsorship money, which has reshaped how teams are valued.",
  },
  {
    id: "dq-201r-5", ordinal: 81, difficulty: 1, track: "201", type: "mc", conceptTag: "naming_rights", activeDate: null,
    questionText: "A company pays millions to put its name on a team's arena. What is the company buying?",
    choiceA: "Ownership of the team",
    choiceB: "Years of brand exposure to every fan and broadcast",
    choiceC: "The right to pick the roster",
    choiceD: "Free tickets forever",
    correctAnswer: "B",
    explanation:
      "Naming rights are advertising: the sponsor's name reaches every fan, broadcast, and highlight for years. For the team, it's a large, reliable revenue stream locked in by a long contract — value created from the building's attention, not the game.",
  },

  /* ---- Track 201 · Pro (5) — valuation, media rights, cap-sheet ---- */
  {
    id: "dq-201p-1", ordinal: 82, difficulty: 2, track: "201", type: "math", conceptTag: "franchise_valuation", activeDate: null,
    questionText: "A franchise earns $300M in annual revenue and sells at a 7× revenue multiple. What is the sale price, in billions? (Enter the number.)",
    choiceA: "", choiceB: "", choiceC: "", choiceD: "",
    correctAnswer: "2.1",
    explanation:
      "A revenue multiple values a team as revenue × a market factor: $300M × 7 = $2.1B. Multiples rise when buyers expect future growth — new media deals, scarcity of teams, and rich owners bidding push them well above old levels.",
  },
  {
    id: "dq-201p-2", ordinal: 83, difficulty: 2, track: "201", type: "mc", conceptTag: "media_rights", activeDate: null,
    questionText: "Why have national media rights become the single biggest driver of franchise value?",
    choiceA: "Fans pay teams directly to watch",
    choiceB: "Networks and streamers pay enormous, guaranteed sums shared across all teams",
    choiceC: "Media deals are tax-free",
    choiceD: "They replace the need for players",
    correctAnswer: "B",
    explanation:
      "Live sports are one of the few things people still watch in real time, so networks and streamers pay huge guaranteed fees. That money is shared league-wide and is highly predictable — exactly what drives up what a franchise is worth.",
  },
  {
    id: "dq-201p-3", ordinal: 84, difficulty: 2, track: "201", type: "mc", conceptTag: "cap_sheet", activeDate: null,
    questionText: "Reading a cap sheet, you see most salary expires next summer. What does that signal about the team's plan?",
    choiceA: "They are stuck with no flexibility",
    choiceB: "They are clearing room for a big run at free agents next offseason",
    choiceC: "They plan to fold the team",
    choiceD: "They have already spent over the cap forever",
    correctAnswer: "B",
    explanation:
      "Expiring contracts are future cap space. A sheet full of deals ending next summer usually means a deliberate plan to open room for a major signing or trade — reading the timeline tells you the strategy.",
  },
  {
    id: "dq-201p-4", ordinal: 85, difficulty: 2, track: "201", type: "mc", conceptTag: "franchise_valuation", activeDate: null,
    questionText: "Two teams have equal revenue, but one sells for far more. Which factor best explains the gap?",
    choiceA: "Market size and growth potential — a bigger, growing market commands a higher multiple",
    choiceB: "The color of the jerseys",
    choiceC: "The number of timeouts they use",
    choiceD: "How tall the players are",
    correctAnswer: "A",
    explanation:
      "Price reflects expected future revenue, not just today's. A larger market with room to grow, valuable real estate, or an upcoming media deal earns a richer multiple — buyers pay for tomorrow's cash flows.",
  },
  {
    id: "dq-201p-5", ordinal: 86, difficulty: 2, track: "201", type: "math", conceptTag: "media_rights", activeDate: null,
    questionText: "A league signs a $30B media deal over 10 years, split evenly among 30 teams. About how many millions does each team get per year? (Enter the number.)",
    choiceA: "", choiceB: "", choiceC: "", choiceD: "",
    correctAnswer: "100",
    explanation:
      "Split it down: $30B ÷ 10 years = $3B per year; $3B ÷ 30 teams = $100M each per year. That shared, guaranteed money raises the financial floor for every franchise — even small-market teams.",
  },

  /* ---- Track 201 · Executive (4) — CBA, ownership, expansion ---- */
  {
    id: "dq-201e-1", ordinal: 87, difficulty: 3, track: "201", type: "mc", conceptTag: "collective_bargaining", activeDate: null,
    questionText: "In labor talks, owners and players split 'basketball-related income' (BRI) roughly 50/50. Why is that split the core fight?",
    choiceA: "It decides team uniforms",
    choiceB: "A few percentage points of a multibillion-dollar pie is worth enormous money to both sides",
    choiceC: "It sets ticket prices directly",
    choiceD: "It determines the playoff bracket",
    correctAnswer: "B",
    explanation:
      "The BRI split divides billions, so even one or two percentage points is a fortune. That's why collective bargaining is so contentious and why lockouts happen — both sides are negotiating the division of the entire economic pie.",
  },
  {
    id: "dq-201e-2", ordinal: 88, difficulty: 3, track: "201", type: "mc", conceptTag: "ownership_waterfall", activeDate: null,
    questionText: "When a team is sold, an 'ownership waterfall' determines who gets paid first. Who typically sits at the top?",
    choiceA: "Season-ticket holders",
    choiceB: "Lenders and preferred investors, before common-equity owners see a dollar",
    choiceC: "The players",
    choiceD: "The city government",
    correctAnswer: "B",
    explanation:
      "A waterfall pays claims in priority order: debt and preferred investors are made whole first, and common owners split what's left. It's why two owners with the same percentage can walk away with very different amounts.",
  },
  {
    id: "dq-201e-3", ordinal: 89, difficulty: 3, track: "201", type: "mc", conceptTag: "expansion_economics", activeDate: null,
    questionText: "Existing owners often welcome an expansion team. What's the main economic reason?",
    choiceA: "It lowers their own ticket prices",
    choiceB: "They split a large one-time expansion fee and aren't required to share it like normal revenue",
    choiceC: "It forces them to share players",
    choiceD: "It reduces the value of their team",
    correctAnswer: "B",
    explanation:
      "New owners pay a huge entry fee that current owners divide among themselves — often without the usual revenue-sharing obligations. Expansion can dilute future shares, but the upfront windfall and a bigger league footprint usually win the vote.",
  },
  {
    id: "dq-201e-4", ordinal: 90, difficulty: 3, track: "201", type: "mc", conceptTag: "escrow", activeDate: null,
    questionText: "Players have a slice of every paycheck held in 'escrow.' What problem does that solve for the league?",
    choiceA: "It pays for the arena",
    choiceB: "It trues up the actual salary-to-revenue split when final revenue is known",
    choiceC: "It funds player pensions only",
    choiceD: "It replaces the salary cap",
    correctAnswer: "B",
    explanation:
      "Salaries are set before final revenue is known, so escrow holds back part of pay to balance the books to the agreed split. If players were overpaid relative to revenue, escrow covers the gap — a settle-up mechanism for a moving target.",
  },
];

/* ============================================================
 * Read layer (server-only — these hit the database).
 * ============================================================ */

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Fill in seed defaults (track/type/points/active) to a full DailyQuestion. */
export function seedToQuestion(s: DailyQuestionSeed): DailyQuestion {
  const type: QuestionType = s.type ?? "mc";
  return {
    ...s,
    type,
    track: s.track ?? "101",
    points: s.points ?? pointsForDifficulty(s.difficulty),
    active: true,
    correctAnswer: type === "mc" ? s.correctAnswer.toUpperCase() : s.correctAnswer,
  };
}

/** All daily questions, ordered (DB first, falling back to the seed bank). */
export async function getDailyQuestions(): Promise<DailyQuestion[]> {
  const rows = (await getDb().prepare("SELECT * FROM daily_questions ORDER BY ordinal ASC").all()) as any[];
  if (rows.length === 0) return [...DAILY_QUESTIONS].sort((a, b) => a.ordinal - b.ordinal).map(seedToQuestion);
  return rows.map(rowToDailyQuestion);
}

/** A single question by id (admin + submit-action use), or null. */
export async function getDailyQuestionById(id: string): Promise<DailyQuestion | null> {
  const r = (await getDb().prepare("SELECT * FROM daily_questions WHERE id = ?").get(id)) as any;
  return r ? rowToDailyQuestion(r) : null;
}

function rowToDailyQuestion(r: any): DailyQuestion {
  const type: QuestionType = r.type === "math" || r.type === "fr" ? r.type : "mc";
  const difficulty = Number(r.difficulty) || 1;
  const rawCorrect = String(r.correct_answer ?? "");
  return {
    id: r.id,
    ordinal: Number(r.ordinal) || 0,
    questionText: r.question_text,
    type,
    choiceA: r.choice_a ?? "",
    choiceB: r.choice_b ?? "",
    choiceC: r.choice_c ?? "",
    choiceD: r.choice_d ?? "",
    // MC keys are letters; math/fr answers keep their original casing.
    correctAnswer: type === "mc" ? rawCorrect.toUpperCase() : rawCorrect,
    explanation: r.explanation,
    conceptTag: r.concept_tag,
    difficulty,
    track: r.track === "201" ? "201" : "101",
    points: Number(r.points) || pointsForDifficulty(difficulty),
    active: r.active == null ? true : Number(r.active) === 1,
    activeDate: r.active_date ?? null,
  };
}

/** Pick the question for `today` from a pool: a dated match first, else a stable daily rotation. */
function pickForDay(pool: DailyQuestion[], today: string, now: number): DailyQuestion | null {
  if (pool.length === 0) return null;
  const dated = pool.find((q) => q.activeDate === today);
  if (dated) return dated;
  return pool[utcDayNumber(now) % pool.length];
}

/**
 * The question that is "live" right now across the whole active bank. Prefers a
 * question scheduled for today's date; otherwise rotates by day number. Kept for
 * callers that want a single global question regardless of student.
 */
export async function getActiveDailyQuestion(now: number = Date.now()): Promise<DailyQuestion | null> {
  const all = (await getDailyQuestions()).filter((q) => q.active);
  return pickForDay(all, todayUtcIso(now), now);
}

/** Lifetime count of this student's correct daily answers. */
export async function lifetimeCorrectCount(studentId: string): Promise<number> {
  const row = (await getDb()
      .prepare("SELECT COUNT(*) AS n FROM daily_responses WHERE student_id = ? AND is_correct = 1")
      .get(studentId)) as any;
  return Number(row?.n) || 0;
}

/**
 * The student's current curriculum track. Earning the Track 101 certificate
 * unlocks Track 201, so a certified student gets the 201 question bank.
 */
export async function currentTrackFor(studentId: string): Promise<string> {
  const row = (await getDb()
      .prepare("SELECT 1 AS c FROM certificates WHERE student_id = ? AND track = '101' LIMIT 1")
      .get(studentId)) as any;
  return row ? "201" : "101";
}

/**
 * The difficulty a student should see, by lifetime correct answers:
 *  0–4 → Rookie (1), 5–14 → Pro (2), 15+ → Executive (3).
 */
export async function computedDifficultyFor(studentId: string): Promise<number> {
  const correct = (await lifetimeCorrectCount(studentId));
  if (correct >= 15) return 3;
  if (correct >= 5) return 2;
  return 1;
}

/**
 * Today's question FOR A STUDENT: filtered to their track and computed
 * difficulty, picked by the date-seed rotation. If no question exists at the
 * exact difficulty, fall one tier down, then to any difficulty on the track,
 * then to anything — so there is ALWAYS a question.
 */
export async function getDailyQuestion(studentId: string, now: number = Date.now()): Promise<DailyQuestion | null> {
  const all = (await getDailyQuestions()).filter((q) => q.active);
  if (all.length === 0) return null;
  const track = (await currentTrackFor(studentId));
  const targetDiff = (await computedDifficultyFor(studentId));
  const today = todayUtcIso(now);

  const matchers: ((q: DailyQuestion) => boolean)[] = [];
  for (let d = targetDiff; d >= 1; d--) matchers.push((q) => q.track === track && q.difficulty === d);
  matchers.push((q) => q.track === track);
  matchers.push(() => true);

  for (const match of matchers) {
    const picked = pickForDay(all.filter(match), today, now);
    if (picked) return picked;
  }
  return all[0] ?? null;
}

/** The student's stored response to a specific daily question, if any. */
export async function getDailyResponse(
  studentId: string,
  questionId: string,
): Promise<{ selectedChoice: string; isCorrect: boolean; respondedAt: number } | null> {
  const r = (await getDb()
      .prepare("SELECT selected_choice, is_correct, responded_at FROM daily_responses WHERE student_id = ? AND question_id = ?")
      .get(studentId, questionId)) as any;
  if (!r) return null;
  return {
    // Raw — MC stores an uppercase letter; math/fr store the typed answer.
    selectedChoice: String(r.selected_choice ?? ""),
    isCorrect: Number(r.is_correct) === 1,
    respondedAt: Number(r.responded_at) || 0,
  };
}

/** Parse a money/number answer into a comparable number ("$2.1B" → 2.1). */
export function normalizeNumeric(s: string): number | null {
  const cleaned = s.replace(/[\s,$%]/g, "").replace(/(million|billion|[mb])$/i, "").trim();
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Grade a submitted answer against a question's key (handles mc / math / fr). */
export function gradeAnswer(q: DailyQuestion, submitted: string): boolean {
  const s = String(submitted ?? "").trim();
  if (s === "") return false;
  if (q.type === "mc") return s.toUpperCase() === q.correctAnswer.toUpperCase();
  if (q.type === "math") {
    const a = normalizeNumeric(s);
    const b = normalizeNumeric(q.correctAnswer);
    if (a != null && b != null) return Math.abs(a - b) < 1e-6;
  }
  const norm = (x: string) => x.toLowerCase().replace(/\s+/g, " ").replace(/[.,!?;:]+$/g, "").trim();
  return norm(s) === norm(q.correctAnswer);
}

/** Build the dashboard view of today's question for a student. */
export async function getDailyQuestionView(studentId: string, now: number = Date.now()): Promise<DailyQuestionView | null> {
  const q = (await getDailyQuestion(studentId, now));
  if (!q) return null;
  const answer = (await getDailyResponse(studentId, q.id));
  const choices =
    q.type === "mc"
      ? [
          { key: "A", text: q.choiceA },
          { key: "B", text: q.choiceB },
          { key: "C", text: q.choiceC },
          { key: "D", text: q.choiceD },
        ]
      : [];
  return {
    id: q.id,
    ordinal: q.ordinal,
    questionText: q.questionText,
    type: q.type,
    choices,
    conceptTag: q.conceptTag,
    conceptLabel: conceptLabel(q.conceptTag),
    difficulty: q.difficulty,
    tier: difficultyTier(q.difficulty),
    tierLabel: tierLabel(q.difficulty),
    track: q.track,
    points: q.points,
    answered: !!answer,
    selectedChoice: answer?.selectedChoice ?? null,
    isCorrect: answer ? answer.isCorrect : null,
    correctAnswer: answer ? q.correctAnswer : null,
    explanation: answer ? q.explanation : null,
    nextResetAt: nextResetAt(now),
  };
}

/** How many daily answers were recorded across all students today (admin overview). */
export async function countDailyAnswersToday(now: number = Date.now()): Promise<number> {
  const start = utcDayNumber(now) * DAY_MS;
  const row = (await getDb()
      .prepare("SELECT COUNT(*) AS n FROM daily_responses WHERE responded_at >= ? AND responded_at < ?")
      .get(start, start + DAY_MS)) as any;
  return Number(row?.n) || 0;
}

/* eslint-enable @typescript-eslint/no-explicit-any */
