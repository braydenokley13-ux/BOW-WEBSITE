type DecisionTone = "action" | "warning" | "watch";

interface DecisionModuleProps {
  title: string;
  body: string;
  tone?: DecisionTone;
  eyebrow?: string;
}

const TONE: Record<DecisionTone, { accent: string; kicker: string }> = {
  action: { accent: "var(--bow-orange)", kicker: "Next Decision" },
  warning: { accent: "var(--bow-negative)", kicker: "Warning" },
  watch: { accent: "var(--bow-blue)", kicker: "Watch Item" },
};

/**
 * DecisionModule — the static "next decision" block for player/team briefs.
 * Sibling of ds/DecisionCard's dark front-office shell, but presentational
 * only (no options, no state) since the caller already knows the decision.
 */
export default function DecisionModule({ title, body, tone = "action", eyebrow }: DecisionModuleProps) {
  const t = TONE[tone];
  return (
    <div
      className="bow-front-office"
      style={{
        border: "1px solid var(--bow-dark-border)",
        borderTop: `4px solid ${t.accent}`,
        background: "var(--bow-ink)",
        color: "var(--bow-white)",
        padding: "clamp(20px,2.6vw,28px)",
        borderRadius: "var(--radius-card)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: t.accent,
        }}
      >
        {eyebrow ?? t.kicker}
      </span>
      <h3 style={{ margin: 0, fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: 22, lineHeight: 1.22, color: "var(--bow-white)", textWrap: "balance" }}>
        {title}
      </h3>
      <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.6, color: "#c8cad0", textWrap: "pretty" }}>{body}</p>
    </div>
  );
}
