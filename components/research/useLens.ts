"use client";

/* ============================================================
 * useLens — the active worldview, derived (never stored).
 *
 * A lens is "selected" by writing its assumptions into the existing
 * useAssumptions sessionStorage store, so every live surface on the
 * site — dashboard, memos, embeds, trade machine — recomputes under
 * the new worldview with zero extra wiring. The active lens is then
 * DERIVED by matching current assumptions back against the presets;
 * the moment the reader drags any slider by hand, no preset matches
 * and the lens resolves to "My lens". One source of truth, no sync.
 * ============================================================ */

import { useCallback } from "react";
import { useAssumptions } from "@/components/analytics/useAssumptions";
import { activeLensId, getLens, lensDisplayName, matchLens } from "@/lib/lenses";
import type { Lens } from "@/lib/research-types";

export interface LensState {
  /** The matched preset, or null when sliders were moved by hand. */
  lens: Lens | null;
  /** Preset id or CUSTOM_LENS_ID. */
  lensId: string;
  /** Always human-readable: a preset's name or "My lens". */
  lensName: string;
  /** Adopt a preset worldview (writes its assumptions into the shared store). */
  setLens: (id: string) => void;
}

export function useLens(): LensState {
  const [assumptions, update] = useAssumptions();

  const setLens = useCallback(
    (id: string) => {
      const preset = getLens(id);
      if (preset) update({ ...preset.assumptions, apronMultipliers: { ...preset.assumptions.apronMultipliers } });
    },
    [update],
  );

  return {
    lens: matchLens(assumptions),
    lensId: activeLensId(assumptions),
    lensName: lensDisplayName(assumptions),
    setLens,
  };
}
