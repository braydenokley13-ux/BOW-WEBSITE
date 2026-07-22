/* ============================================================
 * lib/learn/mapOrder.ts — pure reorder math for the map editor's
 * moveMapNode server action (app/actions/learn-author.ts). Extracted so
 * the within-section / cross-section resequencing logic is unit-testable
 * without a database.
 * ============================================================ */

/** Clamp `index` into the valid insertion range [0, length]. */
export function clampIndex(index: number, length: number): number {
  return Math.max(0, Math.min(index, length));
}

/** Reorder a single list: remove `movingId` if present, then insert it at `toIndex` (clamped). */
export function reorderWithinList(ids: string[], movingId: string, toIndex: number): string[] {
  const rest = ids.filter((id) => id !== movingId);
  const next = rest.slice();
  next.splice(clampIndex(toIndex, rest.length), 0, movingId);
  return next;
}

/**
 * Move `movingId` from `fromIds` (its current container, movingId excluded
 * by the caller) into `toIds` at `toIndex` (clamped). Returns the new
 * `{ fromIds, toIds }` pair, both freshly sequenced 0..n-1 by array order.
 */
export function moveBetweenLists(fromIds: string[], toIds: string[], movingId: string, toIndex: number): { fromIds: string[]; toIds: string[] } {
  const nextTo = toIds.slice();
  nextTo.splice(clampIndex(toIndex, toIds.length), 0, movingId);
  return { fromIds: fromIds.filter((id) => id !== movingId), toIds: nextTo };
}
