/* ============================================================
 * lib/notebook.ts — the reader's evidence notebook, pure helpers.
 *
 * A clip freezes BOTH the computed numbers (title/detail) AND the
 * model assumptions that produced them, so an argument built from
 * clips stays honest after the sliders move or the nightly stat
 * ingest runs. This file is client-safe (no React, no I/O): the
 * localStorage store (components/research/useNotebook.ts) and the
 * draft compiler (lib/notebook-draft.ts) both build on these ops.
 *
 * State shape lives in lib/research-types.ts (Clip, NotebookState) —
 * that file is the contract; this one is the only place that mutates
 * it. Every op is `(state, ...) => NotebookState`, immutable, and
 * bumps `updatedAt`.
 *
 * The notebook is capped at MAX_CLIPS (60): a research notebook is
 * meant to be curated, not an infinite scroll of everything a reader
 * ever glanced at. addClip and parseNotebook both enforce the cap by
 * dropping the OLDEST clips (by capturedAt) once the count exceeds
 * it — the newest evidence always wins the slot.
 * ============================================================ */

import { normalizeAssumptions } from "@/lib/aasv";
import {
  EMPTY_NOTEBOOK,
  type Clip,
  type ClipKind,
  type EvidenceRef,
  type NotebookState,
  type Stance,
} from "@/lib/research-types";

/** Hard cap on notebook size — oldest clips drop first once exceeded. */
export const MAX_CLIPS = 60;

const CLIP_KINDS: ClipKind[] = ["verdict", "valuation", "scenario", "trade", "team", "question", "ledger", "note"];
const STANCES: Stance[] = ["supports", "challenges", "open"];
const EVIDENCE_KINDS: EvidenceRef["kind"][] = ["player", "team", "trade"];

function isClipKind(v: unknown): v is ClipKind {
  return typeof v === "string" && (CLIP_KINDS as string[]).includes(v);
}

function isStance(v: unknown): v is Stance {
  return typeof v === "string" && (STANCES as string[]).includes(v);
}

/** Newest-first cap: keep the MAX_CLIPS most recently captured clips. */
function capClips(clips: Clip[]): Clip[] {
  if (clips.length <= MAX_CLIPS) return clips;
  return [...clips].sort((a, b) => b.capturedAt - a.capturedAt).slice(0, MAX_CLIPS);
}

/** id: timestamp (base36) + random suffix — unique, sortable, url-safe. */
function makeClipId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Build a frozen clip from a capture site's payload. Stance always starts "open". */
export function makeClip(partial: Omit<Clip, "id" | "capturedAt">): Clip {
  return {
    ...partial,
    id: makeClipId(),
    capturedAt: Date.now(),
  };
}

function sanitizeRef(raw: unknown): EvidenceRef | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<EvidenceRef>;
  if (!EVIDENCE_KINDS.includes(r.kind as EvidenceRef["kind"])) return null;
  const slugs = Array.isArray(r.slugs) ? r.slugs.filter((s): s is string => typeof s === "string") : [];
  const label = typeof r.label === "string" ? r.label : "";
  const ref: EvidenceRef = { kind: r.kind as EvidenceRef["kind"], slugs, label };
  if (typeof r.team === "string") ref.team = r.team;
  return ref;
}

function sanitizeClip(raw: unknown): Clip | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<Clip> & { refs?: unknown[] };
  const id = typeof r.id === "string" && r.id ? r.id : makeClipId();
  const kind = isClipKind(r.kind) ? r.kind : "note";
  const stance = isStance(r.stance) ? r.stance : "open";
  const title = typeof r.title === "string" ? r.title : "";
  const detail = typeof r.detail === "string" ? r.detail : "";
  const refs = Array.isArray(r.refs) ? r.refs.map(sanitizeRef).filter((x): x is EvidenceRef => x !== null) : [];
  const lensName = typeof r.lensName === "string" && r.lensName ? r.lensName : "My lens";
  const assumptions = normalizeAssumptions(r.assumptions);
  const note = typeof r.note === "string" ? r.note : "";
  const sourcePath = typeof r.sourcePath === "string" && r.sourcePath ? r.sourcePath : "/";
  const capturedAt = Number.isFinite(r.capturedAt) ? (r.capturedAt as number) : Date.now();
  const clip: Clip = { id, kind, stance, title, detail, refs, lensName, assumptions, note, sourcePath, capturedAt };
  if (typeof r.questionId === "string" && r.questionId) clip.questionId = r.questionId;
  return clip;
}

/**
 * Tolerant deserializer: garbage, missing fields, or a null/empty
 * string (no localStorage entry yet) all resolve to a safe, clamped
 * NotebookState — never throws.
 */
export function parseNotebook(raw: string | null): NotebookState {
  if (!raw) return { ...EMPTY_NOTEBOOK };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...EMPTY_NOTEBOOK };
  }
  if (!parsed || typeof parsed !== "object") return { ...EMPTY_NOTEBOOK };
  const p = parsed as Partial<NotebookState> & { clips?: unknown[] };
  const hypothesis = typeof p.hypothesis === "string" ? p.hypothesis : "";
  const clips = Array.isArray(p.clips) ? p.clips.map(sanitizeClip).filter((c): c is Clip => c !== null) : [];
  const updatedAt = Number.isFinite(p.updatedAt) ? (p.updatedAt as number) : 0;
  return { hypothesis, clips: capClips(clips), updatedAt };
}

/** Add a clip (newest-first), enforcing the MAX_CLIPS cap. */
export function addClip(state: NotebookState, clip: Clip): NotebookState {
  return { ...state, clips: capClips([clip, ...state.clips]), updatedAt: Date.now() };
}

export function removeClip(state: NotebookState, id: string): NotebookState {
  return { ...state, clips: state.clips.filter((c) => c.id !== id), updatedAt: Date.now() };
}

export function setClipStance(state: NotebookState, id: string, stance: Stance): NotebookState {
  return {
    ...state,
    clips: state.clips.map((c) => (c.id === id ? { ...c, stance } : c)),
    updatedAt: Date.now(),
  };
}

export function setClipNote(state: NotebookState, id: string, note: string): NotebookState {
  return {
    ...state,
    clips: state.clips.map((c) => (c.id === id ? { ...c, note } : c)),
    updatedAt: Date.now(),
  };
}

export function setHypothesis(state: NotebookState, text: string): NotebookState {
  return { ...state, hypothesis: text, updatedAt: Date.now() };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Relative "time ago" label from an epoch-ms timestamp, for a clip's capture time. */
export function formatClipAge(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(diff / DAY_MS);
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}
