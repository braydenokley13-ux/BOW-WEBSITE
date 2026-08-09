/* ============================================================
 * Strict validation for owner-authored website content.
 *
 * Stored content is parsed leniently so an old or malformed row can never
 * crash a public page. Writes need the opposite rule: reject a bad value and
 * tell the owner which visible field needs attention. The field catalog is the
 * source of truth for this check, so the editor and validator stay aligned.
 *
 * Browser-safe and side-effect free; tests import these helpers directly.
 * ============================================================ */

import { sectionFields, type FieldSpec } from "@/lib/cms/fields";
import { isSectionKind, validateSectionData } from "@/lib/cms/sections";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isSafeEditorialUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith("#")) return true;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return true;
  if (/^(mailto:|tel:)/i.test(trimmed)) return true;

  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isSafeEditorialImageUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return true;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validateFields(fields: FieldSpec[], data: Record<string, unknown>, prefix = ""): string | null {
  for (const field of fields) {
    const value = data[field.name];
    if (value === undefined || value === null) continue;

    const label = prefix ? `${prefix} → ${field.label}` : field.label;
    if (["text", "textarea", "richtext", "image", "url", "strings"].includes(field.type)) {
      if (field.type === "strings") {
        if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
          return `${label} must be a list of text items.`;
        }
      } else if (typeof value !== "string") {
        return `${label} must be text.`;
      } else if (field.type === "url" && !isSafeEditorialUrl(value)) {
        return `${label} must be a page path such as /programs or a complete http(s) web address.`;
      } else if (field.type === "image" && !isSafeEditorialImageUrl(value)) {
        return `${label} must be an image path such as /image.png or a complete http(s) web address.`;
      }
      continue;
    }

    if (field.type === "boolean" && typeof value !== "boolean") {
      return `${label} must be yes or no.`;
    }
    if (field.type === "number" && (typeof value !== "number" || !Number.isFinite(value))) {
      return `${label} must be a number.`;
    }
    if (field.type === "select") {
      if (typeof value !== "string") return `${label} has an invalid choice.`;
      if (field.options && !field.options.some((option) => option.value === value)) {
        return `${label} has an invalid choice.`;
      }
    }
    if (field.type === "repeater") {
      if (!Array.isArray(value)) return `${label} must be a list.`;
      for (let index = 0; index < value.length; index += 1) {
        const row = value[index];
        if (!isRecord(row)) return `${label}, item ${index + 1}, is invalid.`;
        const problem = validateFields(field.itemFields ?? [], row, `${label}, item ${index + 1}`);
        if (problem) return problem;
      }
    }
  }
  return null;
}

export function validateEditorSectionData(
  kind: string,
  raw: unknown,
): { ok: true; data: Record<string, unknown> } | { ok: false; message: string } {
  if (!isSectionKind(kind)) return { ok: false, message: `Unknown section type "${kind}".` };
  if (!isRecord(raw)) return { ok: false, message: "This section must contain labelled fields." };

  const fieldProblem = validateFields(sectionFields(kind), raw);
  if (fieldProblem) return { ok: false, message: fieldProblem };
  return validateSectionData(kind, raw);
}
