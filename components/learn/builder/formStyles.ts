/* ============================================================
 * components/learn/builder/formStyles.ts — shared inline style tokens for
 * the builder's plain-form inspectors, so every inspector/panel looks
 * consistent without inventing a parallel component library. Uses the same
 * CSS custom properties as styles/tokens/*.css.
 * ============================================================ */

import type { CSSProperties } from "react";

export const labelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.02em",
  color: "var(--bow-muted-text, #55585f)",
  display: "block",
  marginBottom: 4,
};

export const fieldStyle: CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid var(--bow-border, #d7d7db)",
  fontSize: 14,
  fontFamily: "inherit",
  background: "var(--bow-surface, #fff)",
  color: "inherit",
};

export const selectStyle: CSSProperties = { ...fieldStyle, width: "auto" };

export const rowStyle: CSSProperties = { display: "flex", gap: 8 };

export const fieldGroupStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 4 };

export const sectionStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 14,
  paddingBottom: 16,
  borderBottom: "1px solid var(--bow-border, #eee)",
  marginBottom: 16,
};
