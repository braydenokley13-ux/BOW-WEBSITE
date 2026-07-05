import type { ReactNode } from "react";

interface EvidenceCardProps {
  kicker: string;
  action?: ReactNode;
  children: ReactNode;
}

/**
 * EvidenceCard — the case file's bordered evidence exhibit. Same
 * bordered-panel idiom components/analytics/embeds.tsx already uses for
 * ContractVerdictEmbed / TradeAnalysisView / TeamCapSheetEmbed, so a
 * question's evidence looks like it belongs to the same desk as every
 * other analytics surface — just with a ClipButton where those embeds
 * put their provenance caption.
 */
export default function EvidenceCard({ kicker, action, children }: EvidenceCardProps) {
  return (
    <div
      style={{
        border: "1px solid var(--border-rule)",
        background: "var(--bow-white)",
        padding: "clamp(18px,2.4vw,26px)",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--bow-orange)",
          }}
        >
          {kicker}
        </span>
        {action}
      </div>
      {children}
    </div>
  );
}
