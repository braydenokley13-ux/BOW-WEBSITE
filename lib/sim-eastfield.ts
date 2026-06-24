/* ============================================================
 * The Front Office (Feature 2) — Eastfield Eagles simulation.
 *
 * The Track 201 counterpart to the Westbrook Wolves sim. The student is
 * the newly hired GM of a struggling franchise and inherits a messy cap
 * situation, fixing it over 8 turns. Each turn teaches a Track 201
 * concept explicitly (Bird Rights, the MLE, the luxury tax, market size,
 * analytics, roster windows, pick value, surplus value).
 *
 * PURE content + grading (no DB, client-safe). Reuses the SimChoice /
 * SimTurn / SimDecision shapes from lib/sim-game.ts. The server store
 * and actions keep outcomes server-authoritative.
 * ============================================================ */

import { GAMES_PER_TURN, type SimChoice, type SimTurn, type SimDecision } from "@/lib/sim-game";

export const EASTFIELD_TEAM = "Eastfield Eagles";
/** The simulations.sim_type value for this game. */
export const TRACK_201_SIM_TYPE = "eastfield";
/** The Eagles inherit a messy book — they start over the cap. */
export const START_CAP_EASTFIELD = -5_000_000;
export const TOTAL_TURNS_EASTFIELD = 8;

export const EASTFIELD_TURNS: SimTurn[] = [
  {
    turn: 1,
    concept: "Bird Rights",
    conceptLabel: "Bird Rights",
    title: "Keep the Franchise Guard?",
    situation:
      "Your star guard has been with the team for three years and wants a max extension. The problem: signing him will put you $12M over the cap. However, because he's been here three years, you have his Bird Rights. Do you use Bird Rights to sign him over the cap, trade him while his value is high, or let him walk and get nothing?",
    choices: [
      { id: "ef1-bird", label: "Use Bird Rights to re-sign him", description: "−$12M cap · keep your star", capImpact: -12_000_000, winsImpact: 6, sound: true, outcome: "Bird Rights let you go over the cap to keep the player you developed — exactly what they're for. The franchise has its face, and you paid a price only you were allowed to pay." },
      { id: "ef1-trade", label: "Trade him at peak value", description: "+$10M cap · sell high", capImpact: 10_000_000, winsImpact: 3, sound: false, outcome: "You banked real assets and cap relief, but you gave away the one player your Bird Rights let you keep cheaper than anyone else could." },
      { id: "ef1-walk", label: "Let him walk for nothing", description: "+$5M cap · start over", capImpact: 5_000_000, winsImpact: 1, sound: false, outcome: "You kept your cap clean, but got nothing back for a player you held the richest rights to. The fan base is furious." },
    ],
  },
  {
    turn: 2,
    concept: "Mid-Level Exception",
    conceptLabel: "Mid-Level Exception",
    title: "Filling the Middle",
    situation:
      "You're $8M over the cap and need a backup center. You can't use cap space. You have the full Mid-Level Exception ($12M). A solid backup wants $10M. A cheaper option wants $5M. Do you use the full MLE on the better player, use part of the MLE on the cheaper player and save flexibility, or waive a player to create cap space instead?",
    choices: [
      { id: "ef2-full", label: "Spend the full MLE on the better center", description: "−$10M cap · best player", capImpact: -10_000_000, winsImpact: 5, sound: false, outcome: "You got the better player, but you spent your whole exception and triggered a hard cap — no more flexibility for the rest of the year." },
      { id: "ef2-part", label: "Use part of the MLE, keep flexibility", description: "−$5M cap · stay nimble", capImpact: -5_000_000, winsImpact: 4, sound: true, outcome: "You filled the hole with the MLE without emptying it — a smart use of an over-cap team's most important tool, and you kept room to maneuver at the deadline." },
      { id: "ef2-waive", label: "Waive a player for cap space", description: "+$3M cap · lose depth", capImpact: 3_000_000, winsImpact: 2, sound: false, outcome: "You opened a little room, but cut a rotation player to do it — and the MLE existed precisely so you wouldn't have to." },
    ],
  },
  {
    turn: 3,
    concept: "Luxury Tax",
    conceptLabel: "Luxury Tax",
    title: "Over the Line, On Purpose",
    situation:
      "Your payroll is sitting at $4M below the luxury tax line. You have a chance to trade for an All-Star who would cost $6M — pushing you $2M into the tax. Ownership says they'll pay it. Do you make the trade and pay the tax, pass on the trade to stay under, or try to find a cheaper alternative?",
    choices: [
      { id: "ef3-trade", label: "Make the trade and pay the tax", description: "−$6M cap · win now", capImpact: -6_000_000, winsImpact: 6, sound: true, outcome: "An All-Star for a $2M tax bill ownership already approved is great value. You take the wins — the marginal cost is small and the marginal win is huge." },
      { id: "ef3-pass", label: "Pass to stay under the line", description: "$0 cap · stay clean", capImpact: 0, winsImpact: 2, sound: false, outcome: "You stayed out of the tax, but passed on an All-Star for a tax bill the owner had already agreed to eat. Discipline can become timidity." },
      { id: "ef3-cheap", label: "Chase a cheaper alternative", description: "−$3M cap · compromise", capImpact: -3_000_000, winsImpact: 4, sound: false, outcome: "You added a lesser player to dodge the tax. You saved a little money and gave up real production you could have had." },
    ],
  },
  {
    turn: 4,
    concept: "Market Size Economics",
    conceptLabel: "Market Size Economics",
    title: "Small Market, Big Pitch",
    situation:
      "Your team plays in a small market. A star free agent chooses between you and a large-market team for the same salary. You can offer a sign-and-trade that gives him $15M more in total value. Do you offer the sign-and-trade, let him walk and save the money, or offer a shorter deal to give him flexibility?",
    choices: [
      { id: "ef4-sandt", label: "Offer the sign-and-trade for more total value", description: "−$15M cap · close the gap", capImpact: -15_000_000, winsImpact: 6, sound: true, outcome: "A small market can't out-glamour a big one, so you out-offer it. The extra total value is the lever you have — and you pulled it to land a star you'd otherwise lose." },
      { id: "ef4-walk", label: "Let him walk and save the money", description: "+$8M cap · stay flexible", capImpact: 8_000_000, winsImpact: 1, sound: false, outcome: "You kept your cap, but a small-market team that won't spend its one advantage — more total money — doesn't keep stars." },
      { id: "ef4-short", label: "Offer a shorter deal for flexibility", description: "−$7M cap · hedge", capImpact: -7_000_000, winsImpact: 4, sound: false, outcome: "A shorter deal is a reasonable hedge, but it gave the big market the opening to offer security you didn't. You may be re-recruiting him in two years." },
    ],
  },
  {
    turn: 5,
    concept: "Analytics and Market Inefficiency",
    conceptLabel: "Analytics and Market Inefficiency",
    title: "Trust the Numbers?",
    situation:
      "Your scout says your starting shooting guard has great traditional stats (20 PPG) but poor advanced metrics — he shoots too many bad shots and has a negative defensive impact. A cheaper free agent has mediocre traditional stats but excellent advanced metrics. Do you re-sign your existing player, let him go and sign the analytics darling, or keep both and reduce their minutes?",
    choices: [
      { id: "ef5-analytics", label: "Sign the analytics darling", description: "−$5M cap · find the edge", capImpact: -5_000_000, winsImpact: 6, sound: true, outcome: "You paid for value the market hasn't priced yet — the whole point of analytics. Cheaper player, better real impact. That's how a small budget beats a big one." },
      { id: "ef5-resign", label: "Re-sign the 20-PPG scorer", description: "−$12M cap · buy the box score", capImpact: -12_000_000, winsImpact: 4, sound: false, outcome: "You paid up for points everyone can see and ignored the impact only the numbers show. That's exactly the inefficiency a smarter team exploits against you." },
      { id: "ef5-both", label: "Keep both, split the minutes", description: "−$15M cap · hedge", capImpact: -15_000_000, winsImpact: 5, sound: false, outcome: "You avoided choosing — and paid full price for two players to do one job. The cap sheet, not the rotation, takes the hit." },
    ],
  },
  {
    turn: 6,
    concept: "Roster Window Theory",
    conceptLabel: "Roster Window Theory",
    title: "Read the Window",
    situation:
      "Your two stars are both 29. Their rookie deals expired two years ago and they're both on max contracts. Your team is 42-40 — good but not a contender. The window is closing. Do you make an aggressive trade for a third star (costs three future firsts), stay the course and hope to improve organically, or begin trading veterans for young players and picks?",
    choices: [
      { id: "ef6-reset", label: "Trade veterans for young players and picks", description: "+$9M cap · reset the window", capImpact: 9_000_000, winsImpact: 2, sound: true, outcome: "Your stars are on max deals with no surplus value and you're not a real contender — the cheap window already closed. Resetting now, while the vets still have value, is the disciplined call." },
      { id: "ef6-allin", label: "Trade three firsts for a third star", description: "−$6M cap · push all-in", capImpact: -6_000_000, winsImpact: 6, sound: false, outcome: "You mortgaged three drafts to chase a ceiling on a 42-40 team. If it doesn't end in a banner, you've got no stars on cheap deals and no picks to rebuild with." },
      { id: "ef6-stay", label: "Stay the course, improve organically", description: "$0 cap · hope", capImpact: 0, winsImpact: 4, sound: false, outcome: "You ran it back. Continuity has value, but maxed-out stars don't get cheaper and a .500 team rarely improves by standing still." },
    ],
  },
  {
    turn: 7,
    concept: "Pick Value and Uncertainty",
    conceptLabel: "Pick Value and Uncertainty",
    title: "The Deadline Trade",
    situation:
      "The trade deadline hits. A contender offers you their 2026 first-round pick (projected 25th) and their 2028 first (unprotected) for your expiring veteran. Another team offers you a top-10 protected 2026 first only. Which trade do you take?",
    choices: [
      { id: "ef7-two", label: "Take the 25th + the unprotected 2028 first", description: "+$6M cap · two shots", capImpact: 6_000_000, winsImpact: 1, sound: true, outcome: "Two picks beat one, and an unprotected pick four years out carries real upside — if that contender ages or declines, it could land far higher than 25th. You bought uncertainty that breaks in your favor." },
      { id: "ef7-protected", label: "Take the single top-10 protected 2026 first", description: "+$6M cap · one safe-ish pick", capImpact: 6_000_000, winsImpact: 1, sound: false, outcome: "Protection caps your downside, but it also caps your count: one conditional pick versus two, including an unprotected long-term swing. You took the smaller expected value." },
      { id: "ef7-keep", label: "Keep the veteran for your own run", description: "$0 cap · no return", capImpact: 0, winsImpact: 3, sound: false, outcome: "You held a player you weren't re-signing instead of converting him into future value. Expiring veterans on a non-contender are assets — you let one expire for nothing." },
    ],
  },
  {
    turn: 8,
    concept: "Surplus Value and Risk",
    conceptLabel: "Surplus Value and Risk",
    title: "Draft Night, Pick No. 3",
    situation:
      "You have the 3rd pick in the upcoming draft. Analytics project three players closely. Player A is a safe pick — a solid starter, probably worth $15M on the open market. Player B has higher upside — potentially a $30M player — but higher bust risk. Player C is an international player with a buyout clause, meaning you won't get him for two years. Who do you draft?",
    choices: [
      { id: "ef8-upside", label: "Draft Player B — the high-upside swing", description: "−$3M cap · chase surplus", capImpact: -3_000_000, winsImpact: 5, sound: true, outcome: "At pick 3 on a cheap rookie deal, the expected surplus value of a possible $30M player dwarfs the downside. You draft for upside when the contract is this cheap — that's how rebuilds find stars." },
      { id: "ef8-safe", label: "Draft Player A — the safe starter", description: "−$3M cap · floor over ceiling", capImpact: -3_000_000, winsImpact: 4, sound: false, outcome: "A solid starter at pick 3 is fine, but a $15M-value player on a top-3 slot is modest surplus. You took the floor and left the ceiling — and the bigger surplus — on the board." },
      { id: "ef8-intl", label: "Draft Player C — the international stash", description: "−$3M cap · delayed value", capImpact: -3_000_000, winsImpact: 2, sound: false, outcome: "Stashing a player for two years has its place, but a top-3 pick you can't use for two seasons is surplus value decayed by time — you needed help on the floor now." },
    ],
  },
];

export function getEastfieldTurn(turn: number): SimTurn | null {
  return EASTFIELD_TURNS.find((t) => t.turn === turn) ?? null;
}

export function getEastfieldChoice(turn: number, choiceId: string): SimChoice | null {
  return getEastfieldTurn(turn)?.choices.find((c) => c.id === choiceId) ?? null;
}

/** One concept's grade on the Eastfield report card. */
export interface ConceptGrade {
  concept: string;
  sound: boolean;
  grade: string;
}

export interface EastfieldReport {
  wins: number;
  losses: number;
  record: string;
  finalCap: number;
  /** 0–100 cap-efficiency score: wins earned relative to dollars spent. */
  capEfficiency: number;
  grade: string;
  /** Wins per $10M of net spend, as a display string. */
  winsPerSpend: string;
  soundCount: number;
  totalDecisions: number;
  conceptGrades: ConceptGrade[];
  feedback: string;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function feedbackFor(soundCount: number, total: number, netSpend: number): string {
  const aggressive = netSpend <= -30_000_000;
  const disciplined = netSpend >= 0;
  if (soundCount >= Math.ceil(total * 0.75)) {
    return "You ran the Eagles like a real front office — using the right tool for each situation instead of the most expensive one. You kept Bird Rights players you developed, spent exceptions without emptying them, and read your roster window honestly. The mark of a great GM isn't spending the most; it's getting the most wins per dollar. You did exactly that.";
  }
  if (soundCount >= Math.ceil(total * 0.4)) {
    return aggressive
      ? "You made some sharp calls, but you also reached for wins by spending — and a struggling franchise can't out-spend its problems. The best moves you made were the efficient ones. Lean harder on the tools (Bird Rights, the MLE, analytics-driven value) that let you compete without emptying the cap, and the wins will come cheaper."
      : "A balanced run. You got several decisions right and stayed reasonably disciplined, but you left value on the table on the calls you missed. Revisit where you passed on efficient wins — an All-Star for a small tax bill, a cheaper analytics darling — and you'll squeeze more out of the same dollars next time.";
  }
  return disciplined
    ? "You guarded the cap, but a front office that never spends its advantages doesn't win either. You passed on efficient wins — keeping a Bird Rights star, taking an All-Star for a tiny tax bill, betting on undervalued talent. Flexibility only matters if you eventually use it. Be bolder where the math says the win is worth the cost."
    : "You spent like the cap didn't exist and reached for box-score names over real value. A struggling franchise has to be smarter, not richer — that's what the cap rules, the exceptions, and analytics are for. Go back through the concepts: the right tool, used at the right moment, wins more games per dollar than the biggest checkbook.";
}

/** Grade a finished Eastfield run from its decisions. */
export function gradeEastfield(decisions: SimDecision[]): EastfieldReport {
  const totalWins = decisions.reduce((s, d) => s + d.winsImpact, 0);
  const losses = decisions.length * GAMES_PER_TURN - totalWins;
  const netSpend = decisions.reduce((s, d) => s + d.capImpact, 0);
  const finalCap = START_CAP_EASTFIELD + netSpend;
  const soundCount = decisions.filter((d) => d.sound).length;

  // Cap efficiency = wins earned (60%) blended with how disciplined the spend
  // stayed (40%). A GM who wins with a healthy cap scores highest.
  const winComponent = clamp(totalWins / 36, 0, 1); // ~36 wins in a 64-game stretch is strong
  const dollarsSpent = Math.max(0, -netSpend);
  const spendComponent = 1 - clamp(dollarsSpent / 60_000_000, 0, 1);
  const capEfficiency = Math.round((winComponent * 0.6 + spendComponent * 0.4) * 100);
  const grade = capEfficiency >= 85 ? "A" : capEfficiency >= 70 ? "B" : capEfficiency >= 55 ? "C" : capEfficiency >= 40 ? "D" : "F";

  const spentM = Math.max(0, dollarsSpent / 10_000_000);
  const winsPerSpend = spentM > 0 ? (totalWins / spentM).toFixed(1) : "∞";

  return {
    wins: totalWins,
    losses,
    record: `${totalWins}-${losses}`,
    finalCap,
    capEfficiency,
    grade,
    winsPerSpend,
    soundCount,
    totalDecisions: decisions.length,
    conceptGrades: decisions.map((d) => ({ concept: d.conceptLabel, sound: d.sound, grade: d.sound ? "A" : "C" })),
    feedback: feedbackFor(soundCount, decisions.length, netSpend),
  };
}
