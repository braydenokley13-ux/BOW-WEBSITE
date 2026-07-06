/* ============================================================
 * Research loop — the type contract.
 *
 * The analytics product's second act. The AASV model made every
 * assumption explicit; this layer makes DISAGREEMENT computable and
 * turns it into a research workflow:
 *
 *   lib/lenses.ts    — named worldviews (assumption presets) and the
 *                      "contested verdict" math between them
 *   lib/tensions.ts  — the question engine: pure functions that mine
 *                      players/teams/trades for unresolved tensions
 *   lib/questions.ts — server-only glue: db reads → tension engine
 *   lib/notebook.ts  — the reader's evidence notebook (localStorage)
 *   lib/notebook-draft.ts — notebook → markdown article draft with
 *                      live embed shortcodes (see lib/markdown.ts)
 *
 * This file is types ONLY (plus label maps UI and engines must agree
 * on). Everything here is client-safe. The loop:
 *
 *   see through a lens → get provoked by a question → clip evidence
 *   → build the argument → publish the piece.
 * ============================================================ */

import type { Assumptions } from "@/lib/aasv";
import type { VerdictTier } from "@/lib/intelligence-types";

/* ---------------- lenses (named worldviews) ---------------- */

/**
 * A lens is a complete, opinionated set of model assumptions with a
 * name and a philosophy. Selecting a lens writes its assumptions into
 * the existing useAssumptions store, so every live dashboard, memo,
 * and embed on the site recomputes under that worldview for free.
 */
export interface Lens {
  id: string;
  name: string;
  /** One sentence of worldview, written in that lens's own voice. */
  philosophy: string;
  assumptions: Assumptions;
}

/** The reader moved a slider by hand — no preset matches anymore. */
export const CUSTOM_LENS_ID = "custom";

/**
 * One player's verdict tier under every preset lens. A verdict that
 * survives every worldview is settled; one that flips is CONTESTED —
 * and contested calls are where the research questions live.
 */
export interface LensSplit {
  slug: string;
  /** lens id → verdict tier under that lens's assumptions. */
  verdicts: Record<string, VerdictTier>;
  /** True when at least two preset lenses reach different tiers. */
  contested: boolean;
  /** Tier distance between the extremes (0 = unanimous, 3 = bargain↔albatross). */
  span: number;
}

/* ---------------- the open docket (research questions) ---------------- */

export type QuestionKind =
  | "knife-edge" // verdict flips inside the bear/bull scenario band
  | "lens-split" // preset worldviews disagree on the verdict
  | "price-production-gap" // salary rank and production rank far apart
  | "aging-cliff" // multi-season impact decline with long money left
  | "metric-disagreement" // EPM and BPM tell different stories
  | "mutual-gain-trade" // apron repricing makes BOTH sides win a swap
  | "window-contradiction"; // team's window state and cap posture conflict

export const QUESTION_KIND_LABELS: Record<QuestionKind, string> = {
  "knife-edge": "Knife edge",
  "lens-split": "Worldviews disagree",
  "price-production-gap": "Price vs. production",
  "aging-cliff": "Aging cliff",
  "metric-disagreement": "Metrics disagree",
  "mutual-gain-trade": "Free lunch",
  "window-contradiction": "Window contradiction",
};

/** What a piece of evidence (or a question) points at. */
export interface EvidenceRef {
  kind: "player" | "team" | "trade";
  /** Player slugs; for a trade exactly two: [send, receive]. */
  slugs: string[];
  /** Team abbreviation, when kind === "team". */
  team?: string;
  /** Short human label, e.g. "Jaylen Brown" or "BOS cap sheet". */
  label: string;
}

/**
 * One unresolved tension the model detected, phrased as a research
 * question a reader could actually take on. IDs are deterministic
 * (`kind:key`, url-safe) so /analytics/questions/[id] can rebuild the
 * same question from live data on every request.
 */
export interface ResearchQuestion {
  id: string;
  kind: QuestionKind;
  /** The question itself — ends with a question mark. */
  question: string;
  /** 1–3 sentences: what the model sees and why it can't settle it. */
  setup: string[];
  evidence: EvidenceRef[];
  /** What would settle it — the suggested method, one sentence. */
  method: string;
  /** 0–100 interestingness for ranking the docket. Deterministic. */
  heat: number;
}

/* ---------------- the notebook (evidence → argument) ---------------- */

export type ClipKind =
  | "verdict" // a contract verdict at capture time
  | "valuation" // a raw AASV calculation
  | "scenario" // a bear/base/bull band
  | "trade" // a two-player trade analysis
  | "team" // a team rollup / brief
  | "question" // a docket question taken into the notebook
  | "ledger" // a dated ledger event — the model changing its mind
  | "note"; // freehand thought, no model payload

/** Where a clip sits in the reader's argument. */
export type Stance = "supports" | "challenges" | "open";

export const STANCE_LABELS: Record<Stance, string> = {
  supports: "Supports my thesis",
  challenges: "Challenges it",
  open: "Open question",
};

/**
 * A frozen piece of evidence. Clips capture the assumptions AND the
 * computed numbers at the moment of capture, so an argument built in
 * the notebook stays honest even after the reader moves the sliders
 * or the nightly ingest updates the stats.
 */
export interface Clip {
  id: string;
  kind: ClipKind;
  stance: Stance;
  /** Headline at capture time, e.g. "Bargain — top-5 surplus deal". */
  title: string;
  /** The frozen numbers, 1–2 lines of plain text. */
  detail: string;
  refs: EvidenceRef[];
  /** Name of the lens active at capture ("The Accountant", "Custom…"). */
  lensName: string;
  /** Full assumption set frozen at capture. */
  assumptions: Assumptions;
  /** The reader's own words about why this matters. */
  note: string;
  /** Route the clip came from, e.g. "/analytics/players/jaylen-brown". */
  sourcePath: string;
  capturedAt: number;
  /** Set when clipped while working a docket question. */
  questionId?: string;
}

export interface NotebookState {
  /** The reader's working claim, in their own words. May be empty. */
  hypothesis: string;
  clips: Clip[];
  updatedAt: number;
}

export const EMPTY_NOTEBOOK: NotebookState = { hypothesis: "", clips: [], updatedAt: 0 };
