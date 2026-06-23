/* ============================================================
 * Simulation Room (Feature 7) — content + grading.
 *
 * A 10-turn, turn-based sports-economics game: the student runs the
 * fictional Westbrook Wolves, making one decision per turn against a
 * salary cap and a win/loss record. This module is PURE (no DB,
 * client-safe): seed content + the grading math. The server store and
 * actions live separately so the answer outcomes stay server-authoritative.
 * ============================================================ */

export const SIM_TEAM = "Westbrook Wolves";
export const START_CAP = 30_000_000;
export const GAMES_PER_TURN = 8;
export const TOTAL_TURNS = 10;

export interface SimChoice {
  id: string;
  label: string;
  description: string;
  /** Dollar change to cap space (negative = spend, positive = save/relief). */
  capImpact: number;
  /** Wins added in this turn's stretch of games (0..GAMES_PER_TURN). */
  winsImpact: number;
  /** Shown after the pick — what happened. */
  outcome: string;
  /** True when this is the economically soundest call for the concept. */
  sound: boolean;
}

export interface SimTurn {
  turn: number;
  concept: string;
  /** One-line "You just applied: …" label shown in the outcome. */
  conceptLabel: string;
  title: string;
  situation: string;
  choices: SimChoice[];
}

export const SIM_TURNS: SimTurn[] = [
  {
    turn: 1,
    concept: "Scarcity",
    conceptLabel: "Scarcity",
    title: "The Max Contract",
    situation:
      "Your best player wants a max contract worth $35M a year. Your cap space is only $30M. You can sign him and blow past the luxury tax, trade him for cap relief, or let him walk and rebuild.",
    choices: [
      { id: "t1-sign", label: "Sign him to the max", description: "−$35M cap · win now", capImpact: -35_000_000, winsImpact: 7, sound: false, outcome: "You blew past the luxury-tax line, but your star is locked in. The building is electric and you win now — at a steep, repeating cost." },
      { id: "t1-trade", label: "Trade him for cap relief", description: "+$15M cap · reset", capImpact: 15_000_000, winsImpact: 3, sound: true, outcome: "You respected your limited cap and banked real flexibility. The roster took a step back, but your books are clean." },
      { id: "t1-walk", label: "Let him walk and rebuild", description: "+$5M cap · start over", capImpact: 5_000_000, winsImpact: 1, sound: false, outcome: "You kept your picks and your cap, but got nothing back for a star. The fans are furious and the wins dried up." },
    ],
  },
  {
    turn: 2,
    concept: "Opportunity Cost",
    conceptLabel: "Opportunity Cost",
    title: "One Path, Not Both",
    situation:
      "Two free agents are available: a star shooting guard for $18M, or two solid role players for $9M each. You can only afford one path. What you pick is what you give up.",
    choices: [
      { id: "t2-star", label: "Sign the star guard", description: "−$18M cap · high ceiling", capImpact: -18_000_000, winsImpact: 6, sound: false, outcome: "One great player raised your ceiling — but you gave up the depth, and your bench is thin." },
      { id: "t2-role", label: "Sign two role players", description: "−$18M cap · depth", capImpact: -18_000_000, winsImpact: 5, sound: true, outcome: "You bought balance and depth. You gave up star power, but the trade-off keeps you steady all season." },
      { id: "t2-save", label: "Save the money", description: "$0 cap · stay flexible", capImpact: 0, winsImpact: 2, sound: false, outcome: "You kept your flexibility for later, but stood pat while rivals improved around you." },
    ],
  },
  {
    turn: 3,
    concept: "Incentives",
    conceptLabel: "Incentives",
    title: "The Cheap Spark Plug",
    situation:
      "Your backup point guard is playing out of his mind on a cheap deal. Extend him now at a slight premium, wait until the season ends and risk him demanding more, or trade him at peak value.",
    choices: [
      { id: "t3-extend", label: "Extend him now", description: "−$8M cap · lock value", capImpact: -8_000_000, winsImpact: 5, sound: true, outcome: "You locked in value before the price rose. He stays motivated and productive — exactly the incentive you wanted." },
      { id: "t3-wait", label: "Wait until season's end", description: "−$12M cap · risky", capImpact: -12_000_000, winsImpact: 4, sound: false, outcome: "He kept balling and his price jumped. You re-signed him, but the wait cost you millions." },
      { id: "t3-trade", label: "Trade him at peak value", description: "+$6M cap · sell high", capImpact: 6_000_000, winsImpact: 3, sound: false, outcome: "You sold high and banked assets, but lost the spark that powered your bench." },
    ],
  },
  {
    turn: 4,
    concept: "Supply and Demand",
    conceptLabel: "Supply and Demand",
    title: "The Deadline Phone",
    situation:
      "It's the trade deadline. Three teams want your expiring center and his value is at an all-time high. Trade him now for picks, hold him for the playoff run, or extend him before the market sets his price.",
    choices: [
      { id: "t4-sell", label: "Trade now for picks", description: "+$10M cap · sell at the top", capImpact: 10_000_000, winsImpact: 3, sound: true, outcome: "You sold at the very top of the market — high demand, scarce supply — and restocked future assets." },
      { id: "t4-hold", label: "Hold for the playoff run", description: "$0 cap · keep him", capImpact: 0, winsImpact: 6, sound: false, outcome: "You kept your big man for the stretch run. Chemistry intact, ceiling higher — but you passed on a great return." },
      { id: "t4-extend", label: "Extend before the market sets his price", description: "−$16M cap · lock him in", capImpact: -16_000_000, winsImpact: 5, sound: false, outcome: "You locked him up below his peak price, betting demand stays high. A bold read on the market." },
    ],
  },
  {
    turn: 5,
    concept: "Market Failure",
    conceptLabel: "Market Failure",
    title: "The Broken Arena",
    situation:
      "Your arena's air conditioning broke and attendance dropped 20%. The repair costs $2M. You can pay it, raise ticket prices to cover it, or lobby the city for a public subsidy.",
    choices: [
      { id: "t5-pay", label: "Pay for the repair", description: "−$2M cap · fix it fast", capImpact: -2_000_000, winsImpact: 5, sound: true, outcome: "You ate the cost, fixed the root problem fast, and the fans came right back." },
      { id: "t5-raise", label: "Raise ticket prices", description: "+$3M cap · pass the cost on", capImpact: 3_000_000, winsImpact: 4, sound: false, outcome: "You covered the cost, but pushed priced-out fans away and the building felt emptier." },
      { id: "t5-subsidy", label: "Lobby the city for a subsidy", description: "+$1M cap · slow but cheap", capImpact: 1_000_000, winsImpact: 4, sound: false, outcome: "You got public help, but it took months and the optics of asking taxpayers were rough." },
    ],
  },
  {
    turn: 6,
    concept: "Externalities",
    conceptLabel: "Externalities",
    title: "Where to Build",
    situation:
      "A new practice facility in a low-income neighborhood costs $15M but brings jobs, youth programs, and goodwill. A cheaper facility in the suburbs costs $8M. Which do you build?",
    choices: [
      { id: "t6-city", label: "Build in the neighborhood", description: "−$15M cap · big goodwill", capImpact: -15_000_000, winsImpact: 5, sound: true, outcome: "Pricey, but the goodwill, jobs, and youth pipeline — positive externalities — pay off for years." },
      { id: "t6-suburb", label: "Build the cheaper suburb facility", description: "−$8M cap · save money", capImpact: -8_000_000, winsImpact: 4, sound: false, outcome: "You saved money but missed a chance to create real community value beyond the team." },
      { id: "t6-delay", label: "Delay and keep the cash", description: "$0 cap · stay flexible", capImpact: 0, winsImpact: 3, sound: false, outcome: "You stayed flexible, but your facilities fell behind the rest of the league." },
    ],
  },
  {
    turn: 7,
    concept: "Price Elasticity",
    conceptLabel: "Price Elasticity",
    title: "Pricing the Playoffs",
    situation:
      "Playoff tickets are priced at $200 and you sell 90% of seats. At $280, analysts project 70% sell-through. At $160, you sell out but leave money on the table. What do you charge?",
    choices: [
      { id: "t7-high", label: "Raise to $280", description: "+$6M cap · fewer fans", capImpact: 6_000_000, winsImpact: 4, sound: false, outcome: "Higher prices, fewer fans — but more total revenue. The crowd was quieter, though." },
      { id: "t7-hold", label: "Hold at $200", description: "+$4M cap · near-full house", capImpact: 4_000_000, winsImpact: 5, sound: true, outcome: "A near-full house and steady revenue — the balanced read on how price-sensitive your fans are." },
      { id: "t7-low", label: "Drop to $160", description: "+$2M cap · roaring sellout", capImpact: 2_000_000, winsImpact: 6, sound: false, outcome: "A roaring sellout crowd that lifted the team — but you left real money on the table." },
    ],
  },
  {
    turn: 8,
    concept: "Comparative Advantage",
    conceptLabel: "Comparative Advantage",
    title: "Draft Night",
    situation:
      "Your scout found two prospects. One is elite at a single skill and average everywhere else. The other is solid across the board. Your team is already strong at that elite skill. Who do you draft?",
    choices: [
      { id: "t8-specialist", label: "Draft the elite specialist", description: "−$3M cap · double a strength", capImpact: -3_000_000, winsImpact: 3, sound: false, outcome: "You doubled down on a strength you already had — diminishing returns on a crowded skill." },
      { id: "t8-rounded", label: "Draft the well-rounded prospect", description: "−$3M cap · fill needs", capImpact: -3_000_000, winsImpact: 6, sound: true, outcome: "You filled real needs across the roster — the smarter fit, where his value to YOU is highest." },
      { id: "t8-veteran", label: "Trade the pick for a veteran", description: "−$6M cap · proven now", capImpact: -6_000_000, winsImpact: 5, sound: false, outcome: "You went for known production now instead of upside later. Safer, but pricier." },
    ],
  },
  {
    turn: 9,
    concept: "Budget Deficit",
    conceptLabel: "Budget Deficit",
    title: "Over the Line",
    situation:
      "You're $8M over the luxury-tax threshold. You can trade a key player to get under, pay the tax and keep the roster, or restructure three contracts at the cost of future flexibility.",
    choices: [
      { id: "t9-trade", label: "Trade a key player to get under", description: "+$8M cap · close the gap", capImpact: 8_000_000, winsImpact: 3, sound: true, outcome: "You closed the deficit and ducked the tax — but weakened the roster to balance the books." },
      { id: "t9-pay", label: "Pay the tax and keep the roster", description: "−$10M cap · spend to win", capImpact: -10_000_000, winsImpact: 6, sound: false, outcome: "You kept your group together — at a steep, repeating tax bill that grows every year you stay over." },
      { id: "t9-restructure", label: "Restructure three contracts", description: "−$2M cap · borrow from the future", capImpact: -2_000_000, winsImpact: 5, sound: false, outcome: "You bought breathing room now by mortgaging future flexibility — a deficit deferred, not erased." },
    ],
  },
  {
    turn: 10,
    concept: "Long-Term vs Short-Term",
    conceptLabel: "Long-Term vs Short-Term Thinking",
    title: "The Final Call",
    situation:
      "You can trade three future first-round picks for a proven superstar and go all-in this year, or stay patient, keep your picks, and build through the draft. Make your final call.",
    choices: [
      { id: "t10-allin", label: "Trade three firsts, go all-in", description: "−$20M cap · title or bust", capImpact: -20_000_000, winsImpact: 8, sound: false, outcome: "You pushed every chip in. It's title-or-bust now, with an empty cupboard behind it." },
      { id: "t10-patient", label: "Stay patient, build through the draft", description: "+$5M cap · protect the future", capImpact: 5_000_000, winsImpact: 4, sound: false, outcome: "You protected the future and kept your flexibility — slower now, but sturdier for years." },
      { id: "t10-measured", label: "Make one measured move", description: "−$8M cap · balanced", capImpact: -8_000_000, winsImpact: 6, sound: true, outcome: "You added without emptying the cupboard — weighing this year against the next five." },
    ],
  },
];

export function getTurn(turn: number): SimTurn | null {
  return SIM_TURNS.find((t) => t.turn === turn) ?? null;
}

export function getChoice(turn: number, choiceId: string): SimChoice | null {
  return getTurn(turn)?.choices.find((c) => c.id === choiceId) ?? null;
}

/** A single resolved decision, stored in the simulation's decisions JSON. */
export interface SimDecision {
  turn: number;
  choiceId: string;
  label: string;
  concept: string;
  conceptLabel: string;
  capImpact: number;
  winsImpact: number;
  outcome: string;
  sound: boolean;
  capAfter: number;
  winsAfter: number;
  lossesAfter: number;
}

export interface SimPattern {
  key: "aggressive" | "conservative" | "balanced";
  name: string;
  feedback: string;
}

export interface SimReport {
  wins: number;
  losses: number;
  record: string;
  finalCap: number;
  totalWins: number;
  gmScore: number;
  grade: string;
  pattern: SimPattern;
  conceptsApplied: { concept: string; sound: boolean }[];
}

/** Serializable simulation state shared by the store, actions, page, and client. */
export interface SimState {
  id: string;
  turn: number;
  capSpace: number;
  wins: number;
  losses: number;
  record: string;
  completed: boolean;
  finalScore: number | null;
  decisions: SimDecision[];
}

/** Result shape returned by the simulation server actions. */
export interface SimActionResult {
  ok: boolean;
  error?: "locked" | "no-sim" | "bad-choice" | "done";
  state?: SimState;
  /** The decision just resolved (for the outcome panel). */
  justResolved?: SimDecision;
  /** Present once the simulation completes. */
  report?: SimReport;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Format a signed dollar figure, e.g. -35000000 -> "−$35.0M". */
export function fmtCap(n: number): string {
  const sign = n < 0 ? "−" : "";
  const m = Math.abs(n) / 1_000_000;
  return `${sign}$${m.toFixed(m % 1 === 0 ? 0 : 1)}M`;
}

function patternFor(netSpend: number): SimPattern {
  if (netSpend <= -40_000_000) {
    return {
      key: "aggressive",
      name: "Aggressive Spender",
      feedback:
        "You played to win now, again and again — spending cap space and future flexibility to raise your ceiling today. That can deliver a title window, but an aggressive GM lives one bad season from a cap crunch. The best spenders make sure the wins they buy are worth every dollar they give up.",
    };
  }
  if (netSpend >= 8_000_000) {
    return {
      key: "conservative",
      name: "Conservative Builder",
      feedback:
        "You guarded your cap space and your future like a hawk, banking flexibility instead of chasing every win. That patience compounds — clean books let you pounce when the right deal appears. The risk is standing pat too long: at some point, flexibility only matters if you eventually spend it to win.",
    };
  }
  return {
    key: "balanced",
    name: "Balanced Strategist",
    feedback:
      "You walked the hardest line in a front office — taking your shots without burning the cupboard. You stayed competitive while keeping doors open, weighing each win against what it cost. Keep pressure-testing whether 'balanced' is genuinely optimal, or just comfortable — sometimes the right call is to be boldly wrong in one direction.",
  };
}

/** Grade a finished simulation from its decisions. */
export function gradeSimulation(decisions: SimDecision[]): SimReport {
  const totalWins = decisions.reduce((s, d) => s + d.winsImpact, 0);
  const losses = decisions.length * GAMES_PER_TURN - totalWins;
  const netSpend = decisions.reduce((s, d) => s + d.capImpact, 0);
  const finalCap = START_CAP + netSpend;

  // Efficiency: 65% how many games you won, 35% how healthy your cap stayed.
  const winPct = clamp((totalWins - 30) / 30, 0, 1);
  const capHealth = clamp((finalCap + 25_000_000) / 50_000_000, 0, 1);
  const gmScore = Math.round((winPct * 0.65 + capHealth * 0.35) * 100);
  const grade = gmScore >= 85 ? "A" : gmScore >= 70 ? "B" : gmScore >= 55 ? "C" : gmScore >= 40 ? "D" : "F";

  return {
    wins: totalWins,
    losses,
    record: `${totalWins}-${losses}`,
    finalCap,
    totalWins,
    gmScore,
    grade,
    pattern: patternFor(netSpend),
    conceptsApplied: decisions.map((d) => ({ concept: d.concept, sound: d.sound })),
  };
}
