import type { DataItem, DecisionOption, Consequence } from "@/components/ds";

/* ============================================================
 * Simulation content — ported from the design prototype.
 * Track 101 · M1 · L2 · "Opportunity Cost, in Trades"
 * Theme: every yes is a no somewhere else on the roster.
 * ============================================================ */

export type MetricKey = "winNow" | "future" | "cap" | "fans";

export type Metrics = Record<MetricKey, number>;

/** Per-choice consequence detail shown in the dark "what your call set in motion" panel. */
export interface ChoiceDetail {
  positive: string;
  negative: string;
  reaction: string;
  newProblem: string;
  metrics: Partial<Metrics>;
}

export interface SimStep {
  round: string;
  question: string;
  prompt: string;
  facts: DataItem[];
  unknowns: string[];
  options: DecisionOption[];
  consequence: Consequence;
  detail: Record<string, ChoiceDetail>;
}

/** Entry-screen metric primer. */
export interface EntryMetric {
  label: string;
  desc: string;
  dot: string;
}

/** Win-now vs patience weight per option, used to derive the strategic identity. */
export const SIM_AXIS: Record<number, Record<string, number>> = {
  0: { trade: 2, hold: -2, counter: 0 },
  1: { shooter: 1, playmaker: 0, bank: -1 },
  2: { sell: -2, keep: 0, buy: 2 },
};

/** Baseline Front Office Index before any choices are committed. */
export const SIM_BASE: Metrics = { winNow: 50, future: 58, cap: 46, fans: 54 };

export const entryMetrics: EntryMetric[] = [
  { label: "Win-Now", desc: "How ready this roster is to compete for a title right now.", dot: "var(--bow-blue)" },
  { label: "Future Assets", desc: "The picks, youth, and upside you have left to build with.", dot: "var(--bow-positive)" },
  { label: "Cap Flexibility", desc: "Room to maneuver — to respond when the next chance appears.", dot: "var(--bow-warning)" },
  { label: "Fan Buzz", desc: "Belief in the building, and the goodwill you can spend.", dot: "var(--bow-orange)" },
];

export const SIM: SimStep[] = [
  {
    round: "Round 01 · The Offer on the Table",
    question: "A title contender just called.",
    prompt:
      "They want your 22-year-old wing and your 2027 first-round pick. In return: a 31-year-old All-Star and an expiring contract. You could be a contender by spring — but you’d spend the one asset every other GM is calling about. What’s your move?",
    facts: [
      { label: "Your Wing", value: "Age 22 · $4.1M" },
      { label: "The All-Star", value: "Age 31 · $34M" },
      { label: "Your Title Odds", value: "9%" },
      { label: "Contender Window", value: "2 yrs", tone: "warning" },
    ],
    unknowns: ["ALL-STAR DECLINE CURVE: UNKNOWN", "WING CEILING: UNTESTED", "LOCKER-ROOM FIT: UNKNOWN"],
    options: [
      { id: "trade", label: "Make the trade — win now", detail: "All-Star + expiring IN · young wing + 2027 first OUT" },
      { id: "hold", label: "Keep the wing — bet on the ceiling", detail: "Hold your cheapest, highest-upside asset" },
      { id: "counter", label: "Counter: the wing, but keep the pick", detail: "Lower your cost — and risk them hanging up" },
    ],
    consequence: {
      byChoice: {
        trade: {
          status: "warning",
          headline: "You bought two great years — and sold a decade.",
          body: "The All-Star drags you into the title picture immediately. But the wing you gave up becomes a fringe All-Star by year three, on a contract you’ll never match.",
        },
        hold: {
          status: "info",
          headline: "You kept the asset everyone wanted.",
          body: "No banner this year. But you still hold the cheapest source of upside in the league — and every rival GM now has to plan around him.",
        },
        counter: {
          status: "negative",
          headline: "You blinked, and so did they.",
          body: "They take the wing for the All-Star straight up and keep their own pick too. You won the principle and lost the leverage.",
        },
      },
    },
    detail: {
      trade: {
        positive: "Title odds jump from 9% to 22% overnight. Ticket demand and national TV interest spike.",
        negative: "Your 2027 first conveys near the top of a loaded draft. The wing makes an All-NBA team in another uniform.",
        reaction: 'Owner: "Finally — we’re playing to win. Don’t make me regret the pick."',
        newProblem: "The All-Star’s $34M expiring becomes next summer’s biggest question. Re-sign, or watch him walk for nothing?",
        metrics: { winNow: 22, future: -24, cap: -10, fans: 14 },
      },
      hold: {
        positive: "You preserve every long-term asset and stay maximally flexible for the next two summers.",
        negative: "You miss a real title window. The fan base wanted a star, and the back pages say you flinched.",
        reaction: 'Owner: "Patience is fine. Patience without a plan is just losing slowly."',
        newProblem: "The wing now expects to be the franchise centerpiece — and the extension talk starts a year early.",
        metrics: { winNow: -8, future: 18, cap: 8, fans: -12 },
      },
      counter: {
        positive: "You held onto your 2027 pick and your principle of never overpaying.",
        negative: "They walked. The All-Star lands with a rival in your conference. You got nothing and watched the price reset.",
        reaction: 'Owner: "We had it on the table. Explain to me why we don’t have him."',
        newProblem: "The locker room read the near-miss as indecision. Your best veteran wants to know the plan.",
        metrics: { winNow: -4, future: 4, cap: 0, fans: -10 },
      },
    },
  },
  {
    round: "Round 02 · Filling the Hole",
    question: "One exception. One hole.",
    prompt:
      "Whatever you did in Round 1, the roster has one obvious gap and exactly one Mid-Level Exception to fill it. Spend it on a 3-and-D wing, a steady backup playmaker, or bank it and keep your options open until the deadline?",
    facts: [
      { label: "Mid-Level", value: "$12.4M", tone: "info" },
      { label: "Bench Scoring", value: "28th", tone: "negative" },
      { label: "Cap Flexibility", value: "Tight", tone: "warning" },
    ],
    unknowns: ["DEADLINE MARKET: UNKNOWN", "INJURY LUCK: UNKNOWN", "PLAYOFF MATCHUP: TBD"],
    options: [
      { id: "shooter", label: "Sign the 3-and-D wing", detail: "Spacing + perimeter defense · fills the starting need" },
      { id: "playmaker", label: "Sign the backup playmaker", detail: "Insurance if your starter sits · steadies the bench" },
      { id: "bank", label: "Bank the exception", detail: "Keep the room — decide at the deadline" },
    ],
    consequence: {
      byChoice: {
        shooter: {
          status: "positive",
          headline: "You solved the starting lineup.",
          body: "Spacing opens everything for your stars and the defense holds up in switches. The bench is still thin — but your best five is real.",
        },
        playmaker: {
          status: "info",
          headline: "You bought insurance, not ceiling.",
          body: "When your starter rests, the offense no longer collapses. But you passed on the spacing that would have raised your ceiling in a playoff series.",
        },
        bank: {
          status: "warning",
          headline: "You kept your options — and your hole.",
          body: "Flexibility has real value at the deadline. Until then, every close game runs through a bench that ranks 28th in scoring.",
        },
      },
    },
    detail: {
      shooter: {
        positive: "Starting lineup net rating jumps into the top 10. Spacing makes your stars more efficient.",
        negative: "You’re now hard-capped for the rest of the season. No more in-season flexibility.",
        reaction: 'Head Coach: "This is the guy I asked for. Now don’t touch my rotation at the deadline."',
        newProblem: "A hard cap means any deadline addition has to be matched dollar-for-dollar.",
        metrics: { winNow: 12, future: -4, cap: -14, fans: 6 },
      },
      playmaker: {
        positive: "Bench units stop bleeding leads. Your starter can finally rest in the regular season.",
        negative: "You declined the spacing upgrade that wins playoff series. The ceiling is unchanged.",
        reaction: 'Head Coach: "Useful. Not the swing I wanted, but useful."',
        newProblem: "Come playoffs, defenses still sag off your non-shooters in the half court.",
        metrics: { winNow: 6, future: 0, cap: -10, fans: 0 },
      },
      bank: {
        positive: "You hold full Mid-Level flexibility into the deadline — the rarest currency in February.",
        negative: "For now, the bench stays 28th. You’re betting a better option appears.",
        reaction: 'Owner: "I like having the bullet. I’d like it more pointed at something."',
        newProblem: 'The pressure to "use it or lose it" builds with every close loss.',
        metrics: { winNow: -6, future: 8, cap: 10, fans: -4 },
      },
    },
  },
  {
    round: "Round 03 · The Deadline",
    question: "The phone rings one more time.",
    prompt:
      "It’s 48 hours to the trade deadline. A rebuilding team overpays — a future first — for one of your rotation role players. Do you sell high, keep the group together for the playoff run, or push your remaining chips in and buy?",
    facts: [
      { label: "Days to Deadline", value: "2", tone: "warning" },
      { label: "Offer", value: "1st-Rd Pick", tone: "info" },
      { label: "Current Seed", value: "#4" },
    ],
    unknowns: ["HEALTH DOWN THE STRETCH: UNKNOWN", "PICK CONVEYANCE: 2028", "CHEMISTRY COST: UNKNOWN"],
    options: [
      { id: "sell", label: "Sell high — take the first", detail: "Replenish the asset you spent earlier" },
      { id: "keep", label: "Keep the group together", detail: "Protect chemistry for the playoff run" },
      { id: "buy", label: "Buy — push the chips in", detail: "Add now · spend more of the future" },
    ],
    consequence: {
      byChoice: {
        sell: {
          status: "positive",
          headline: "You turned a role player into a future.",
          body: "A first-round pick for a rotation piece is good business. The rotation gets thinner, but you’ve restocked the cupboard you raided in Round 1.",
        },
        keep: {
          status: "info",
          headline: "You bet on the room you built.",
          body: "No splashy headline. The group that got you here stays intact — and continuity is the one thing money can’t buy in April.",
        },
        buy: {
          status: "negative",
          headline: "You went all in.",
          body: "The deadline addition raises your ceiling for exactly one spring. If it doesn’t end in a banner, the bill comes due for years.",
        },
      },
    },
    detail: {
      sell: {
        positive: "You recoup a future first and reset your long-term flexibility.",
        negative: "Your playoff rotation shrinks to eight. One injury and the margin disappears.",
        reaction: 'Front Office: "Smart. Boring, but smart. The model loves this."',
        newProblem: "The locker room notices a contributor leave mid-run. You’ll have to explain the plan again.",
        metrics: { winNow: -6, future: 16, cap: 6, fans: -4 },
      },
      keep: {
        positive: "Chemistry and trust stay intact heading into the most important games of the year.",
        negative: 'You did nothing while rivals improved. If you exit early, "stood pat" becomes the headline.',
        reaction: 'Veteran Captain: "Thank you. This group is real. Let us finish it."',
        newProblem: "You enter the offseason with the same roster and one year less of team control.",
        metrics: { winNow: 4, future: 2, cap: 0, fans: 6 },
      },
      buy: {
        positive: "Your title odds spike to their highest point all season. The building is electric.",
        negative: "You’ve now traded two future firsts. Miss, and the next three drafts are someone else’s.",
        reaction: 'Owner: "I love it. You’d better be right."',
        newProblem: "A win-now roster with no picks and a hard cap has exactly one exit: win it all, now.",
        metrics: { winNow: 16, future: -22, cap: -6, fans: 12 },
      },
    },
  },
];

/* ----- Debrief metadata ----- */

export const METRIC_META: Record<MetricKey, { name: string; strong: string; weak: string }> = {
  winNow: {
    name: "Win-Now",
    strong: "You built to compete immediately.",
    weak: "You left wins on the table chasing later.",
  },
  future: {
    name: "Future Assets",
    strong: "You protected the future better than most.",
    weak: "You spent heavily against years you can’t see yet.",
  },
  cap: {
    name: "Cap Flexibility",
    strong: "You kept your books clean and your options open.",
    weak: "You boxed yourself in with little room to maneuver.",
  },
  fans: {
    name: "Fan Buzz",
    strong: "You kept the building electric.",
    weak: "You spent goodwill you’ll need to earn back.",
  },
};

export interface Identity {
  identity: string;
  identityBody: string;
}

/** Derive the strategic identity from the running win-now vs patience axis sum. */
export function identityForAxis(axisSum: number): Identity {
  if (axisSum >= 3) {
    return {
      identity: "Win-Now Aggressor",
      identityBody:
        "You treated the open window as a mandate. You spent the future to maximize the present — and now the only acceptable ending is a banner.",
    };
  }
  if (axisSum <= -3) {
    return {
      identity: "The Long-Game Architect",
      identityBody:
        "You refused to mortgage the future for a single spring. You hoarded optionality and upside — betting that patience compounds faster than panic.",
    };
  }
  return {
    identity: "The Balanced Builder",
    identityBody:
      "You took your shots without burning the cupboard. You stayed competitive while keeping a door open — the hardest line to walk in a front office.",
  };
}

/** The counterargument another exec would make, keyed to the axis. */
export function otherExecForAxis(axisSum: number): string {
  if (axisSum >= 3) {
    return "A patient executive would argue you overpaid for certainty — that the picks you spent were worth more than two good springs.";
  }
  if (axisSum <= -3) {
    return "A win-now executive would argue you wasted an open window — that assets you never used are just losses with better branding.";
  }
  return "A bolder executive would argue the balanced path wins nothing — that championships go to the GM willing to be wrong in a big way.";
}
