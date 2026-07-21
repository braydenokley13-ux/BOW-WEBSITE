/* ============================================================
 * lib/learn/compat.ts — schemaVersion migration layer.
 *
 * Read path for every LessonDoc, everywhere: raw doc → detect schemaVersion
 * → run registered vN→vN+1 migrators in sequence → zod-validate the result
 * → render. Published docs (learn_lesson_versions.doc) are never mutated in
 * place; the engine schema evolves by adding a migrator here, not by
 * rewriting history.
 * ============================================================ */

import { LessonDocSchema, type LessonDoc } from "./schema";

/** A migrator transforms a doc at version N into the shape for N+1. */
export type Migrator = (doc: unknown) => unknown;

/**
 * Registry of migrators keyed by the version they migrate FROM.
 * Empty for now — schemaVersion 1 is the only version that exists.
 * When schemaVersion 2 is introduced, add `migrators[1] = (doc) => {...}`.
 */
export const migrators: Record<number, Migrator> = {};

export const CURRENT_SCHEMA_VERSION = 1;

function detectSchemaVersion(raw: unknown): number {
  if (
    raw &&
    typeof raw === "object" &&
    "schemaVersion" in raw &&
    typeof (raw as { schemaVersion: unknown }).schemaVersion === "number"
  ) {
    return (raw as { schemaVersion: number }).schemaVersion;
  }
  throw new Error("[learn/compat] LessonDoc is missing a numeric schemaVersion");
}

/**
 * Detect the doc's schemaVersion, run every registered migrator from that
 * version up to CURRENT_SCHEMA_VERSION in order, then validate against the
 * current schema. Throws if the version is newer than this build knows
 * about, or if no migrator path exists to the current version.
 */
export function migrateLessonDoc(raw: unknown): LessonDoc {
  let version = detectSchemaVersion(raw);
  let doc = raw;

  if (version > CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `[learn/compat] LessonDoc schemaVersion ${version} is newer than this build supports (max ${CURRENT_SCHEMA_VERSION})`,
    );
  }

  while (version < CURRENT_SCHEMA_VERSION) {
    const migrate = migrators[version];
    if (!migrate) {
      throw new Error(
        `[learn/compat] No migrator registered from schemaVersion ${version} to ${version + 1}`,
      );
    }
    doc = migrate(doc);
    version += 1;
  }

  return LessonDocSchema.parse(doc);
}
