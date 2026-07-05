"use client";

/* ============================================================
 * ClipButton — the universal capture affordance.
 *
 * Appears next to verdicts, valuations, scenario bands, trade
 * analyses, team briefs, and docket questions across the analytics
 * surfaces. One click freezes the CURRENT model read — assumptions
 * (useAssumptions), the active worldview's name (useLens), and the
 * route it was clipped from (usePathname) — into a Clip with stance
 * "open", and drops it in the reader's notebook (useNotebook).
 *
 * Deliberately quiet: mono, uppercase, letterspaced, 1px border, no
 * fill. A brief confirmation swap ("Clipped — in your notebook")
 * is the only feedback — never a modal, never a toast that steals
 * focus.
 * ============================================================ */

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { usePathname } from "next/navigation";
import { useAssumptions } from "@/components/analytics/useAssumptions";
import { useLens } from "@/components/research/useLens";
import { useNotebook } from "@/components/research/useNotebook";
import { makeClip } from "@/lib/notebook";
import type { ClipKind, EvidenceRef } from "@/lib/research-types";

const CONFIRM_MS = 1800;

const baseStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  fontFamily: "var(--font-data)",
  fontWeight: 500,
  fontSize: 11,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  background: "transparent",
  border: "1px solid var(--border-rule)",
  borderRadius: 2,
  padding: "4px 8px",
  cursor: "pointer",
  color: "var(--bow-slate)",
  lineHeight: 1.2,
  whiteSpace: "nowrap",
};

export interface ClipButtonProps {
  kind: ClipKind;
  title: string;
  detail: string;
  refs: EvidenceRef[];
  questionId?: string;
  dark?: boolean;
  style?: CSSProperties;
}

export default function ClipButton({ kind, title, detail, refs, questionId, dark, style }: ClipButtonProps) {
  const [assumptions] = useAssumptions();
  const { lensName } = useLens();
  const pathname = usePathname();
  const { add } = useNotebook();
  const [confirmed, setConfirmed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function handleClick() {
    const clip = makeClip({
      kind,
      stance: "open",
      title,
      detail,
      refs,
      lensName,
      assumptions,
      note: "",
      sourcePath: pathname || "/",
      ...(questionId ? { questionId } : {}),
    });
    add(clip);
    setConfirmed(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setConfirmed(false), CONFIRM_MS);
  }

  const dynamicStyle: CSSProperties = dark
    ? { color: "#9a9da6", borderColor: "var(--bow-dark-border)" }
    : {};

  const confirmedStyle: CSSProperties = confirmed
    ? { color: "var(--bow-positive)", borderColor: "var(--bow-positive)" }
    : {};

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-live="polite"
      style={{ ...baseStyle, ...dynamicStyle, ...confirmedStyle, ...style }}
    >
      {confirmed ? "Clipped — in your notebook" : "+ Clip"}
    </button>
  );
}
