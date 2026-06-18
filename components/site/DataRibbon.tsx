const TICKER: { label: string; value: string; color: string }[] = [
  { label: "SALARY CAP", value: "$140.6M", color: "#fff" },
  { label: "SECOND APRON", value: "$188.9M", color: "var(--bow-orange)" },
  { label: "TEAM VALUE", value: "$3.1B", color: "#fff" },
  { label: "TITLE ODDS", value: "14%", color: "#6f8bff" },
  { label: "CAP SPACE", value: "-$8.4M", color: "var(--bow-negative)" },
  { label: "LUXURY TAX", value: "$31M", color: "var(--bow-warning)" },
  { label: "REVENUE", value: "$402M", color: "#fff" },
  { label: "TRADE EXCEPTION", value: "$12.2M", color: "#fff" },
];

/** The data ribbon — BOW's one allowed continuous motion (the ticker). */
export default function DataRibbon() {
  const items = [...TICKER, ...TICKER];
  return (
    <div style={{ background: "var(--bow-ink)", color: "#fff", borderBottom: "1px solid var(--bow-dark-border)", overflow: "hidden", padding: "12px 0" }}>
      <div
        className="bow-marquee"
        style={{
          display: "flex",
          gap: 48,
          width: "max-content",
          fontFamily: "var(--font-data)",
          fontSize: 13,
          letterSpacing: "0.06em",
          whiteSpace: "nowrap",
        }}
      >
        {items.map((it, i) => (
          <span key={i} style={{ color: "#9a9da6" }}>
            {it.label}&nbsp;&nbsp;<span style={{ color: it.color }}>{it.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
