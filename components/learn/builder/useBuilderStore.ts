"use client";

/* ============================================================
 * components/learn/builder/useBuilderStore.ts — React binding for
 * builderReducer.ts: undo/redo, selection, dirty tracking, debounced (~3s
 * idle) autosave via saveDraft with the revision token, conflict state.
 * ============================================================ */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { LessonDoc } from "@/lib/learn/types";
import { saveDraft } from "@/app/actions/learn-author";
import { builderReducer, initBuilderState, type BuilderAction, type BuilderState } from "./builderReducer";

const AUTOSAVE_IDLE_MS = 3000;

export type ConflictState = { serverRevision: number; serverUpdatedAt: number | null } | null;
export type SaveNowResult =
  | { ok: true; revision: number }
  | { ok: false; reason: "conflict" | "validation" | "error"; error: string };

export interface UseBuilderStore {
  state: BuilderState;
  dispatch: (action: BuilderAction) => void;
  canUndo: boolean;
  canRedo: boolean;
  saving: boolean;
  saveError: string | null;
  conflict: ConflictState;
  lastSavedAt: number | null;
  /** Force an immediate save. A successful result identifies the exact synchronized server revision. */
  saveNow: () => Promise<SaveNowResult>;
  resolveConflictLoadNewest: (serverDoc: LessonDoc, serverRevision: number) => void;
  resolveConflictKeepWorking: () => Promise<number | null>;
  clearConflict: () => void;
}

export function useBuilderStore(lessonId: string, initialDoc: LessonDoc, initialRevision: number): UseBuilderStore {
  const [state, dispatch] = useReducer(builderReducer, undefined, () => initBuilderState(initialDoc, initialRevision));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ConflictState>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSave = useCallback(async (): Promise<SaveNowResult> => {
    const current = stateRef.current;
    setSaving(true);
    setSaveError(null);
    try {
      const result = await saveDraft(lessonId, current.doc, current.baseRevision);
      if (result.ok) {
        dispatch({ type: "MARK_SAVED", baseRevision: result.newRevision });
        setLastSavedAt(Date.now());
        return { ok: true, revision: result.newRevision };
      }
      if ("conflict" in result && result.conflict) {
        setConflict({ serverRevision: result.serverRevision, serverUpdatedAt: result.serverUpdatedAt });
        return { ok: false, reason: "conflict", error: "This lesson changed in another tab. Resolve the conflict before publishing." };
      }
      const error = "error" in result ? result.error : "Failed to save draft";
      setSaveError(error);
      return { ok: false, reason: error.startsWith("Invalid lesson document") ? "validation" : "error", error };
    } catch (err) {
      const error = err instanceof Error ? err.message : "Failed to save draft";
      setSaveError(error);
      return { ok: false, reason: "error", error };
    } finally {
      setSaving(false);
    }
  }, [lessonId]);

  // Debounced autosave — resets on every dirty change, fires ~3s after idle.
  useEffect(() => {
    if (!state.dirty || conflict) return undefined;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void doSave();
    }, AUTOSAVE_IDLE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [state.doc, state.dirty, conflict, doSave]);

  // Warn on tab close/navigation away with unsaved edits — autosave is
  // debounced ~3s, so a fast close/navigate can otherwise lose work silently.
  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (!state.dirty) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [state.dirty]);

  const resolveConflictLoadNewest = useCallback((serverDoc: LessonDoc, serverRevision: number) => {
    dispatch({ type: "REPLACE_DOC", doc: serverDoc, baseRevision: serverRevision });
    setConflict(null);
  }, []);

  const resolveConflictKeepWorking = useCallback(async (): Promise<number | null> => {
    // Explicit overwrite: re-read the server's current revision, then save
    // again against that base so this becomes a normal (non-conflicting) save.
    setConflict(null);
    const current = stateRef.current;
    if (!conflict) {
      const result = await doSave();
      return result.ok ? result.revision : null;
    }
    dispatch({ type: "MARK_SAVED", baseRevision: conflict.serverRevision });
    setSaving(true);
    try {
      const result = await saveDraft(lessonId, current.doc, conflict.serverRevision);
      if (result.ok) {
        dispatch({ type: "MARK_SAVED", baseRevision: result.newRevision });
        setLastSavedAt(Date.now());
        return result.newRevision;
      }
      if ("conflict" in result && result.conflict) {
        setConflict({ serverRevision: result.serverRevision, serverUpdatedAt: result.serverUpdatedAt });
        return null;
      }
      setSaveError("error" in result ? result.error : "Failed to save draft");
      return null;
    } finally {
      setSaving(false);
    }
  }, [conflict, doSave, lessonId]);

  const clearConflict = useCallback(() => setConflict(null), []);

  return useMemo(
    () => ({
      state,
      dispatch,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
      saving,
      saveError,
      conflict,
      lastSavedAt,
      saveNow: doSave,
      resolveConflictLoadNewest,
      resolveConflictKeepWorking,
      clearConflict,
    }),
    [state, saving, saveError, conflict, lastSavedAt, doSave, resolveConflictLoadNewest, resolveConflictKeepWorking, clearConflict],
  );
}
