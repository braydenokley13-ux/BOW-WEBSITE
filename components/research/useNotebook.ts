"use client";

/* ============================================================
 * useNotebook — the reader's evidence notebook, persisted.
 *
 * Same useSyncExternalStore idiom as useAssumptions
 * (components/analytics/useAssumptions.ts), but on localStorage
 * instead of sessionStorage: clips are meant to survive well past
 * the browser session, across the sliders moving and the nightly
 * stat ingest. A custom window event keeps every mounted
 * ClipButton / NotebookTray / NotebookWorkbench in sync the instant
 * one of them writes.
 * ============================================================ */

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { addClip, parseNotebook, removeClip, setClipNote, setClipStance, setHypothesis } from "@/lib/notebook";
import { EMPTY_NOTEBOOK, type Clip, type NotebookState, type Stance } from "@/lib/research-types";

const STORAGE_KEY = "bow-notebook-v1";
const CHANGE_EVENT = "bow-notebook";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function getSnapshot(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function getServerSnapshot(): string {
  return "";
}

function write(next: NotebookState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    /* storage blocked — the notebook just won't persist this write */
  }
}

export interface NotebookStore {
  notebook: NotebookState;
  clipCount: number;
  add(clip: Clip): void;
  remove(id: string): void;
  setStance(id: string, stance: Stance): void;
  setNote(id: string, note: string): void;
  setHypothesis(text: string): void;
  clear(): void;
}

export function useNotebook(): NotebookStore {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const notebook = useMemo<NotebookState>(() => (raw ? parseNotebook(raw) : { ...EMPTY_NOTEBOOK }), [raw]);

  const add = useCallback((clip: Clip) => write(addClip(parseNotebook(getSnapshot()), clip)), []);
  const remove = useCallback((id: string) => write(removeClip(parseNotebook(getSnapshot()), id)), []);
  const setStance = useCallback(
    (id: string, stance: Stance) => write(setClipStance(parseNotebook(getSnapshot()), id, stance)),
    [],
  );
  const setNote = useCallback((id: string, note: string) => write(setClipNote(parseNotebook(getSnapshot()), id, note)), []);
  const setHyp = useCallback((text: string) => write(setHypothesis(parseNotebook(getSnapshot()), text)), []);
  const clear = useCallback(() => write({ ...EMPTY_NOTEBOOK }), []);

  return {
    notebook,
    clipCount: notebook.clips.length,
    add,
    remove,
    setStance,
    setNote,
    setHypothesis: setHyp,
    clear,
  };
}
