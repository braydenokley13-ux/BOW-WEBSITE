import type { ReactNode } from "react";
import { CapLine, Eyebrow } from "@/components/ds";

interface MemoSectionProps {
  label: string;
  children: ReactNode;
}

/**
 * MemoSection — a labeled memo section wrapper (eyebrow + CapLine rule +
 * content) so player and team pages compose consistently, the same way
 * ds/FrontOfficeMemo composes its internal sections.
 */
export default function MemoSection({ label, children }: MemoSectionProps) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Eyebrow color="slate">{label}</Eyebrow>
      <CapLine weight={3} step={8} stepAt={0.22} width="80px" />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>
    </section>
  );
}
