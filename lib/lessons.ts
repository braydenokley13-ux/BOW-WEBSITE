/* ============================================================
 * Lesson dataset — ported faithfully from the prototype's
 * `allLessons()` (single source of truth for the curriculum
 * explorer, the lesson detail page, and the Home featured cards).
 * ============================================================ */

export type LessonStatus = "available" | "pilot" | "coming-soon" | "in-development";
export type SimulationStatus = "available" | "pilot" | "coming-soon" | "in-development";

export type Tone = "positive" | "warning" | "negative" | "info";

export interface NeedToKnow {
  term: string;
  body: string;
}

export interface DecisionOptionData {
  label: string;
  detail?: string;
}

export interface Stakeholder {
  name: string;
  interest: string;
  concern: string;
  conflict?: string;
}

export interface Evidence {
  label: string;
  value: string;
  note?: string;
  kind?: string;
  tone?: Tone;
}

export interface LearningOutcome {
  concept: string;
  means?: string;
  appears?: string;
  use: string;
}

export interface Lesson {
  id: string;
  slug: string;
  track: string;
  trackLabel: string;
  moduleNumber: number;
  lessonNumber: number;
  moduleTitle: string;
  moduleTheme: string;
  gradeBand: string;
  caseNumber: string;
  bigNum: string;
  title: string;
  shortTitle: string;
  experienceType: string;
  duration: string;
  status: LessonStatus;
  simulationStatus: SimulationStatus;
  simulationUrl: string | null;
  legacyRoute: string | null;
  overview: string;
  summary: string;
  centralQuestion: string;
  decisionPrompt?: string;
  role: string;
  deadline: string;
  concepts: string[];
  podcastEpisode: string | null;
  podcastTitle: string | null;
  podcastUrl: string | null;
  situation: string[];
  needToKnow: NeedToKnow[];
  decisionOptions: DecisionOptionData[];
  stakeholders: Stakeholder[];
  evidence: Evidence[];
  learningOutcomes: LearningOutcome[];
  discussionQuestions: string[];
  relatedLessons: string[];
}

export interface StatusMeta {
  label: string;
  badge: "positive" | "warning" | "info" | "neutral";
  sim: string;
}

/** STATUS_META — status → display label, badge tone, and simulation shorthand. */
export const LESSON_STATUS_META: Record<LessonStatus, StatusMeta> = {
  available: { label: "Available", badge: "positive", sim: "Ready" },
  pilot: { label: "Pilot", badge: "warning", sim: "Beta" },
  "coming-soon": { label: "Coming Soon", badge: "info", sim: "Soon" },
  "in-development": { label: "In Development", badge: "neutral", sim: "TBD" },
};

/** The flagship cases — pinned to the top of the explorer grid. */
export const FLAGSHIP_LESSON_IDS = ["t101-m2-l1", "t101-m4-l2", "t201-m2-l3"];

/** The featured / hero case shown above the explorer grid. */
export const FEATURED_LESSON_ID = "t101-m2-l1";

interface TrackMeta {
  label: string;
  grade: string;
  mods: Record<number, [string, string]>;
}

const TRACK_META: Record<string, TrackMeta> = {
  "101": {
    label: "Track 101",
    grade: "Grades 5–6",
    mods: {
      1: ["The Economics of Winning", "Why every decision has a cost"],
      2: ["Building the Roster", "Turning constraints into a team"],
      3: ["The Money Behind the Game", "How the cap really works"],
      4: ["Owning the Franchise", "The business above the bench"],
    },
  },
  "201": {
    label: "Track 201",
    grade: "Grades 7–8",
    mods: {
      1: ["Cap Management & Tradeoffs", "Where flexibility is won and lost"],
      2: ["Money in Motion", "Where the money actually comes from"],
      3: ["Analytics in Action", "Turning numbers into decisions"],
      4: ["Draft Strategy & Surplus Value", "Building the future on a clock"],
    },
  },
};

/** slug = slugify(shortTitle || title). */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

type LessonInput = Partial<
  Omit<Lesson, "id" | "slug" | "track" | "trackLabel" | "moduleNumber" | "lessonNumber" | "moduleTitle" | "moduleTheme" | "gradeBand" | "caseNumber" | "bigNum" | "shortTitle">
> & {
  title: string;
  shortTitle?: string;
};

function mk(track: string, mod: number, les: number, o: LessonInput): Lesson {
  const m = TRACK_META[track];
  const shortTitle = o.shortTitle || o.title;
  const base: Lesson = {
    id: `t${track}-m${mod}-l${les}`,
    slug: slugify(shortTitle),
    track,
    trackLabel: m.label,
    moduleNumber: mod,
    lessonNumber: les,
    moduleTitle: m.mods[mod][0],
    moduleTheme: m.mods[mod][1],
    gradeBand: m.grade,
    caseNumber: `CASE ${track} · ${String(mod).padStart(2, "0")}${String(les).padStart(2, "0")}`,
    bigNum: `${mod}${String(les).padStart(2, "0")}`,
    title: o.title,
    shortTitle,
    experienceType: o.experienceType ?? "",
    duration: o.duration ?? "",
    status: "available",
    simulationStatus: "coming-soon",
    simulationUrl: null,
    legacyRoute: null,
    overview: o.overview ?? "",
    summary: o.summary ?? "",
    centralQuestion: o.centralQuestion ?? "",
    decisionPrompt: o.decisionPrompt,
    role: o.role ?? "",
    deadline: o.deadline ?? "",
    podcastEpisode: null,
    podcastTitle: null,
    podcastUrl: null,
    concepts: [],
    situation: [],
    needToKnow: [],
    decisionOptions: [],
    stakeholders: [],
    evidence: [],
    learningOutcomes: [],
    discussionQuestions: [],
    relatedLessons: [],
  };
  // `o` cannot contain id/slug/shortTitle (Omitted from LessonInput); `title`
  // and `shortTitle` are already set on `base`, so a plain merge is safe.
  return { ...base, ...o, shortTitle };
}

export const lessons: Lesson[] = [
  // ===================== TRACK 101 =====================
  mk("101", 1, 1, {
    title: "Scarcity in the Standings",
    experienceType: "Strategy",
    duration: "12 min",
    status: "available",
    overview: "Why you can’t have everything, and how to choose.",
    summary: "Choose which roster need to fund when you can’t fund them all.",
    centralQuestion: "Every team wants everything. Which one thing do you buy first?",
    role: "General Manager",
    deadline: "Roster decisions due before camp opens",
    concepts: ["Scarcity", "Opportunity Cost"],
    podcastEpisode: "EP 02",
    podcastTitle: "Are Superteams Bad Economics?",
    situation: [
      "You inherit a roster with more needs than money. Shooting, defense, and depth are all real problems — and you can only seriously address one before the season starts.",
    ],
    needToKnow: [
      { term: "Scarcity", body: "Resources are limited; wants are not. Every front office runs into the wall between what it needs and what it can pay for." },
      { term: "Ranking needs", body: "When you can’t fix everything, the skill is ordering problems by how much each one is costing you in wins." },
    ],
    decisionOptions: [
      { label: "Fix the biggest weakness", detail: "Spend on the position hurting you most right now." },
      { label: "Buy the best available value", detail: "Take the bargain even if it isn’t your top need." },
    ],
    stakeholders: [
      { name: "Head Coach", interest: "Wants the roster hole that loses games fixed first.", concern: "Fears another season coaching around the same gap." },
      { name: "Ownership", interest: "Wants wins without overspending.", concern: "Skeptical of paying up for a partial fix." },
    ],
    evidence: [
      { label: "Cap Space", value: "$14M", note: "All you have to work with", kind: "currency" },
      { label: "Roster Holes", value: "3", note: "Shooting · defense · depth", tone: "warning" },
      { label: "Last Season", value: "11th", note: "Out of the playoff picture" },
    ],
    learningOutcomes: [
      { concept: "Scarcity", use: "Recognize that the limit, not the wish list, drives the decision." },
      { concept: "Opportunity Cost", use: "See what fixing one hole forces you to leave broken." },
    ],
    discussionQuestions: ["Which need did you fund, and what did you knowingly leave unsolved?", "How would your choice change with twice the budget?"],
    relatedLessons: ["t101-m1-l2", "t101-m2-l1"],
  }),
  mk("101", 1, 2, {
    title: "Opportunity Cost, in Trades",
    experienceType: "Strategy",
    duration: "14 min",
    status: "available",
    simulationStatus: "available",
    simulationUrl: "/simulation",
    legacyRoute: "lesson",
    overview: "Every yes is a no somewhere else on the roster.",
    summary: "Trade a cheap young asset for a win-now star — or hold.",
    centralQuestion: "Win sooner, or keep the asset everyone wants?",
    role: "General Manager",
    deadline: "The contender wants an answer in 24 hours",
    concepts: ["Opportunity Cost", "Asset Value", "Competitive Window"],
    podcastEpisode: "EP 04",
    podcastTitle: "Opportunity Cost, Explained in Trades",
    situation: [
      "A title contender offers a 31-year-old All-Star for your 22-year-old wing and a future first. You can win sooner — but you’d spend the one asset every other GM is calling about.",
    ],
    learningOutcomes: [
      { concept: "Opportunity Cost", use: "Price the deal you don’t make, not just the one you do." },
      { concept: "Asset Value", use: "Weigh a cheap, improving player against an expensive sure thing." },
    ],
    discussionQuestions: ["What did your trade make impossible later?", "Whose decline curve mattered most to your call?"],
    relatedLessons: ["t101-m1-l1", "t101-m2-l1", "t101-m3-l2"],
  }),
  mk("101", 1, 3, {
    title: "The Value of a Win",
    experienceType: "Budgeting",
    duration: "13 min",
    status: "available",
    overview: "What a single win is actually worth to a franchise.",
    summary: "Decide what one more win is worth paying for.",
    centralQuestion: "When does the next win stop being worth the price?",
    role: "Team President",
    deadline: "Budget locks at the deadline",
    concepts: ["Marginal Value", "Diminishing Returns"],
    podcastEpisode: "EP 05",
    podcastTitle: "Who Really Pays When a Team Wins?",
    situation: [
      "You’re a borderline playoff team. A deadline addition could buy you three more wins — at a steep price. You have to decide what those wins are actually worth.",
    ],
    needToKnow: [
      { term: "Marginal value", body: "The worth of the next unit — here, the next win — not the average across the season." },
      { term: "Diminishing returns", body: "Each added win usually costs more than the last as you climb the standings." },
    ],
    decisionOptions: [
      { label: "Pay for the wins now", detail: "Buy the upgrade and push for the postseason." },
      { label: "Hold the budget", detail: "Decide the marginal wins aren’t worth the price." },
    ],
    stakeholders: [
      { name: "Fans", interest: "Want to make the playoffs this year.", concern: 'Tired of "next year" promises.' },
      { name: "Owner", interest: "Wants return on every dollar spent.", concern: "Three wins may not move the needle on revenue." },
    ],
    evidence: [
      { label: "Cost / Win", value: "$6.2M", note: "Price of the deadline upgrade", kind: "currency", tone: "warning" },
      { label: "Playoff Odds", value: "+9%", note: "If you add the wins", tone: "positive" },
    ],
    learningOutcomes: [
      { concept: "Marginal Value", use: "Judge the next win on its own price, not the season average." },
      { concept: "Diminishing Returns", use: "Notice when more spending buys fewer wins." },
    ],
    discussionQuestions: ["At what price per win would you walk away?", "Does a playoff berth change the math? Why?"],
    relatedLessons: ["t101-m1-l1", "t101-m4-l1"],
  }),
  mk("101", 2, 1, {
    title: "You’re the GM",
    shortTitle: "You’re the GM",
    experienceType: "Roster Building",
    duration: "16 min",
    status: "available",
    overview: "One roster, several holes, and not enough money to fix them all.",
    summary: "Allocate a limited budget across competing roster needs.",
    centralQuestion: "You have one budget and four problems. Which one do you actually fix?",
    decisionPrompt:
      "Your roster has real weaknesses at three positions and a veteran asking for an extension. You have $38M in space and one summer. You can’t fix everything — where does the money go?",
    role: "General Manager",
    deadline: "Free agency opens in 72 hours",
    concepts: ["Scarcity", "Opportunity Cost", "Marginal Value", "Budget Allocation"],
    podcastEpisode: "EP 06",
    podcastTitle: "Stars, Role Players, and the Math of a Contender",
    situation: [
      "You took over a team that wins just enough to disappoint. The core is fine. The supporting cast is not. Your scouts have handed you a board full of names and a budget that covers maybe a third of them.",
      "The fan base wants a star. The coach wants depth. The analytics group wants you to save your money for a cleaner opportunity next summer. All three arguments are good. None of them fits inside $38M at once.",
      "In 72 hours free agency opens and the money moves fast. Whatever you don’t spend on one need is a need you’ve decided to live with.",
    ],
    needToKnow: [
      { term: "Scarcity", body: "A hard budget means every dollar spent in one place is a dollar that can’t solve a problem somewhere else." },
      { term: "Opportunity cost", body: "The real price of the star isn’t $30M — it’s the two role players and the depth you can no longer afford." },
      { term: "Marginal value", body: "A fourth starter may add more wins than a slightly better second star. Value the next addition, not the name." },
      { term: "Budget allocation", body: "Front offices win by distributing a fixed sum across needs better than rivals do — not by outspending them." },
    ],
    decisionOptions: [
      { label: "Sign one expensive star", detail: "$30M / yr — raises your ceiling, empties the rest of the budget." },
      { label: "Sign two reliable role players", detail: "$16M + $14M — fills two holes, no headline." },
      { label: "Buy depth and flexibility", detail: "Four short, cheap deals — spreads risk, keeps you nimble." },
      { label: "Save the room for next summer", detail: "Bank most of the space — bet a better chance is coming." },
    ],
    stakeholders: [
      { name: "Ownership", interest: "Wants a splashy signing that sells tickets.", concern: "Will judge you on attendance as much as wins.", conflict: "Pushes toward the star the analytics group warns against." },
      { name: "Head Coach", interest: "Wants a deeper, more reliable rotation.", concern: "Has lost games all year to a thin bench.", conflict: "Prefers role players over a single max contract." },
      { name: "The Veteran", interest: "Wants the extension and a real chance to win.", concern: "Sees his window closing.", conflict: "His extension competes with every other need on the board." },
      { name: "Analytics Group", interest: "Wants you to spend only on clear surplus value.", concern: "Believes this free-agent class is overpriced.", conflict: "Recommends saving — the least popular option in the building." },
      { name: "Fans", interest: "Want a recognizable name to believe in.", concern: 'Will read "patience" as "cheap."', conflict: "Their patience is the resource you spend if you wait." },
    ],
    evidence: [
      { label: "Cap Space", value: "$38.0M", note: "Total available this summer", kind: "currency" },
      { label: "Star Asking", value: "$30M/yr", note: "4-year demand", kind: "currency", tone: "warning" },
      { label: "Bench Scoring", value: "27th", note: "League rank — your biggest hole", tone: "negative" },
      { label: "Role Player Cost", value: "~$15M", note: "Each, on shorter deals", kind: "currency" },
      { label: "Projected Wins", value: "41", note: "If you stand pat" },
      { label: "Owner Patience", value: "1 yr", note: "Before the seat gets hot", tone: "warning" },
    ],
    learningOutcomes: [
      { concept: "Scarcity", means: "Limited resources against unlimited needs.", appears: "A $38M budget can’t cover a board worth three times that.", use: "Force-rank needs instead of pretending you can meet them all." },
      { concept: "Opportunity Cost", means: "The value of the best option you give up.", appears: "The star costs you the two role players you didn’t sign.", use: "Name what each signing makes impossible before you commit." },
      { concept: "Marginal Value", means: "The added wins from the next move, not the average.", appears: "A fourth rotation player may add more wins than a marginal upgrade at the top.", use: "Spend where the next dollar buys the most production." },
      { concept: "Budget Allocation", means: "Distributing a fixed sum across competing uses.", appears: "Star vs. two players vs. depth vs. saving.", use: "Defend a distribution, not just a single signing." },
    ],
    discussionQuestions: [
      "What did you choose — and what did your choice make impossible?",
      "Which piece of evidence mattered most to your decision?",
      "Who in the building benefited most from your call? Who paid the cost?",
      "What new information would have changed your answer?",
      "If your owner asked you to defend the plan in one sentence, what would you say?",
    ],
    relatedLessons: ["t101-m2-l2", "t101-m3-l2", "t201-m2-l3"],
  }),
  mk("101", 2, 2, {
    title: "One Spot, Three Options",
    experienceType: "Roster Building",
    duration: "14 min",
    status: "available",
    overview: "Who makes the team when the bench is full?",
    summary: "Fill the last roster spot from three good options.",
    centralQuestion: "Three good players, one open seat. Who makes the team?",
    role: "General Manager",
    deadline: "Final cuts are tomorrow",
    concepts: ["Marginal Value", "Roster Construction"],
    podcastEpisode: "EP 06",
    podcastTitle: "Stars, Role Players, and the Math of a Contender",
    situation: [
      "Training camp is over and you have one roster spot left. Three players earned it: a sharpshooter, a defender, and a young project. Only one can stay.",
    ],
    needToKnow: [
      { term: "Marginal value", body: "Value the player against what your roster already has, not in a vacuum." },
      { term: "Roster fit", body: "The best player and the best fit are not always the same name." },
    ],
    decisionOptions: [
      { label: "Keep the specialist", detail: "Adds a skill your roster lacks today." },
      { label: "Keep the upside", detail: "Bet on the young project’s ceiling." },
    ],
    stakeholders: [
      { name: "Head Coach", interest: "Wants someone he can trust in April.", concern: "Projects don’t help him win now." },
      { name: "Player Development", interest: "Wants to keep the young upside.", concern: "Fears losing a future contributor for nothing." },
    ],
    evidence: [
      { label: "Open Spots", value: "1", note: "Final roster decision" },
      { label: "3-PT Rank", value: "24th", note: "A real team weakness", tone: "warning" },
    ],
    learningOutcomes: [
      { concept: "Marginal Value", use: "Pick the player who adds what you don’t already have." },
      { concept: "Roster Construction", use: "Balance fit, need, and upside in one call." },
    ],
    discussionQuestions: ["Did you choose need or upside — and why?", "What would change your pick a year from now?"],
    relatedLessons: ["t101-m2-l1", "t101-m1-l3"],
  }),
  mk("101", 2, 3, {
    title: "The Negotiation",
    experienceType: "Negotiation",
    duration: "16 min",
    status: "pilot",
    overview: "Sit across the table and find the number.",
    summary: "Find the contract number both sides can live with.",
    centralQuestion: "Both sides have leverage. What’s the number?",
    role: "General Manager",
    deadline: "The agent wants a deal by Friday",
    concepts: ["Negotiation", "Leverage", "Surplus Value"],
    podcastEpisode: "EP 08",
    podcastTitle: "Why Leagues Share Revenue",
    situation: [
      "A key player is up for an extension. He wants market value; you want a bargain. Both of you can walk — but neither of you really wants to.",
    ],
    needToKnow: [
      { term: "Leverage", body: "Your power in a deal comes from your willingness and ability to walk away." },
      { term: "Surplus value", body: "A deal is good when the player produces more than the contract pays." },
    ],
    decisionOptions: [
      { label: "Offer below market", detail: "Anchor low and risk insulting the player." },
      { label: "Meet near market", detail: "Pay closer to fair value to lock him in." },
    ],
    stakeholders: [
      { name: "The Player", interest: "Wants to be paid like a star.", concern: "Fears leaving money on the table." },
      { name: "The Agent", interest: "Wants the biggest possible deal.", concern: "Reputation rides on the number." },
    ],
    evidence: [
      { label: "Market Value", value: "$24M/yr", note: "Comparable contracts", kind: "currency" },
      { label: "Your Offer", value: "$19M/yr", note: "Opening number", kind: "currency", tone: "warning" },
    ],
    learningOutcomes: [
      { concept: "Negotiation", use: "Find a number that holds against both sides’ alternatives." },
      { concept: "Leverage", use: "Read who can actually afford to walk." },
    ],
    discussionQuestions: ["Where did your leverage come from?", "What would make you walk away?"],
    relatedLessons: ["t201-m2-l2", "t101-m2-l1"],
  }),
  mk("101", 3, 1, {
    title: "What the Cap Allows",
    experienceType: "Budgeting",
    duration: "13 min",
    status: "available",
    overview: "Reading the rules that shape every move.",
    summary: "Build a legal roster inside the cap rules.",
    centralQuestion: "The rules say no. How do you still get to yes?",
    role: "Capologist",
    deadline: "Paperwork due to the league office Monday",
    concepts: ["Constraints", "Cap Mechanics"],
    podcastEpisode: "EP 07",
    podcastTitle: "The Apron Era: How One Rule Rewired the League",
    situation: [
      "You want to add a player, but the cap sheet says you’re full. The rules aren’t a wall — they’re a maze with a few legal doors.",
    ],
    needToKnow: [
      { term: "Salary cap", body: "A league-set ceiling on team payroll designed to keep competition balanced." },
      { term: "Exceptions", body: "Specific, legal ways to add salary even when you’re over the cap." },
    ],
    decisionOptions: [
      { label: "Use an exception", detail: "Add the player through a legal cap mechanism." },
      { label: "Make a trade to fit", detail: "Move salary out to create the room." },
    ],
    stakeholders: [
      { name: "League Office", interest: "Wants every deal to follow the rules.", concern: "Will void an illegal contract." },
      { name: "Head Coach", interest: "Just wants the player on the floor.", concern: "Doesn’t care how the math works." },
    ],
    evidence: [
      { label: "Over the Cap", value: "$5.1M", note: "Where you stand now", kind: "currency", tone: "negative" },
      { label: "Exception", value: "$12.4M", note: "Available to use", kind: "currency", tone: "info" },
    ],
    learningOutcomes: [
      { concept: "Constraints", use: "Treat the rules as the shape of the problem, not the end of it." },
      { concept: "Cap Mechanics", use: "Find the legal path to the roster you want." },
    ],
    discussionQuestions: ["Which rule limited you most?", "How do constraints make front offices more creative?"],
    relatedLessons: ["t201-m1-l1", "t101-m3-l2"],
  }),
  mk("101", 3, 2, {
    title: "The Apron Era",
    experienceType: "Budgeting",
    duration: "16 min",
    status: "available",
    overview: "Extend now, or protect 2027?",
    summary: "Extend the star now, or protect future flexibility.",
    centralQuestion: "Extend now, or protect 2027?",
    role: "General Manager",
    deadline: "Extension window closes at the deadline",
    concepts: ["Opportunity Cost", "Constraints"],
    podcastEpisode: "EP 07",
    podcastTitle: "The Apron Era: How One Rule Rewired the League",
    situation: [
      "Your star wants his extension now. Signing it wins games — and trips the second apron, freezing the tools you’ll need to keep building in 2027.",
    ],
    needToKnow: [
      { term: "Second apron", body: "A hard spending line that strips a team of its roster-building tools once crossed." },
      { term: "Opportunity cost", body: "The extension’s real price includes the future moves it takes off the table." },
    ],
    decisionOptions: [
      { label: "Extend now", detail: "Win sooner, lose future flexibility." },
      { label: "Wait and stay flexible", detail: "Protect 2027, risk losing the star." },
    ],
    stakeholders: [
      { name: "The Star", interest: "Wants security now.", concern: "Could feel undervalued if you wait." },
      { name: "Future Front Office", interest: "Wants tools left to build with.", concern: "Inherits a frozen cap sheet." },
    ],
    evidence: [
      { label: "Extension", value: "$45M/yr", note: "The number on the table", kind: "currency", tone: "warning" },
      { label: "Apron Penalty", value: "Frozen picks", note: "If you cross the line", tone: "negative" },
    ],
    learningOutcomes: [
      { concept: "Opportunity Cost", use: "Count the future moves the extension erases." },
      { concept: "Constraints", use: "Plan around a hard line, not just a soft budget." },
    ],
    discussionQuestions: ["What did extending cost you in 2027?", "When is losing flexibility worth it?"],
    relatedLessons: ["t101-m1-l2", "t201-m1-l3"],
  }),
  mk("101", 3, 3, {
    title: "Spending Without Winning",
    experienceType: "Budgeting",
    duration: "14 min",
    status: "coming-soon",
    overview: "When more money buys fewer wins.",
    summary: "Decide whether more payroll actually buys more wins.",
    centralQuestion: "You can spend more. Should you?",
    role: "Owner",
    deadline: "Budget review at quarter’s end",
    concepts: ["Diminishing Returns", "Marginal Cost"],
    situation: [
      "Your payroll is already among the league’s highest, and you’re still mid-pack. The instinct is to spend your way out — but the data says the next dollar buys almost nothing.",
    ],
    needToKnow: [
      { term: "Diminishing returns", body: "Past a point, each added dollar of payroll produces fewer extra wins." },
    ],
    decisionOptions: [
      { label: "Spend more anyway", detail: "Chase wins with a bigger payroll." },
      { label: "Hold and rebuild value", detail: "Stop overpaying and reset." },
    ],
    stakeholders: [
      { name: "Owner", interest: "Wants wins for the money.", concern: "Tired of paying a tax bill for mediocrity." },
      { name: "Front Office", interest: "Wants to spend smarter, not more.", concern: 'Pressure to "do something."' },
    ],
    evidence: [
      { label: "Payroll", value: "4th", note: "League rank", tone: "warning" },
      { label: "Record", value: "11th", note: "Where it gets you", tone: "negative" },
    ],
    learningOutcomes: [
      { concept: "Diminishing Returns", use: "Spot when more spending stops working." },
      { concept: "Marginal Cost", use: "Compare the cost of the next win to its value." },
    ],
    discussionQuestions: ["Why doesn’t the highest payroll win the most?", "When should an owner stop spending?"],
    relatedLessons: ["t101-m1-l3", "t201-m1-l2"],
  }),
  mk("101", 4, 1, {
    title: "Who Pays When You Win?",
    experienceType: "Revenue",
    duration: "13 min",
    status: "available",
    overview: "Fans, sponsors, and the price of success.",
    summary: "Decide who absorbs the cost of a winning season.",
    centralQuestion: "Winning isn’t free. Who pays for it?",
    role: "Chief Revenue Officer",
    deadline: "Pricing set before season tickets renew",
    concepts: ["Revenue", "Incentives"],
    podcastEpisode: "EP 05",
    podcastTitle: "Who Really Pays When a Team Wins?",
    situation: [
      "A winning team costs more to run — higher payroll, higher taxes. Someone has to cover it: fans through prices, sponsors through deals, or ownership through margin.",
    ],
    needToKnow: [
      { term: "Revenue streams", body: "Tickets, media, sponsorship, and concessions each fund the team differently." },
      { term: "Incentives", body: "Each payer responds differently to winning — and to being asked to pay for it." },
    ],
    decisionOptions: [
      { label: "Raise ticket prices", detail: "Fans fund the success directly." },
      { label: "Lean on sponsors", detail: "Sell winning to corporate partners." },
    ],
    stakeholders: [
      { name: "Fans", interest: "Want a winner at a fair price.", concern: "Feel punished for the team’s success." },
      { name: "Sponsors", interest: "Want association with a winner.", concern: "Won’t overpay for one good year." },
    ],
    evidence: [
      { label: "Cost to Win", value: "+$28M", note: "Payroll + tax", kind: "currency", tone: "warning" },
      { label: "Ticket Demand", value: "+18%", note: "After making the playoffs", tone: "positive" },
    ],
    learningOutcomes: [
      { concept: "Revenue", use: "Map who funds the team and how." },
      { concept: "Incentives", use: "Predict how each payer reacts to winning." },
    ],
    discussionQuestions: ["Who should pay for a winning team?", "What happens if fans feel exploited?"],
    relatedLessons: ["t101-m4-l2", "t101-m1-l3"],
  }),
  mk("101", 4, 2, {
    title: "The Price of a Seat",
    shortTitle: "The Price of a Seat",
    experienceType: "Pricing",
    duration: "16 min",
    status: "available",
    overview: "Demand is uneven. Your pricing shouldn’t be flat.",
    summary: "Design a ticket strategy that lifts revenue without losing fans.",
    centralQuestion: "How do you charge more for the games people want — without pricing out the fans you need?",
    decisionPrompt:
      "Some nights sell out in minutes; others play to half-empty sections. You can raise revenue by pricing each game to its demand — but every increase risks the families and regulars who fill the building all season.",
    role: "Chief Revenue Officer",
    deadline: "Single-game tickets go on sale Monday",
    concepts: ["Supply & Demand", "Price Elasticity", "Price Discrimination", "Revenue Optimization", "Fan Access"],
    podcastEpisode: "EP 05",
    podcastTitle: "Who Really Pays When a Team Wins?",
    situation: [
      "Your building seats 18,000. Against the league’s marquee teams it could sell twice that; on a Tuesday in January against a rebuilding club, whole sections sit empty. One flat price leaves money on the table some nights and empties the arena on others.",
      "Ownership wants more revenue. The community-relations office wants families to keep coming. The data team has modeled a dozen pricing schemes, and every one of them helps one goal at the expense of the other.",
      "Tickets go on sale Monday. Whatever pricing you publish becomes the deal you’ve made with your fan base for the season.",
    ],
    needToKnow: [
      { term: "Supply & demand", body: "A fixed number of seats meets demand that swings wildly by opponent, day, and team performance." },
      { term: "Price elasticity", body: "How much demand drops when price rises — high for casual fans, low for die-hards and big games." },
      { term: "Price discrimination", body: "Charging different prices to different buyers (students, families, premium) to capture more total revenue." },
      { term: "Fan access", body: "Tickets aren’t only revenue — they’re how a community stays connected to the team. Price them out and you lose more than money." },
    ],
    decisionOptions: [
      { label: "Flat pricing", detail: "One price all season — simple and fair, leaves revenue unclaimed." },
      { label: "Dynamic pricing", detail: "Prices move with live demand — maximizes revenue, can feel predatory." },
      { label: "Opponent-based tiers", detail: "Higher prices for marquee games — predictable, captures peak demand." },
      { label: "Tiers + family & student sections", detail: "Premium where demand is high, protected access where it isn’t." },
    ],
    stakeholders: [
      { name: "Ownership", interest: "Wants maximum gate revenue.", concern: "Empty seats on weak nights.", conflict: "Pushes pricing the community office calls exclusionary." },
      { name: "Season-Ticket Holders", interest: "Want value for a full-season commitment.", concern: "Resent paying more than single-game buyers.", conflict: "Dynamic pricing can undercut their loyalty." },
      { name: "Families", interest: "Want affordable nights out.", concern: "Priced out of marquee games entirely.", conflict: "Their access competes with premium revenue." },
      { name: "Community Relations", interest: "Wants the team to stay accessible.", concern: "Losing the next generation of fans.", conflict: "Argues against the highest-revenue plan." },
      { name: "Resellers", interest: "Want to profit on the gap.", concern: "Thrive when you under-price demand.", conflict: "Every dollar they capture is one you didn’t." },
    ],
    evidence: [
      { label: "Capacity", value: "18,000", note: "Seats per game" },
      { label: "Avg Ticket", value: "$54", note: "Current flat price", kind: "currency" },
      { label: "Marquee Sell-Through", value: "101%", note: "Demand exceeds supply", tone: "positive" },
      { label: "Weeknight Sell-Through", value: "58%", note: "Sections sit empty", tone: "negative" },
      { label: "Reseller Markup", value: "+140%", note: "On the games you under-price", tone: "warning" },
      { label: "Family 4-Pack", value: "$180", note: "Threshold before they stop coming", kind: "currency" },
    ],
    learningOutcomes: [
      { concept: "Supply & Demand", means: "Price is set where willingness to pay meets fixed supply.", appears: "A 18,000-seat building facing demand from 9,000 to 36,000.", use: "Match price to each night’s real demand instead of an average." },
      { concept: "Price Elasticity", means: "How sharply demand reacts to a price change.", appears: "Die-hards barely flinch; families vanish past a threshold.", use: "Raise prices where demand is inelastic, protect it where it isn’t." },
      { concept: "Price Discrimination", means: "Charging segments different prices for the same seat.", appears: "Student, family, and premium tiers in one building.", use: "Capture revenue from those who’ll pay while keeping access for those who won’t." },
      { concept: "Revenue Optimization", means: "Maximizing total intake, not the price of any one ticket.", appears: "A full building at mixed prices can beat a half-empty one at a high price.", use: "Optimize the whole season’s gate, not a single game." },
    ],
    discussionQuestions: [
      "What pricing did you choose — and who did it leave out?",
      "Which piece of demand data drove your decision?",
      "Is dynamic pricing fair to loyal fans? Why or why not?",
      "Who benefited most from your plan, and who paid the cost?",
      "What would change your strategy in a losing season?",
    ],
    relatedLessons: ["t101-m4-l1", "t101-m4-l3", "t201-m2-l1"],
  }),
  mk("101", 4, 3, {
    title: "The Long Game",
    experienceType: "Strategy",
    duration: "15 min",
    status: "pilot",
    overview: "Valuation, risk, and patience.",
    summary: "Choose patience or urgency for the franchise’s future.",
    centralQuestion: "Build for next year, or the next decade?",
    role: "Owner",
    deadline: "Five-year plan due to the board",
    concepts: ["Long-Term Value", "Risk"],
    podcastEpisode: "EP 05",
    podcastTitle: "Who Really Pays When a Team Wins?",
    situation: [
      "You own the team for the long haul. The market pushes for wins now; the smart money says build slowly. Your five-year plan has to pick a clock.",
    ],
    needToKnow: [
      { term: "Long-term value", body: "A franchise’s worth compounds over years of stability, not single seasons." },
      { term: "Risk", body: "Urgent moves raise both the ceiling and the chance of a costly miss." },
    ],
    decisionOptions: [
      { label: "Win now", detail: "Spend aggressively for immediate relevance." },
      { label: "Build patiently", detail: "Compound value over years." },
    ],
    stakeholders: [
      { name: "Owner", interest: "Wants lasting franchise value.", concern: "Market demands instant results." },
      { name: "Fans", interest: "Want to win soon.", concern: "Won’t wait forever." },
    ],
    evidence: [
      { label: "Franchise Value", value: "$3.1B", note: "Today", kind: "currency" },
      { label: "Patience Horizon", value: "5 yrs", note: "Before the plan is judged", tone: "info" },
    ],
    learningOutcomes: [
      { concept: "Long-Term Value", use: "Weigh decade-long value against this season." },
      { concept: "Risk", use: "Balance urgency against the cost of a miss." },
    ],
    discussionQuestions: ["What clock did you choose, and why?", "How do you sell patience to impatient fans?"],
    relatedLessons: ["t101-m1-l3", "t201-m2-l3"],
  }),
  // ===================== TRACK 201 =====================
  mk("201", 1, 1, {
    title: "Cap Loopholes",
    experienceType: "Budgeting",
    duration: "14 min",
    status: "available",
    overview: "Exceptions, holds, and the fine print GMs exploit.",
    summary: "Use exceptions and holds to create flexibility.",
    centralQuestion: "The cap says you’re full. Are you really?",
    role: "Capologist",
    deadline: "Roster must be cap-legal by opening night",
    concepts: ["Cap Mechanics", "Constraints"],
    podcastEpisode: "EP 07",
    podcastTitle: "The Apron Era: How One Rule Rewired the League",
    situation: [
      "On paper you’re over the cap. But cap holds, exceptions, and timing create flexibility most fans never see. The question is how far to push it.",
    ],
    needToKnow: [
      { term: "Cap holds", body: "Placeholder cap charges for free agents you intend to re-sign." },
      { term: "Exceptions", body: "Legal tools to add salary while over the cap." },
    ],
    decisionOptions: [
      { label: "Renounce holds for space", detail: "Clear room now, risk losing your own free agents." },
      { label: "Keep holds, use exceptions", detail: "Preserve your players, add at the margins." },
    ],
    stakeholders: [
      { name: "League Office", interest: "Wants compliant books.", concern: "Watches for circumvention." },
      { name: "Your Free Agents", interest: "Want to be re-signed.", concern: "Renouncing them sends a message." },
    ],
    evidence: [
      { label: "Cap Holds", value: "$22M", note: "Tied up in placeholders", kind: "currency", tone: "warning" },
      { label: "Real Space", value: "$0", note: "Until you decide", tone: "negative" },
    ],
    learningOutcomes: [
      { concept: "Cap Mechanics", use: "Turn fine print into real flexibility." },
      { concept: "Constraints", use: "Work the rules to the edge without crossing them." },
    ],
    discussionQuestions: ["What did you give up to create space?", "Where’s the line between clever and unfair?"],
    relatedLessons: ["t101-m3-l1", "t201-m1-l2"],
  }),
  mk("201", 1, 2, {
    title: "Luxury Tax",
    experienceType: "Budgeting",
    duration: "15 min",
    status: "available",
    overview: "When spending more buys you a steeper bill.",
    summary: "Decide whether the next signing is worth the tax bill.",
    centralQuestion: "One more player. Three times the cost. Worth it?",
    role: "Owner",
    deadline: "Sign-and-trade window closes soon",
    concepts: ["Marginal Cost", "Diminishing Returns"],
    podcastEpisode: "EP 08",
    podcastTitle: "Why Leagues Share Revenue",
    situation: [
      "You’re already over the tax line. Adding one more salary doesn’t cost his salary — it costs a steep multiple in penalties. The player is good. The bill is brutal.",
    ],
    needToKnow: [
      { term: "Luxury tax", body: "A penalty on payroll above a threshold, escalating the more you spend." },
      { term: "Marginal cost", body: "The true cost of the next signing includes the tax it triggers." },
    ],
    decisionOptions: [
      { label: "Pay the tax", detail: "Add the player and eat the multiplier." },
      { label: "Stay under", detail: "Pass to avoid the penalty." },
    ],
    stakeholders: [
      { name: "Owner", interest: "Wants wins.", concern: "The tax bill could exceed the salary." },
      { name: "Other Owners", interest: "Want competitive balance.", concern: "Resent big spenders." },
    ],
    evidence: [
      { label: "Player Salary", value: "$8M", note: "On paper", kind: "currency" },
      { label: "True Cost", value: "$26M", note: "After tax penalties", kind: "currency", tone: "negative" },
    ],
    learningOutcomes: [
      { concept: "Marginal Cost", use: "Count the penalty, not just the salary." },
      { concept: "Diminishing Returns", use: "Judge whether the win is worth the multiplier." },
    ],
    discussionQuestions: ["Was the player worth his true cost?", "How does the tax change owner behavior?"],
    relatedLessons: ["t201-m1-l3", "t101-m3-l3"],
  }),
  mk("201", 1, 3, {
    title: "The Second Apron",
    experienceType: "Strategy",
    duration: "16 min",
    status: "available",
    overview: "Cross the line and lose the tools to fix it.",
    summary: "Weigh crossing the apron against losing your tools.",
    centralQuestion: "Cross the line and lose the tools to fix it. Do you?",
    role: "General Manager",
    deadline: "Deadline is 48 hours away",
    concepts: ["Opportunity Cost", "Constraints"],
    podcastEpisode: "EP 07",
    podcastTitle: "The Apron Era: How One Rule Rewired the League",
    situation: [
      "One more move pushes you past the second apron. It might win you a title — and it strips your ability to trade picks, aggregate salary, or use exceptions for years.",
    ],
    needToKnow: [
      { term: "Second apron", body: "A hard ceiling that removes most roster-building tools once crossed." },
      { term: "Opportunity cost", body: "The move’s price includes every future move it forbids." },
    ],
    decisionOptions: [
      { label: "Cross the apron", detail: "Go all-in now, lose flexibility for years." },
      { label: "Stay below", detail: "Keep your tools, settle for less now." },
    ],
    stakeholders: [
      { name: "Ownership", interest: "Wants a title.", concern: "Locked into a rigid, expensive roster." },
      { name: "Future GM", interest: "Wants tools to build with.", concern: "Inherits a frozen team." },
    ],
    evidence: [
      { label: "Apron Gap", value: "$3M", note: "How far you’d cross", kind: "currency", tone: "warning" },
      { label: "Tools Lost", value: "6", note: "Roster mechanisms frozen", tone: "negative" },
    ],
    learningOutcomes: [
      { concept: "Opportunity Cost", use: "Value the future moves you forfeit." },
      { concept: "Constraints", use: "Decide when a hard line is worth crossing." },
    ],
    discussionQuestions: ["Was the title shot worth the frozen years?", "Who pays for the decision later?"],
    relatedLessons: ["t201-m1-l2", "t101-m3-l2"],
  }),
  mk("201", 2, 1, {
    title: "The League as a Business",
    experienceType: "Revenue",
    duration: "15 min",
    status: "available",
    overview: "Shared revenue, national deals, and why rivals cooperate.",
    summary: "Vote on a revenue-sharing change that helps rivals.",
    centralQuestion: "A deal that helps the league can hurt you. Sign it?",
    role: "Team President",
    deadline: "Owners vote at the next meeting",
    concepts: ["Revenue Sharing", "Incentives"],
    podcastEpisode: "EP 08",
    podcastTitle: "Why Leagues Share Revenue",
    situation: [
      "A new revenue-sharing proposal would strengthen small-market rivals and the league overall — by taking a slice of your big-market money. You hold a vote.",
    ],
    needToKnow: [
      { term: "Revenue sharing", body: "Leagues redistribute money to keep weaker franchises viable and competition close." },
      { term: "Incentives", body: "What’s good for the league isn’t always good for the richest team in it." },
    ],
    decisionOptions: [
      { label: "Vote yes", detail: "Strengthen the league, share your revenue." },
      { label: "Vote no", detail: "Protect your market advantage." },
    ],
    stakeholders: [
      { name: "Small Markets", interest: "Want a viable share.", concern: "Can’t compete without help." },
      { name: "Your Ownership", interest: "Wants to keep its edge.", concern: "Funding rivals feels self-defeating." },
    ],
    evidence: [
      { label: "Your Contribution", value: "$40M", note: "Into the pool", kind: "currency", tone: "warning" },
      { label: "League Health", value: "+", note: "Stronger overall product", tone: "positive" },
    ],
    learningOutcomes: [
      { concept: "Revenue Sharing", use: "See how leagues trade individual gain for collective strength." },
      { concept: "Incentives", use: "Read when cooperation beats competition." },
    ],
    discussionQuestions: ["Why would a rich team ever vote yes?", "What happens to a league without sharing?"],
    relatedLessons: ["t201-m2-l3", "t101-m4-l1"],
  }),
  mk("201", 2, 2, {
    title: "Player Economics",
    experienceType: "Roster Building",
    duration: "16 min",
    status: "pilot",
    overview: "What makes a contract a bargain or a trap.",
    summary: "Identify which contract is a bargain and which is a trap.",
    centralQuestion: "Which of these contracts actually wins you games?",
    role: "General Manager",
    deadline: "Trade calls start Monday",
    concepts: ["Surplus Value", "Asset Value"],
    podcastEpisode: "EP 06",
    podcastTitle: "Stars, Role Players, and the Math of a Contender",
    situation: [
      "Three players, three contracts. One produces far more than he’s paid; one is fairly priced; one is an anchor. Your job is to tell them apart before the market does.",
    ],
    needToKnow: [
      { term: "Surplus value", body: "The gap between what a player produces and what his contract pays." },
      { term: "Asset value", body: "A contract is an asset whose worth shifts with production and price." },
    ],
    decisionOptions: [
      { label: "Acquire the bargain", detail: "Target the surplus-value deal." },
      { label: "Move the anchor", detail: "Shed the overpriced contract." },
    ],
    stakeholders: [
      { name: "Analytics Group", interest: "Wants surplus value.", concern: "Names don’t equal production." },
      { name: "Coach", interest: "Wants proven players.", concern: "May overvalue reputation." },
    ],
    evidence: [
      { label: "Player A", value: "+$12M", note: "Surplus value", tone: "positive" },
      { label: "Player C", value: "-$9M", note: "Overpaid", tone: "negative" },
    ],
    learningOutcomes: [
      { concept: "Surplus Value", use: "Separate production from price." },
      { concept: "Asset Value", use: "Treat contracts as tradeable assets." },
    ],
    discussionQuestions: ["Which contract was the trap, and how did you know?", "Why do bargains exist at all?"],
    relatedLessons: ["t201-m4-l2", "t101-m2-l3"],
  }),
  mk("201", 2, 3, {
    title: "Save the Franchise",
    shortTitle: "Save the Franchise",
    experienceType: "Franchise Management",
    duration: "18 min",
    status: "available",
    overview: "Losing fans, money, and credibility. Pick a turnaround.",
    summary: "Choose a turnaround strategy under real financial pressure.",
    centralQuestion: "The franchise is sliding. Do you chase relevance now, or rebuild the foundation?",
    decisionPrompt:
      "Attendance is down, revenue is shrinking, and the team hasn’t mattered in years. Ownership wants a plan that stops the bleeding without mortgaging the next decade. Every option trades one kind of pain for another.",
    role: "President of Basketball Operations",
    deadline: "Ownership wants a plan by the board meeting",
    concepts: ["Risk", "Incentives", "Revenue", "Long-Term Strategy", "Short- vs Long-Term Tradeoffs"],
    podcastEpisode: "EP 05",
    podcastTitle: "Who Really Pays When a Team Wins?",
    situation: [
      "The franchise you took over is in a slow-motion collapse. The product is stale, the building is half-empty, and the local broadcast numbers are the worst in a decade. Sponsors are asking hard questions at renewal.",
      "Ownership is split. One faction wants a marquee veteran to put fans back in seats now. Another wants a full teardown and a patient rebuild. The finance office just wants the losses to stop.",
      "You have one plan to present and one chance to set the direction. Whatever you choose, you’re trading immediate pressure against long-term sustainability — and someone in the building will be furious either way.",
    ],
    needToKnow: [
      { term: "Risk", body: "A turnaround is a bet under uncertainty — bigger swings raise both the upside and the chance of a worse collapse." },
      { term: "Incentives", body: "Ownership, fans, sponsors, and players all want different things from the recovery, and the loudest voice isn’t always right." },
      { term: "Revenue", body: "Attendance, media, and sponsorship feed each other — fixing one without the others rarely holds." },
      { term: "Short- vs long-term", body: "The move that sells tickets this year can be the move that delays the rebuild by five." },
    ],
    decisionOptions: [
      { label: "Pursue an expensive veteran", detail: "Buy relevance now, spend against the future." },
      { label: "Begin a full rebuild", detail: "Tear down, stockpile assets, accept short-term pain." },
      { label: "Invest in development & fan experience", detail: "Grow from within, rebuild the connection to the city." },
      { label: "Protect financial flexibility", detail: "Stabilize the books, stay ready for a real opportunity." },
    ],
    stakeholders: [
      { name: "Ownership", interest: "Wants the losses to stop and the brand restored.", concern: "A long rebuild tests their patience and wallet.", conflict: "Split between buying a veteran and tearing it down." },
      { name: "Fans", interest: "Want a reason to come back.", concern: 'Have been burned by past "plans."', conflict: "A rebuild asks them to wait through more losing." },
      { name: "Sponsors", interest: "Want a credible, visible franchise.", concern: "Won’t renew for a team no one watches.", conflict: "Their money depends on near-term relevance." },
      { name: "Players", interest: "Want to compete and be developed.", concern: "A teardown means trades and uncertainty.", conflict: "The veteran plan crowds out their minutes." },
      { name: "Finance Office", interest: "Wants sustainable books.", concern: "Another big contract deepens the hole.", conflict: "Argues against the option fans want most." },
    ],
    evidence: [
      { label: "Attendance", value: "64%", note: "Of capacity — down from 91%", tone: "negative" },
      { label: "Revenue", value: "-$31M", note: "Year over year", kind: "currency", tone: "negative" },
      { label: "Payroll", value: "$142M", note: "High for the results", kind: "currency", tone: "warning" },
      { label: "Fan Sentiment", value: "28%", note: "Approve of direction", tone: "negative" },
      { label: "Net Rating", value: "-4.8", note: "Bottom-five on court", tone: "negative" },
      { label: "Cap Outlook", value: "Locked", note: "Little room to maneuver", tone: "warning" },
    ],
    learningOutcomes: [
      { concept: "Risk", means: "Decisions made under uncertainty, weighed by probability.", appears: "A veteran might revive the team — or accelerate the decline.", use: "Size your bet to the odds, not the hope." },
      { concept: "Incentives", means: "What each party is motivated to want.", appears: "Ownership, sponsors, fans, and finance all pull different ways.", use: "Build a plan that survives competing interests." },
      { concept: "Revenue", means: "The interconnected money that funds the team.", appears: "Attendance, media, and sponsorship feeding each other downward.", use: "Treat the revenue streams as a system, not silos." },
      { concept: "Long-Term Strategy", means: "Choosing for sustained value over a single season.", appears: "Relevance now vs. a foundation that lasts.", use: "Defend a multi-year plan against short-term pressure." },
    ],
    discussionQuestions: [
      "Which turnaround did you choose — and what near-term pain did you accept?",
      "Which number convinced you the most?",
      "Whose interests did your plan serve, and whose did it sacrifice?",
      "How would you sell a rebuild to a furious fan base?",
      "What evidence would make you reverse course in one year?",
    ],
    relatedLessons: ["t201-m2-l1", "t201-m2-l2", "t101-m4-l3"],
  }),
  mk("201", 3, 1, {
    title: "Data → Decisions",
    experienceType: "Strategy",
    duration: "15 min",
    status: "available",
    overview: "Reading the model without trusting it blindly.",
    summary: "Trust the model, or trust the room.",
    centralQuestion: "The model and the scouts disagree. Who wins?",
    role: "Director of Analytics",
    deadline: "Recommendation due before the pick",
    concepts: ["Expected Value", "Risk"],
    podcastEpisode: "EP 06",
    podcastTitle: "Stars, Role Players, and the Math of a Contender",
    situation: [
      "Your model loves a player the scouts hate. Both have been right before. You have to decide whose read to put in the recommendation.",
    ],
    needToKnow: [
      { term: "Expected value", body: "Weighting each outcome by its probability instead of betting on one." },
      { term: "Model limits", body: "Data captures what it measures — and misses what it doesn’t." },
    ],
    decisionOptions: [
      { label: "Follow the model", detail: "Trust the numbers over the eye test." },
      { label: "Defer to the scouts", detail: "Trust the experienced read." },
    ],
    stakeholders: [
      { name: "Scouts", interest: "Want their judgment respected.", concern: "Feel replaced by spreadsheets." },
      { name: "GM", interest: "Wants the right pick.", concern: "Owns the outcome either way." },
    ],
    evidence: [
      { label: "Model Grade", value: "A-", note: "Strong projection", tone: "positive" },
      { label: "Scout Grade", value: "C+", note: "Concerns on fit", tone: "warning" },
    ],
    learningOutcomes: [
      { concept: "Expected Value", use: "Weigh outcomes by probability." },
      { concept: "Risk", use: "Combine data and judgment under uncertainty." },
    ],
    discussionQuestions: ["When should the model overrule the scouts?", "What does data miss?"],
    relatedLessons: ["t201-m3-l2", "t201-m4-l1"],
  }),
  mk("201", 3, 2, {
    title: "Modeling the Market",
    experienceType: "Strategy",
    duration: "16 min",
    status: "pilot",
    overview: "Pricing players before the market does.",
    summary: "Price a free agent before the market sets the number.",
    centralQuestion: "What’s he worth — before anyone else decides?",
    role: "Director of Analytics",
    deadline: "Free agency opens at midnight",
    concepts: ["Market Modeling", "Expected Value"],
    podcastEpisode: "EP 01",
    podcastTitle: "The Business Behind the Broadcast",
    situation: [
      "A free agent is about to hit the market. If you price him right before the bidding starts, you win him at value. Price him wrong and you either overpay or lose him.",
    ],
    needToKnow: [
      { term: "Market modeling", body: "Estimating a fair price from comparable players and conditions." },
      { term: "Expected value", body: "Building the price from a range of likely outcomes." },
    ],
    decisionOptions: [
      { label: "Bid at your model price", detail: "Trust your number and hold firm." },
      { label: "Bid above to secure", detail: "Pay a premium to remove the risk of losing him." },
    ],
    stakeholders: [
      { name: "Rival Teams", interest: "Want the same player.", concern: "Will drive the price up." },
      { name: "Ownership", interest: "Wants value.", concern: "Hates losing targets at the buzzer." },
    ],
    evidence: [
      { label: "Model Price", value: "$18M", note: "Your estimate", kind: "currency" },
      { label: "Market Buzz", value: "$22M", note: "Where rivals may go", kind: "currency", tone: "warning" },
    ],
    learningOutcomes: [
      { concept: "Market Modeling", use: "Set a price before the market moves." },
      { concept: "Expected Value", use: "Build a number from a range, not a guess." },
    ],
    discussionQuestions: ["Do you hold your number or chase?", "What makes a market price wrong?"],
    relatedLessons: ["t201-m3-l1", "t201-m4-l3"],
  }),
  mk("201", 3, 3, {
    title: "Competitive Edges",
    experienceType: "Strategy",
    duration: "15 min",
    status: "coming-soon",
    overview: "Finding the inefficiency everyone else missed.",
    summary: "Bet on the inefficiency everyone else ignored.",
    centralQuestion: "You found an edge. How much do you bet on it?",
    role: "General Manager",
    concepts: ["Market Efficiency", "Risk"],
    situation: [
      "Your group spotted an inefficiency the rest of the league ignores — for now. Edges close fast. How hard do you push while it lasts?",
    ],
    needToKnow: [
      { term: "Market efficiency", body: "As information spreads, mispricings disappear and edges vanish." },
    ],
    decisionOptions: [
      { label: "Bet big now", detail: "Exploit the edge before it closes." },
      { label: "Bet small", detail: "Test the edge, limit the downside." },
    ],
    stakeholders: [
      { name: "Ownership", interest: "Wants an advantage.", concern: "Skeptical of unproven theories." },
      { name: "Rivals", interest: "Want the same edge.", concern: "Will copy you fast." },
    ],
    evidence: [
      { label: "Edge Window", value: "~1 yr", note: "Before rivals catch on", tone: "warning" },
      { label: "Confidence", value: "68%", note: "In the inefficiency", tone: "info" },
    ],
    learningOutcomes: [
      { concept: "Market Efficiency", use: "Act before an edge disappears." },
      { concept: "Risk", use: "Size the bet to your confidence." },
    ],
    discussionQuestions: ["How hard would you push the edge?", "Why do edges close?"],
    relatedLessons: ["t201-m3-l1", "t201-m3-l2"],
  }),
  mk("201", 4, 1, {
    title: "Draft Pick Value",
    experienceType: "Roster Building",
    duration: "15 min",
    status: "available",
    overview: "What a pick is really worth on the value curve.",
    summary: "Decide what a draft pick is really worth in a trade.",
    centralQuestion: "A pick is a lottery ticket. What’s it worth today?",
    role: "Director of Scouting",
    deadline: "Trade offer expires draft night",
    concepts: ["Asset Value", "Expected Value"],
    podcastEpisode: "EP 04",
    podcastTitle: "Opportunity Cost, Explained in Trades",
    situation: [
      "A team offers a veteran for your first-round pick. The pick could be a star or a bust. You have to price uncertainty against a known quantity.",
    ],
    needToKnow: [
      { term: "Draft value curve", body: "Picks are worth different amounts depending on where they fall." },
      { term: "Expected value", body: "A pick’s worth is the weighted average of its possible outcomes." },
    ],
    decisionOptions: [
      { label: "Trade the pick", detail: "Take the sure veteran." },
      { label: "Keep the pick", detail: "Bet on the upside." },
    ],
    stakeholders: [
      { name: "Coach", interest: "Wants help now.", concern: "Rookies take time." },
      { name: "Scouting", interest: "Believes in the pick.", concern: "Hates trading youth." },
    ],
    evidence: [
      { label: "Pick Range", value: "#8–#12", note: "Projected slot", kind: "rank" },
      { label: "Bust Rate", value: "34%", note: "At this range", tone: "warning" },
    ],
    learningOutcomes: [
      { concept: "Asset Value", use: "Price a pick like the asset it is." },
      { concept: "Expected Value", use: "Weigh upside against bust risk." },
    ],
    discussionQuestions: ["Did you take the sure thing or the swing?", "How do you price a lottery ticket?"],
    relatedLessons: ["t201-m4-l2", "t201-m4-l3"],
  }),
  mk("201", 4, 2, {
    title: "Surplus Value",
    experienceType: "Roster Building",
    duration: "16 min",
    status: "available",
    overview: "Why a rookie deal is the best contract in sports.",
    summary: "Build around the cheapest production in the league.",
    centralQuestion: "The best contract in sports is a rookie deal. Use it how?",
    role: "General Manager",
    deadline: "Window before the rookie deal expires",
    concepts: ["Surplus Value", "Budget Allocation"],
    podcastEpisode: "EP 04",
    podcastTitle: "Opportunity Cost, Explained in Trades",
    situation: [
      "Your young star produces like a max player on a rookie-scale salary. That surplus is a window — and windows close. How do you spend the savings?",
    ],
    needToKnow: [
      { term: "Surplus value", body: "Production minus price — highest on rookie contracts." },
      { term: "The rookie window", body: "The cheap years before a star gets paid market value." },
    ],
    decisionOptions: [
      { label: "Spend the savings now", detail: "Add talent while the deal is cheap." },
      { label: "Bank for the extension", detail: "Save for the coming raise." },
    ],
    stakeholders: [
      { name: "The Young Star", interest: "Wants to win and get paid.", concern: "His value rises as his deal ends." },
      { name: "Ownership", interest: "Wants to maximize the window.", concern: "A big extension looms." },
    ],
    evidence: [
      { label: "Surplus", value: "+$26M", note: "Per year, on the rookie deal", kind: "currency", tone: "positive" },
      { label: "Window", value: "2 yrs", note: "Until the raise", tone: "warning" },
    ],
    learningOutcomes: [
      { concept: "Surplus Value", use: "Exploit the cheapest production in sports." },
      { concept: "Budget Allocation", use: "Decide how to spend a temporary surplus." },
    ],
    discussionQuestions: ["How would you use the rookie-deal window?", "Why is surplus value temporary?"],
    relatedLessons: ["t201-m2-l2", "t201-m4-l1"],
  }),
  mk("201", 4, 3, {
    title: "Trade Up / Trade Down",
    experienceType: "Negotiation",
    duration: "17 min",
    status: "in-development",
    overview: "When to gamble on one star vs. stack the board.",
    summary: "Gamble on one star or stack the board with picks.",
    centralQuestion: "One star, or three swings? Move up or down?",
    role: "Director of Scouting",
    concepts: ["Expected Value", "Risk"],
    situation: [
      "On the clock, you can trade up for a chance at a franchise player or trade down for a haul of picks. One big swing, or three smaller ones.",
    ],
    needToKnow: [
      { term: "Expected value", body: "Compare the weighted payoff of one high pick vs. several lower ones." },
      { term: "Risk profile", body: "Trading up concentrates risk; trading down spreads it." },
    ],
    decisionOptions: [
      { label: "Trade up", detail: "Concentrate everything on one star swing." },
      { label: "Trade down", detail: "Stack picks and spread the risk." },
    ],
    stakeholders: [
      { name: "Ownership", interest: "Wants a face of the franchise.", concern: "One miss sets them back years." },
      { name: "Scouting", interest: "Wants more bites at the apple.", concern: "Loves depth over stars." },
    ],
    evidence: [
      { label: "Move Up Cost", value: "2 firsts", note: "To jump into the top 3", tone: "warning" },
      { label: "Move Down Haul", value: "+3 picks", note: "For sliding back", tone: "info" },
    ],
    learningOutcomes: [
      { concept: "Expected Value", use: "Compare one big payoff to several smaller ones." },
      { concept: "Risk", use: "Choose to concentrate or spread your bet." },
    ],
    discussionQuestions: ["Did you swing big or spread out?", "When is concentration worth the risk?"],
    relatedLessons: ["t201-m4-l1", "t201-m3-l2"],
  }),
];

const bySlug = new Map(lessons.map((l) => [l.slug, l]));
const byId = new Map(lessons.map((l) => [l.id, l]));

/** Look up a lesson by its slug. */
export function getLesson(slug: string): Lesson | undefined {
  return bySlug.get(slug);
}

/** Look up a lesson by its id (used by relatedLessons references). */
export function getLessonById(id: string): Lesson | undefined {
  return byId.get(id);
}

/** Module label: "Module 02 · Building the Roster". */
export function moduleLabel(l: Lesson): string {
  return `Module ${String(l.moduleNumber).padStart(2, "0")} · ${l.moduleTitle}`;
}
