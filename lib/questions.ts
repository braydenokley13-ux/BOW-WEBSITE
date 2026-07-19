/* ============================================================
 * Open Docket glue — db reads → the tension engine.
 *
 * lib/tensions.ts is pure math over a DocketInput; this file is the
 * only place that actually touches the database to build one, then
 * hands it to buildDocket(). Kept separate so lib/tensions.ts stays
 * client-safe and independently testable with fabricated data.
 *
 * Server-only. Do not import from a client component.
 * ============================================================ */

import { getAnalyticsPlayers, getAllPlayerSeasonHistories } from "@/lib/nba";
import { DEFAULT_ASSUMPTIONS } from "@/lib/aasv";
import { buildDocket, DETECTORS, type DocketInput } from "@/lib/tensions";
import type { QuestionKind, ResearchQuestion } from "@/lib/research-types";

/** Live DocketInput: every curated player, full season histories, house assumptions. */
async function buildInput(): Promise<DocketInput> {
  return {
    players: (await getAnalyticsPlayers()),
    histories: (await getAllPlayerSeasonHistories()),
    assumptions: DEFAULT_ASSUMPTIONS,
  };
}

/** The full ranked research docket (capped at 24), built fresh from live data on every call. */
export async function getOpenDocket(): Promise<ResearchQuestion[]> {
  return buildDocket((await buildInput()));
}

/**
 * Resolve one question by id. The docket is deterministic, so rebuilding it from
 * live data reproduces the same ids every time — but the docket itself is capped
 * at 24 and diversity-balanced, so a question that a reader clipped or bookmarked
 * can fall out of the top-24 view without becoming unresolvable. When that
 * happens, rerun the specific detector the id's `kind:` prefix implies over the
 * FULL (uncapped) dataset so any id a detector can actually produce still
 * resolves. Returns null for ids no detector recognizes.
 */
export async function getQuestionById(id: string): Promise<ResearchQuestion | null> {
  const input = (await buildInput());

  const docket = buildDocket(input);
  const found = docket.find((q) => q.id === id);
  if (found) return found;

  const sep = id.indexOf(":");
  if (sep < 0) return null;
  const kind = id.slice(0, sep) as QuestionKind;
  const detector = DETECTORS[kind];
  if (!detector) return null;

  return detector(input).find((q) => q.id === id) ?? null;
}
