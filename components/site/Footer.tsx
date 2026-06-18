import Link from "next/link";
import { FOOTER_COLS, SITE } from "@/lib/site";

export default function Footer() {
  return (
    <footer style={{ background: "var(--bow-ink)", color: "#fff", padding: "clamp(48px,6vw,80px) clamp(18px,4vw,40px) 36px" }}>
      <div className="bow-container-wide">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 36 }}>
          <div style={{ gridColumn: "1 / -1", maxWidth: 420, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 0.8 }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 30, letterSpacing: "-0.02em", textTransform: "uppercase" }}>BOW</span>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 10, letterSpacing: "0.34em", color: "#9a9da6", textTransform: "uppercase", marginTop: 3 }}>
                {SITE.tagline}
              </span>
            </div>
            <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.55, color: "#9a9da6" }}>{SITE.blurb}</p>
          </div>
          {FOOTER_COLS.map((col) => (
            <div key={col.head} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6d7078" }}>
                {col.head}
              </span>
              {col.links.map((lk) => (
                <Link key={lk.label} href={lk.href} className="bow-link" style={{ fontFamily: "var(--font-interface)", fontSize: 14, color: "#c8cad0" }}>
                  {lk.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: 48,
            paddingTop: 22,
            borderTop: "1px solid var(--bow-dark-border)",
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            justifyContent: "space-between",
            fontFamily: "var(--font-data)",
            fontSize: 12,
            color: "#6d7078",
          }}
        >
          <span>© {new Date().getFullYear()} BOW SPORTS CAPITAL</span>
          <span>EDITORIAL ON THE OUTSIDE · FRONT OFFICE ON THE INSIDE</span>
        </div>
      </div>
    </footer>
  );
}
