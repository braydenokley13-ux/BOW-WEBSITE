import { CapLine, DataStrip, Eyebrow } from "@/components/ds";
import type { DataItem } from "@/components/ds";
import type { ContractVerdict } from "@/lib/intelligence-types";
import VerdictBadge from "./VerdictBadge";

export interface ExecutiveSummaryStat {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "neutral";
}

interface ExecutiveSummaryProps {
  eyebrow: string;
  headline: string;
  verdict?: ContractVerdict;
  stats: ExecutiveSummaryStat[];
  recommendation?: { action: string; rationale: string };
}

/**
 * ExecutiveSummary — the hero card of a decision page. Bloomberg-terminal
 * calm meets editorial voice: eyebrow, serif headline, verdict badge, a
 * DataStrip of key figures, and (optionally) the recommendation a GM would
 * act on. Composed from ds/Eyebrow, ds/CapLine, ds/DataStrip.
 */
export default function ExecutiveSummary({ eyebrow, headline, verdict, stats, recommendation }: ExecutiveSummaryProps) {
  const items: DataItem[] = stats.map((s) => ({
    label: s.label,
    value: s.value,
    tone: s.tone === "neutral" ? undefined : s.tone,
  }));

  return (
    <section
      style={{
        background: "var(--bow-white)",
        border: "1px solid var(--border-rule)",
        borderTop: "4px solid var(--bow-blue)",
        borderRadius: "var(--radius-card)",
        padding: "clamp(22px,3vw,36px)",
        display: "flex",
        flexDirection: "column",
        gap: 22,
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 660 }}>
          <Eyebrow color="blue">{eyebrow}</Eyebrow>
          <h2
            style={{
              margin: 0,
              fontFamily: "var(--font-editorial)",
              fontWeight: 600,
              fontSize: "clamp(26px,3.4vw,38px)",
              lineHeight: 1.14,
              color: "var(--bow-ink)",
              textWrap: "balance",
            }}
          >
            {headline}
          </h2>
        </div>
        {verdict && <VerdictBadge tier={verdict.tier} size="lg" />}
      </div>

      <CapLine weight={4} step={12} stepAt={0.4} />

      <DataStrip items={items} />

      {verdict && (
        <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 16, lineHeight: 1.6, color: "var(--bow-ink)", textWrap: "pretty" }}>
          {verdict.headline}
        </p>
      )}

      {recommendation && (
        <div style={{ borderLeft: "4px solid var(--bow-orange)", paddingLeft: 16, display: "flex", flexDirection: "column", gap: 6 }}>
          <span
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--bow-orange)",
            }}
          >
            {recommendation.action}
          </span>
          <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.55, color: "var(--bow-ink)" }}>
            {recommendation.rationale}
          </p>
        </div>
      )}
    </section>
  );
}
