/* The data ribbon — BOW's one allowed continuous motion (the ticker).
 *
 * Colour here is *semantic*, not decorative. Previously every other line was
 * tinted a different signal colour (orange / blue / red / amber) purely for
 * variety, which put four signal colours on screen before a visitor had read
 * a single word — and taught them that the colours mean nothing. Now only
 * genuinely negative figures are marked, in one colour, so the ticker reads
 * the way a real cap sheet does. */

interface Tick {
  label: string;
  value: string;
  /** True only where the figure is genuinely a deficit or a penalty. */
  negative?: boolean;
}

const TICKER: Tick[] = [
  { label: "SALARY CAP", value: "$140.6M" },
  { label: "SECOND APRON", value: "$188.9M" },
  { label: "TEAM VALUE", value: "$3.1B" },
  { label: "TITLE ODDS", value: "14%" },
  { label: "CAP SPACE", value: "-$8.4M", negative: true },
  { label: "LUXURY TAX", value: "$31M", negative: true },
  { label: "REVENUE", value: "$402M" },
  { label: "TRADE EXCEPTION", value: "$12.2M" },
];

export default function DataRibbon() {
  const items = [...TICKER, ...TICKER];
  return (
    <div
      aria-hidden="true"
      style={{
        background: "var(--bow-ink)",
        color: "var(--bow-on-ink)",
        borderBottom: "1px solid var(--bow-dark-border)",
        overflow: "hidden",
        padding: "11px 0",
      }}
    >
      <div
        className="bow-marquee bow-data"
        style={{
          display: "flex",
          gap: 44,
          width: "max-content",
          fontSize: "var(--type-meta)",
          letterSpacing: "0.06em",
          whiteSpace: "nowrap",
        }}
      >
        {items.map((it, i) => (
          <span key={i} style={{ color: "var(--bow-on-ink-subtle)" }}>
            {it.label}&nbsp;&nbsp;
            <span style={{ color: it.negative ? "var(--bow-negative)" : "var(--bow-on-ink)" }}>{it.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
