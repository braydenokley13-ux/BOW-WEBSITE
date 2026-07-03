"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { DEFAULT_ASSUMPTIONS, normalizeAssumptions, type Assumptions } from "@/lib/aasv";

const STORAGE_KEY = "bow-aasv-assumptions-v1";
const CHANGE_EVENT = "bow-aasv-assumptions";

/* sessionStorage as an external store: the server snapshot is empty
 * (defaults), the client snapshot is whatever the session saved, and a
 * custom event keeps every mounted slider panel in sync. */

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
    return sessionStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function getServerSnapshot(): string {
  return "";
}

/**
 * The model's assumption sliders, persisted per browser session so the
 * dashboard, player pages, and editor preview share one set of knobs.
 */
export function useAssumptions(): [Assumptions, (next: Assumptions) => void, () => void] {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const assumptions = useMemo<Assumptions>(() => {
    if (!raw) return DEFAULT_ASSUMPTIONS;
    try {
      return normalizeAssumptions(JSON.parse(raw));
    } catch {
      return DEFAULT_ASSUMPTIONS;
    }
  }, [raw]);

  const update = useCallback((next: Assumptions) => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(CHANGE_EVENT));
    } catch {
      /* storage blocked — sliders just won't persist */
    }
  }, []);

  const reset = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      window.dispatchEvent(new Event(CHANGE_EVENT));
    } catch {
      /* ignore */
    }
  }, []);

  return [assumptions, update, reset];
}
