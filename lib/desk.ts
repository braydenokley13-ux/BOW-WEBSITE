/* ============================================================
 * The Research Desk — editorial command center (V1).
 *
 * The desk is the layer between the machine and the publication:
 *
 *   detectors emit SIGNALS (docket questions, ledger events)
 *     → the editor triages a signal into an ASSIGNMENT
 *       → the assignment is worked in a FORMAT (docket file, memo…)
 *         → the published piece deposits RESIDUE (a detector, an
 *           embed, a data column…) that widens what the detectors
 *           can see. That's the flywheel (research/09 §6).
 *
 * This file is the V1 "database": pure, client-safe, typed, static.
 * Assignments are editorial state — they change on triage, not per
 * request — so a hand-edited typed array is the correct store until
 * the Postgres migration (research/07) lands. Every consumer goes
 * through the helpers below, so swapping this array for a table is a
 * one-file change.
 *
 * HOW TO ADD AN ASSIGNMENT (for future models/editors):
 *   1. Find the signal: a docket question id (stable `kind:key`) from
 *      /analytics/questions, a ledger event, or an editorial call.
 *   2. Append a DeskAssignment below. Keep ids `desk-<slug>`, stable.
 *   3. Pick the format from CONTENT_FORMATS. If residueRequired is
 *      true for that format, `residue` must be non-empty.
 *   4. Advance `status` as work happens; set `articleSlug` when the
 *      piece publishes; flip residue `delivered` when it ships.
 * Server-only data (live docket, articles) is joined at render time
 * via resolveSignalQuestion — never import server libs here.
 * ============================================================ */

import type { QuestionKind, ResearchQuestion } from "@/lib/research-types";

/* ---------------- content formats (the portfolio) ---------------- */

export type DeskFormatId =
  | "ledger-note"
  | "docket-file"
  | "desk-brief"
  | "flagship"
  | "method-memo"
  | "teaching-note"
  | "partner-memo";

export interface ContentFormat {
  id: DeskFormatId;
  name: string;
  /** One line: what this format is for. */
  purpose: string;
  /** Who it's written for. */
  audience: string;
  /** Honest hours for one editor, not a newsroom. */
  timeCost: string;
  /** The rigor bar a piece must clear before it ships. */
  rigor: string;
  /** How the format connects to the live model. */
  modelConnection: string;
  /** Must the piece deposit residue (detector/embed/column/lens)? */
  residueRequired: boolean;
  /** Expected cadence at current desk capacity. */
  cadence: string;
  /** Working-title examples so the format is concrete. */
  examples: string[];
}

export const CONTENT_FORMATS: ContentFormat[] = [
  {
    id: "ledger-note",
    name: "Ledger Note",
    purpose: "Two paragraphs of human judgment on what moved on the ledger — the model's diary, annotated.",
    audience: "Returning readers; the weekly heartbeat.",
    timeCost: "30–60 min",
    rigor: "Every claim is a ledger event or a live embed; no new analysis required.",
    modelConnection: "Built directly from diffSnapshots output; embeds re-run the live engines.",
    residueRequired: false,
    cadence: "Weekly in season",
    examples: ["The Week the Model Changed Its Mind", "Three Verdicts That Flipped on One Slider"],
  },
  {
    id: "docket-file",
    name: "Docket File",
    purpose: "The workhorse: take one Open Docket question, investigate it, settle or sharpen it on the record.",
    audience: "Serious fans and analytics-literate readers.",
    timeCost: "6–15 hrs",
    rigor: "Full assumption-bounds sweep; the piece must show where (or whether) the conclusion flips.",
    modelConnection: "Starts from a machine-generated question with a stable id; publishes at its lineage.",
    residueRequired: true,
    cadence: "2/month in season",
    examples: ["The Same Contract, Four Different Prices", "Free Lunches: When a Trade Helps Both Teams"],
  },
  {
    id: "desk-brief",
    name: "Desk Brief",
    purpose: "A fast, structured read on a live situation the detectors flagged — assignment-to-publish in a day.",
    audience: "Anyone following the news; Bow's answer to the hot take.",
    timeCost: "2–4 hrs",
    rigor: "Only ships if a detector actually fired; conditional claims with stated assumptions only.",
    modelConnection: "Anchored to a specific signal (docket question or ledger event) cited in the piece.",
    residueRequired: false,
    cadence: "As signals warrant",
    examples: ["Why the Model Calls This Trade a Free Lunch", "The Docket Just Opened a File on Phoenix"],
  },
  {
    id: "flagship",
    name: "Flagship Investigation",
    purpose: "Quarterly original research on a territory question — the pieces a front office forwards.",
    audience: "All audiences, layered: story up top, methods appendix below.",
    timeCost: "30–60 hrs over 4–8 weeks",
    rigor: "New dataset or model extension; external-validity check; adversarial review pass.",
    modelConnection: "Must change the model — a new lens, detector, or assumption dimension exists afterward.",
    residueRequired: true,
    cadence: "Quarterly",
    examples: ["Do the Lenses Know Something the Market Doesn't?"],
  },
  {
    id: "method-memo",
    name: "Method Memo",
    purpose: "Model changes, assumption audits, and decision retrospectives — being wrong, in public, on purpose.",
    audience: "The analytics community; low traffic, maximal credibility per reader.",
    timeCost: "3–6 hrs",
    rigor: "Auditable by a team analyst; every change versioned against the ledger record.",
    modelConnection: "Documents a diff to lib/aasv, lenses, or detectors; the ledger grades it later.",
    residueRequired: true,
    cadence: "On every model change + quarterly retrospective",
    examples: ["What Is a Win Worth? An Audit of Our Most Important Number", "The Report Card"],
  },
  {
    id: "teaching-note",
    name: "Teaching Note",
    purpose: "A classroom-ready explainer that turns one desk finding into a Track 101/201 artifact.",
    audience: "Students and instructors on the education side of the house.",
    timeCost: "2–4 hrs, derived from an already-published piece",
    rigor: "Plain language, glossary-linked; every number is a live embed a student can re-run.",
    modelConnection: "Reuses the source piece's embeds; links the lesson to the live model.",
    residueRequired: true,
    cadence: "1/month, trailing the publication",
    examples: ["Why a Dollar Doesn't Cost a Dollar (Track 101 companion)"],
  },
  {
    id: "partner-memo",
    name: "Partner Memo",
    purpose: "A front-office-style brief for schools and partners — the desk's work in decision-memo form.",
    audience: "Partners, program directors, front-office-adjacent readers.",
    timeCost: "2–3 hrs, derived from existing findings",
    rigor: "Memo discipline: recommendation, evidence, risk, dissent — no claim without a citation.",
    modelConnection: "Compiled from buildPlayerMemo/buildTeamBrief outputs and published findings.",
    residueRequired: false,
    cadence: "As partnerships require",
    examples: ["State of the Apron: A Briefing for Partners"],
  },
];

export function getFormat(id: DeskFormatId): ContentFormat {
  return CONTENT_FORMATS.find((f) => f.id === id)!;
}

/* ---------------- desk assignments (the pipeline) ---------------- */

/** Where an assignment came from. Docket kinds are the detectors'. */
export type SignalKind = QuestionKind | "ledger-event" | "editorial";

export const SIGNAL_KIND_LABELS: Record<"ledger-event" | "editorial", string> = {
  "ledger-event": "Ledger event",
  editorial: "Editorial call",
};

export type AssignmentStatus =
  | "signal" // triaged in, not yet scoped
  | "assigned" // scoped: question + kill condition written
  | "researching" // notebook work in progress
  | "drafting" // notebook → draft compiled, being written
  | "published" // live in the publication
  | "killed"; // investigated and dropped — on the record why

export const STATUS_LABELS: Record<AssignmentStatus, string> = {
  signal: "Signal",
  assigned: "Assigned",
  researching: "In research",
  drafting: "Drafting",
  published: "Published",
  killed: "Killed",
};

/** Board order. Killed renders last, deliberately visible. */
export const STATUS_ORDER: AssignmentStatus[] = ["signal", "assigned", "researching", "drafting", "published", "killed"];

export type Urgency = "now" | "this-week" | "this-month" | "backlog";

export const URGENCY_LABELS: Record<Urgency, string> = {
  now: "Now",
  "this-week": "This week",
  "this-month": "This month",
  backlog: "Backlog",
};

/** What a piece leaves behind. "Only prose" is not an option. */
export type ResidueKind =
  | "detector"
  | "embed"
  | "data-column"
  | "lens"
  | "model-revision"
  | "tool-page"
  | "teaching-artifact"
  | "partner-artifact";

export const RESIDUE_KIND_LABELS: Record<ResidueKind, string> = {
  detector: "New detector",
  embed: "New embed",
  "data-column": "New data column",
  lens: "New lens",
  "model-revision": "Model revision",
  "tool-page": "Tool page",
  "teaching-artifact": "Teaching artifact",
  "partner-artifact": "Partner artifact",
};

export interface AssignmentResidue {
  kind: ResidueKind;
  description: string;
  delivered: boolean;
}

export interface DeskAssignment {
  /** Stable, url-safe, `desk-` prefixed. Never recycle. */
  id: string;
  /** Working title — the piece's name on the board. */
  title: string;
  /** The signal that opened this file. */
  signal: {
    kind: SignalKind;
    /** One line: what the machine (or editor) saw. */
    summary: string;
    /**
     * Stable docket question id when the signal is a detector's.
     * Resolved against the LIVE docket at render time — the question
     * may have settled since triage, and the board should show that.
     */
    questionId?: string;
  };
  /** Which worldviews disagree, and about what — the editorial angle. */
  lensAngle: string;
  format: DeskFormatId;
  status: AssignmentStatus;
  owner: string;
  urgency: Urgency;
  /** Data this piece needs that isn't already on hand. Empty = ready. */
  dataNeeds: string[];
  /** What this piece deposits back into the machine. */
  residue: AssignmentResidue[];
  /** The single next physical action. If you can't name it, triage again. */
  nextAction: string;
  /** Set when published — links the board to the publication. */
  articleSlug?: string;
  /** killed only: the on-the-record reason. */
  killedBecause?: string;
  /** ISO date the file was opened. */
  openedAt: string;
}

/**
 * V1 seed board — the roadmap's first pieces (research/09 §12) staged
 * as live desk files. This array IS the desk's database until the
 * Postgres migration; edit it on every triage. Signals reference
 * detector KINDS (and ids where stable) so the board stays honest as
 * the docket moves underneath it.
 */
export const DESK_ASSIGNMENTS: DeskAssignment[] = [
  {
    id: "desk-show-your-work",
    title: "Show Your Work: Why Bow Publishes Its Assumptions",
    signal: {
      kind: "editorial",
      summary: "Launch manifesto — the piece every future article links instead of re-justifying itself.",
    },
    lensAngle: "All five lenses on one screen: the same player, five verdicts, and why that's the product.",
    format: "method-memo",
    status: "drafting",
    owner: "Desk",
    urgency: "now",
    dataNeeds: [],
    residue: [
      { kind: "embed", description: "Inline lens-switcher demo block reusable by every methods piece", delivered: false },
    ],
    nextAction: "Write the lede around the live verdict-flip demonstration; publish before any other piece.",
    openedAt: "2026-07-06",
  },
  {
    id: "desk-same-contract-four-prices",
    title: "The Same Contract, Four Different Prices",
    signal: {
      kind: "mutual-gain-trade",
      summary: "Trade detector keeps finding swaps where apron repricing makes both sides win.",
    },
    lensAngle: "The Accountant vs. The Ring Chaser: identical production, opposite verdicts once the receiving team's apron is charged.",
    format: "docket-file",
    status: "researching",
    owner: "Desk",
    urgency: "this-week",
    dataNeeds: [],
    residue: [
      { kind: "embed", description: "30-team repricing strip: one contract, every team context", delivered: false },
    ],
    nextAction: "Clip 3–4 case-study contracts through buildTradeAnalysis across all 30 team contexts.",
    openedAt: "2026-07-06",
  },
  {
    id: "desk-most-contested-player",
    title: "The Most Contested Player in the League",
    signal: {
      kind: "lens-split",
      summary: "Lens-split detector: several verdicts sit ≥2 tiers apart across preset worldviews.",
    },
    lensAngle: "All five lenses as characters — who they fight over most, and what kind of player he is.",
    format: "docket-file",
    status: "assigned",
    owner: "Desk",
    urgency: "this-month",
    dataNeeds: [],
    residue: [
      { kind: "data-column", description: "contestedness score (lens span) persisted per player", delivered: false },
      { kind: "detector", description: "contested-cluster detector: flags player archetypes lenses systematically fight over", delivered: false },
    ],
    nextAction: "Rank the league by buildLensSplit span; profile the top-decile cluster.",
    openedAt: "2026-07-06",
  },
  {
    id: "desk-week-on-the-ledger",
    title: "The Week the Model Changed Its Mind (standing file)",
    signal: {
      kind: "ledger-event",
      summary: "Nightly snapshot diffs: verdict flips and question turnover accumulate weekly.",
    },
    lensAngle: "Which flips were stat drift vs. assumption sensitivity — annotate, don't just list.",
    format: "ledger-note",
    status: "assigned",
    owner: "Desk",
    urgency: "this-week",
    dataNeeds: [],
    residue: [],
    nextAction: "Ship the first recap from summarizeLastWeek; template the structure for weekly reuse.",
    openedAt: "2026-07-06",
  },
  {
    id: "desk-dollars-per-win-audit",
    title: "What Is a Win Worth? An Audit of Our Most Important Number",
    signal: {
      kind: "knife-edge",
      summary: "Knife-edge detector: multiple verdicts flip within the plausible $-per-win range — the whole model leans on one number.",
    },
    lensAngle: "Every lens prices a win differently; the audit shows how many verdicts each choice silently decides.",
    format: "method-memo",
    status: "signal",
    owner: "Desk",
    urgency: "this-month",
    dataNeeds: ["Hand-curated league-financials table (total salary vs. available wins) in data-seeds/"],
    residue: [
      { kind: "data-column", description: "league financials seed table", delivered: false },
      { kind: "embed", description: "verdict-flip-count along the $/win axis", delivered: false },
    ],
    nextAction: "Curate the league-financials table; derive defensible $/win bounds from it.",
    openedAt: "2026-07-06",
  },
  {
    id: "desk-free-lunches",
    title: "Free Lunches: When a Trade Helps Both Teams",
    signal: {
      kind: "mutual-gain-trade",
      summary: "The most counterintuitive standing output: the model says some trades create value on BOTH sides.",
    },
    lensAngle: "The Skeptic's case that free lunches are model artifacts vs. The Consensus case that they're apron-relief transfers.",
    format: "docket-file",
    status: "signal",
    owner: "Desk",
    urgency: "backlog",
    dataNeeds: ["Agent sweep of the pairwise trade space to classify the mutual-gain population"],
    residue: [
      { kind: "detector", description: "trade-space detector upgrade: classify WHY a mutual gain exists", delivered: false },
    ],
    nextAction: "Scope the kill condition: if >80% of free lunches are pure apron-relief, the piece becomes a Method Memo.",
    openedAt: "2026-07-06",
  },
  {
    id: "desk-apron-explainer-101",
    title: "Why a Dollar Doesn't Cost a Dollar (Track 101 companion)",
    signal: {
      kind: "editorial",
      summary: "Education side needs a classroom on-ramp to the analytics side — derive it from the manifesto.",
    },
    lensAngle: "One lens only (The Consensus), on purpose: students learn the dial exists before they learn to argue about it.",
    format: "teaching-note",
    status: "signal",
    owner: "Desk",
    urgency: "backlog",
    dataNeeds: [],
    residue: [
      { kind: "teaching-artifact", description: "Glossary-linked explainer with re-runnable embeds, referenced from Track 101", delivered: false },
    ],
    nextAction: "Wait for the manifesto to publish, then derive — do not write this first.",
    openedAt: "2026-07-06",
  },
  {
    id: "desk-daily-hot-takes",
    title: "Daily reaction column on trade rumors",
    signal: {
      kind: "editorial",
      summary: "Tempting cadence-filler: react to every rumor cycle for traffic.",
    },
    lensAngle: "None — and that's the tell. No detector fired.",
    format: "desk-brief",
    status: "killed",
    owner: "Desk",
    urgency: "backlog",
    dataNeeds: [],
    residue: [],
    nextAction: "None. File stays on the board as the precedent.",
    killedBecause:
      "Fails the desk's admission test: no detector fired, no falsifiable question, no residue. Bow reacts to news only when the model has something non-obvious to say (research/09 §4).",
    openedAt: "2026-07-06",
  },
];

/* ---------------- helpers (the seam a DB swap replaces) ---------------- */

export function getAssignments(): DeskAssignment[] {
  return DESK_ASSIGNMENTS;
}

export function groupByStatus(assignments: DeskAssignment[]): Map<AssignmentStatus, DeskAssignment[]> {
  const map = new Map<AssignmentStatus, DeskAssignment[]>();
  for (const s of STATUS_ORDER) map.set(s, []);
  for (const a of assignments) map.get(a.status)!.push(a);
  return map;
}

/** Label for any signal kind — detector kinds use the docket's labels. */
export function signalKindLabel(kind: SignalKind, questionKindLabels: Record<QuestionKind, string>): string {
  if (kind === "ledger-event" || kind === "editorial") return SIGNAL_KIND_LABELS[kind];
  return questionKindLabels[kind];
}

/**
 * Join an assignment to the LIVE docket. Exact question-id match wins;
 * otherwise the hottest open question of the signal's detector kind
 * stands in (the tension class is the signal, not one player). Returns
 * null for editorial/ledger signals or when the tension has settled —
 * which the board should surface, not hide.
 */
export function resolveSignalQuestion(a: DeskAssignment, docket: ResearchQuestion[]): ResearchQuestion | null {
  if (a.signal.questionId) {
    const exact = docket.find((q) => q.id === a.signal.questionId);
    if (exact) return exact;
  }
  if (a.signal.kind === "ledger-event" || a.signal.kind === "editorial") return null;
  const ofKind = docket.filter((q) => q.kind === a.signal.kind);
  if (ofKind.length === 0) return null;
  return ofKind.reduce((best, q) => (q.heat > best.heat ? q : best));
}

/** Counts for the desk masthead. */
export function deskCounts(assignments: DeskAssignment[]) {
  const active = assignments.filter((a) => a.status !== "published" && a.status !== "killed").length;
  const residuePlanned = assignments.flatMap((a) => a.residue).length;
  const residueDelivered = assignments.flatMap((a) => a.residue).filter((r) => r.delivered).length;
  return { active, residuePlanned, residueDelivered };
}
