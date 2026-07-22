/* ============================================================
 * lib/learn/regenerateIds.ts — regenerate every phase/block id in a
 * LessonDoc, remapping branch targets (goTo / branch map) consistently.
 *
 * Used by app/actions/learn-author.ts's duplicateLesson (and therefore
 * createFromTemplate) so a duplicated lesson never shares ids with its
 * source — publishing both independently must never collide. Pure/
 * isomorphic so it's unit-testable without a DB or "use server" context
 * (tests/learn/regenerateIds.test.ts).
 * ============================================================ */

import type { LessonDoc } from "./types";

function browserOrNodeUuid(): string {
  return typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function regenerateLessonDocIds(doc: LessonDoc): LessonDoc {
  const idMap = new Map<string, string>();
  for (const phase of doc.phases) {
    idMap.set(phase.id, `phase-${browserOrNodeUuid().replace(/-/g, "").slice(0, 8)}`);
    for (const block of phase.blocks) {
      idMap.set(block.id, `block-${browserOrNodeUuid().replace(/-/g, "").slice(0, 8)}`);
    }
  }
  const remap = (id: string | undefined): string | undefined => (id ? (idMap.get(id) ?? id) : id);

  const next: LessonDoc = JSON.parse(JSON.stringify(doc));
  next.phases = next.phases.map((phase) => ({
    ...phase,
    id: idMap.get(phase.id) ?? phase.id,
    blocks: phase.blocks.map((block) => {
      const b = { ...block, id: idMap.get(block.id) ?? block.id } as typeof block & {
        options?: { goTo?: string }[];
        choices?: { goTo?: string }[];
        branch?: Record<string, string>;
      };
      if (Array.isArray(b.options)) b.options = b.options.map((o) => ({ ...o, goTo: remap(o.goTo) }));
      if (Array.isArray(b.choices)) b.choices = b.choices.map((c) => ({ ...c, goTo: remap(c.goTo) }));
      if (b.branch) {
        const remapped: Record<string, string> = {};
        for (const [k, v] of Object.entries(b.branch)) remapped[k] = remap(v) ?? v;
        b.branch = remapped;
      }
      return b;
    }),
  }));
  return next;
}
