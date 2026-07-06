/* ============================================================
 * The Open Ledger — the model on the record.
 *
 * The docket (lib/tensions.ts) asks what the model can't settle
 * TODAY; this file tracks what the model has CHANGED ITS MIND about
 * over time. Every ingest freezes a compact snapshot — each player's
 * verdict tier under every preset lens, plus the docket board — and
 * the ledger is nothing more than the honest diff between two
 * snapshots: verdicts that flipped (and under which worldviews),
 * questions that opened, settled, or reopened, calls that became
 * contested or stopped being contested.
 *
 * The product bet: a model that publicly keeps score on itself is
 * the only kind a reader should trust — and "the model changed its
 * mind this week" is a reason to come back that no static content
 * bank can fake.
 *
 * Pure and client-safe, exactly like lib/tensions.ts: snapshots in,
 * events out, deterministic ids. All I/O (recording snapshots,
 * reading history, the Blob mirror) lives in lib/ledger-store.ts.
 * ============================================================ */

import { valuate, fmtSignedMillions } from "@/lib/aasv";
import { VERDICT_LABELS, type VerdictTier } from "@/lib/intelligence-types";
import { buildLensSplit, PRESET_LENSES } from "@/lib/lenses";
import { buildDocket, type DocketInput } from "@/lib/tensions";
import type { EvidenceRef, QuestionKind } from "@/lib/research-types";

/* ---------------- snapshot shape ---------------- */

/** One player's frozen model read: house AASV plus the tier under every preset lens. */
export interface LedgerPlayerState {
  name: string;
  team: string;
  /** AASV under house (default) assumptions, raw dollars. */
  aasv: number;
  /** Preset lens id → verdict tier under that lens (from buildLensSplit). */
  verdicts: Record<string, VerdictTier>;
  contested: boolean;
  span: number;
}

/** One docket question's frozen presence on the board. */
export interface LedgerQuestionState {
  kind: QuestionKind;
  question: string;
  heat: number;
}

/** Everything the ledger needs to diff two days of the model. Small by design. */
export interface LedgerSnapshot {
  /** ms epoch when the snapshot was taken. */
  takenAt: number;
  season: string;
  /** slug → frozen model read. */
  players: Record<string, LedgerPlayerState>;
  /** question id → frozen board entry (the capped, public docket). */
  questions: Record<string, LedgerQuestionState>;
}

/** Build a snapshot from the same input contract the docket uses. Pure. */
export function buildLedgerSnapshot(input: DocketInput, takenAt: number, season: string): LedgerSnapshot {
  const players: Record<string, LedgerPlayerState> = {};
  for (const p of input.players) {
    const split = buildLensSplit(p);
    players[p.slug] = {
      name: p.name,
      team: p.team,
      aasv: valuate(p, input.assumptions).aasv,
      verdicts: split.verdicts,
      contested: split.contested,
      span: split.span,
    };
  }
  const questions: Record<string, LedgerQuestionState> = {};
  for (const q of buildDocket(input)) {
    questions[q.id] = { kind: q.kind, question: q.question, heat: q.heat };
  }
  return { takenAt, season, players, questions };
}

/* ---------------- events ---------------- */

export type LedgerEventKind =
  | "verdict-flip" // a player's tier changed under at least one preset lens
  | "contested-change" // a call became contested, or stopped being contested
  | "question-opened" // a question joined the public docket board
  | "question-settled" // a question left the board (the tension eased)
  | "question-reopened"; // a question the board had settled came back

export const LEDGER_EVENT_LABELS: Record<LedgerEventKind, string> = {
  "verdict-flip": "Verdict flip",
  "contested-change": "Contested",
  "question-opened": "Question opened",
  "question-settled": "Question settled",
  "question-reopened": "Question reopened",
};

/** One lens's before → after on a flipped verdict. */
export interface LensFlip {
  lensId: string;
  lensName: string;
  before: VerdictTier;
  after: VerdictTier;
}

/**
 * One dated entry on the ledger. Ids are deterministic for a given
 * pair of snapshots (`kind:key@takenAt`), so re-deriving events from
 * stored snapshots never mints duplicates.
 */
export interface LedgerEvent {
  id: string;
  kind: LedgerEventKind;
  /** takenAt of the newer snapshot — the day the change surfaced. */
  at: number;
  /** One-line, name-first summary of what moved. */
  headline: string;
  /** The receipts: before/after numbers, which lenses held firm. */
  detail: string;
  refs: EvidenceRef[];
  /** Deterministic 0–100 ranking weight, same contract as docket heat. */
  heat: number;
  /** verdict-flip only: every preset lens that changed its call. */
  flips?: LensFlip[];
  /** question events only: the docket question id (stable, clippable). */
  questionId?: string;
}

const clampHeat = (h: number) => Math.max(1, Math.min(100, Math.round(h)));

function playerRef(slug: string, p: LedgerPlayerState): EvidenceRef {
  return { kind: "player", slugs: [slug], label: p.name };
}

/**
 * Diff two consecutive snapshots into ledger events, newest snapshot's
 * date on every event. `everSettledIds` — question ids that appeared on
 * SOME earlier snapshot but not on `prev` — upgrades an "opened" to a
 * "reopened" (pass an empty set when history is unknown).
 */
export function diffSnapshots(prev: LedgerSnapshot, next: LedgerSnapshot, everSettledIds: ReadonlySet<string> = new Set()): LedgerEvent[] {
  const events: LedgerEvent[] = [];
  const at = next.takenAt;

  /* -- player verdicts -- */
  for (const [slug, after] of Object.entries(next.players)) {
    const before = prev.players[slug];
    if (!before) continue; // new to the dataset: nothing to compare honestly

    const flips: LensFlip[] = [];
    for (const lens of PRESET_LENSES) {
      const b = before.verdicts[lens.id];
      const a = after.verdicts[lens.id];
      if (b && a && b !== a) flips.push({ lensId: lens.id, lensName: lens.name, before: b, after: a });
    }
    if (flips.length > 0) {
      const held = PRESET_LENSES.filter((l) => !flips.some((f) => f.lensId === l.id)).map((l) => l.name);
      const lead = flips.find((f) => f.lensId === "consensus") ?? flips[0];
      const deltaM = Math.abs(after.aasv - before.aasv) / 1_000_000;
      events.push({
        id: `verdict-flip:${slug}@${at}`,
        kind: "verdict-flip",
        at,
        headline: `${after.name}: ${VERDICT_LABELS[lead.before]} → ${VERDICT_LABELS[lead.after]} under ${lead.lensName}`,
        detail:
          `${flips.length} of ${PRESET_LENSES.length} worldviews changed their call; ` +
          (held.length > 0 ? `${held.join(", ")} held firm. ` : `no lens held its previous tier. `) +
          `House AASV moved ${fmtSignedMillions(after.aasv - before.aasv)} to ${fmtSignedMillions(after.aasv)}.`,
        refs: [playerRef(slug, after)],
        heat: clampHeat(30 + flips.length * 12 + deltaM * 2),
        flips,
      });
    } else if (before.contested !== after.contested) {
      events.push({
        id: `contested-change:${slug}@${at}`,
        kind: "contested-change",
        at,
        headline: after.contested
          ? `${after.name}'s verdict is now CONTESTED`
          : `${after.name}'s verdict is no longer contested`,
        detail: after.contested
          ? `The preset worldviews split (tier span ${after.span}) where they agreed yesterday — the disagreement is new, not the arithmetic.`
          : `Every preset worldview now reaches the same tier; the tension the lenses used to expose has closed.`,
        refs: [playerRef(slug, after)],
        heat: clampHeat(25 + after.span * 10),
      });
    }
  }

  /* -- docket board membership -- */
  for (const [id, q] of Object.entries(next.questions)) {
    if (prev.questions[id]) continue;
    const reopened = everSettledIds.has(id);
    events.push({
      id: `${reopened ? "question-reopened" : "question-opened"}:${id}@${at}`,
      kind: reopened ? "question-reopened" : "question-opened",
      at,
      headline: q.question,
      detail: reopened
        ? `Back on the docket — the board had settled this once, and the data reopened it.`
        : `New on the docket (${q.kind}, heat ${q.heat}).`,
      refs: [],
      heat: clampHeat(q.heat * (reopened ? 1.1 : 0.9)),
      questionId: id,
    });
  }
  for (const [id, q] of Object.entries(prev.questions)) {
    if (next.questions[id]) continue;
    events.push({
      id: `question-settled:${id}@${at}`,
      kind: "question-settled",
      at,
      headline: q.question,
      detail: `Left the docket — the tension that raised it eased below the board's bar. Settled by the data is still settled.`,
      refs: [],
      heat: clampHeat(q.heat * 0.7),
      questionId: id,
    });
  }

  return events.sort((a, b) => b.heat - a.heat);
}

/**
 * Fold a snapshot history (oldest first) into a single event stream,
 * newest day first, heat-ranked within a day. Tracks settled ids across
 * the whole run so reopenings are detected honestly.
 */
export function eventsFromHistory(snapshots: LedgerSnapshot[]): LedgerEvent[] {
  const events: LedgerEvent[] = [];
  const everSettled = new Set<string>();
  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1];
    const next = snapshots[i];
    for (const id of Object.keys(prev.questions)) {
      if (!next.questions[id]) everSettled.add(id);
    }
    events.push(...diffSnapshots(prev, next, everSettled));
    // Anything back on the board is no longer "settled" for later diffs.
    for (const id of Object.keys(next.questions)) everSettled.delete(id);
  }
  return events.sort((a, b) => b.at - a.at || b.heat - a.heat);
}

/** Weekly rollup for the landing-page strip and the weekly challenge. */
export interface LedgerWeek {
  flips: number;
  opened: number;
  settled: number;
  reopened: number;
  /** Highest-heat event of the window, if any. */
  top: LedgerEvent | null;
}

/** The last seven days of the record — the window the site's strips talk about. */
export function summarizeLastWeek(events: LedgerEvent[]): LedgerWeek {
  return summarizeWindow(events, Date.now() - 7 * 24 * 60 * 60 * 1000);
}

export function summarizeWindow(events: LedgerEvent[], sinceMs: number): LedgerWeek {
  const inWindow = events.filter((e) => e.at >= sinceMs);
  const count = (k: LedgerEventKind) => inWindow.filter((e) => e.kind === k).length;
  const top = inWindow.reduce<LedgerEvent | null>((best, e) => (best === null || e.heat > best.heat ? e : best), null);
  return {
    flips: count("verdict-flip"),
    opened: count("question-opened"),
    settled: count("question-settled"),
    reopened: count("question-reopened"),
    top,
  };
}
