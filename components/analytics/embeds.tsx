import Link from "next/link";
import ApronBadge from "@/components/analytics/ApronBadge";
import ValueScatter from "@/components/analytics/ValueScatter";
import {
  DEFAULT_ASSUMPTIONS,
  fmtMillions,
  fmtSignedMillions,
  fmtWins,
  valuate,
  type AnalyticsPlayer,
  type Assumptions,
} from "@/lib/aasv";

/* ============================================================
 * Article data embeds — the presentational halves of the
 * <PlayerCard/>, <AASVChart/>, <AASVTable/> shortcodes.
 *
 * They receive already-fetched player rows (the article page and the
 * editor preview both prefetch via collectEmbedSlugs), compute values
 * with lib/aasv, and reuse the same visual language as /analytics —
 * so a number quoted in a story is ALWAYS the model's current number.
 * No directives: rendered by server pages and the client editor alike.
 * ============================================================ */

export function EmbedMissing({ slugs }: { slugs: string[] }) {
  return (
    <div
      style={{
        border: "1px dashed var(--bow-negative)",
        background: "var(--bow-negative-tint)",
        padding: "12px 16px",
        fontFamily: "var(--font-data)",
        fontSize: 13,
        color: "var(--bow-negative)",
        margin: "22px 0",
      }}
    >
      Unknown player{slugs.length > 1 ? "s" : ""} in embed: {slugs.join(", ")} — check the slug against the
      curated list on /analytics.
    </div>
  );
}

export function PlayerCardEmbed({ player, assumptions = DEFAULT_ASSUMPTIONS }: { player: AnalyticsPlayer; assumptions?: Assumptions }) {
  const v = valuate(player, assumptions);
  const positive = v.aasv >= 0;
  return (
    <aside
      className="bow-front-office"
      style={{ background: "var(--bow-ink)", color: "#fff", border: "1px solid var(--bow-dark-border)", margin: "26px 0", padding: 0 }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 18px", borderBottom: "1px solid var(--bow-dark-border)" }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
          Live model card · {player.season || "—"}
        </span>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6d7078" }}>
          {v.metricUsed ? `${v.metricUsed} ${v.impact > 0 ? "+" : ""}${v.impact.toFixed(1)}` : "no metric on file"} · {fmtWins(v.marginalWins)} wins
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "clamp(16px,3vw,32px)", padding: "18px 18px 16px" }}>
        <div style={{ flex: "1 1 200px", minWidth: 0 }}>
          <Link
            href={`/analytics/players/${player.slug}`}
            style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(22px,2.6vw,30px)", lineHeight: 0.95, textTransform: "uppercase", letterSpacing: "-0.01em", color: "#fff", textDecoration: "none" }}
          >
            {player.name} →
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9a9da6" }}>{player.team}</span>
            <ApronBadge status={player.apronStatus} compact />
          </div>
        </div>
        {[
          { label: "Cap hit", value: fmtMillions(player.capHit) },
          { label: `True cost (${v.apronMultiplier.toFixed(2)}×)`, value: fmtMillions(v.trueCost) },
          { label: "Production", value: fmtMillions(v.productionValue) },
        ].map((it) => (
          <div key={it.label}>
            <div style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6d7078" }}>{it.label}</div>
            <div style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: 20, color: "#fff", marginTop: 3 }}>{it.value}</div>
          </div>
        ))}
        <div style={{ borderLeft: "1px solid var(--bow-dark-border)", paddingLeft: "clamp(16px,2vw,28px)" }}>
          <div style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6d7078" }}>AASV</div>
          <div style={{ fontFamily: "var(--font-data)", fontWeight: 700, fontSize: 30, marginTop: 2, color: positive ? "#3ddc97" : "#ff7a6e" }}>
            {fmtSignedMillions(v.aasv)}
          </div>
        </div>
      </div>
    </aside>
  );
}

export function AASVTableEmbed({ players, assumptions = DEFAULT_ASSUMPTIONS }: { players: AnalyticsPlayer[]; assumptions?: Assumptions }) {
  const rows = players.map((p) => ({ p, v: valuate(p, assumptions) }));
  const th: React.CSSProperties = {
    padding: "8px 12px",
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: 11.5,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--bow-ink)",
    background: "var(--bow-paper)",
    borderBottom: "1px solid var(--border-rule)",
    textAlign: "right",
    whiteSpace: "nowrap",
  };
  const td: React.CSSProperties = {
    padding: "9px 12px",
    fontFamily: "var(--font-data)",
    fontSize: 13,
    fontVariantNumeric: "tabular-nums",
    textAlign: "right",
    whiteSpace: "nowrap",
  };
  return (
    <div style={{ margin: "26px 0", border: "1px solid var(--border-rule)", background: "var(--bow-white)", overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: "left" }}>Player</th>
            <th style={{ ...th, textAlign: "left" }}>Apron</th>
            <th style={th}>Cap hit</th>
            <th style={th}>True cost</th>
            <th style={th}>Production</th>
            <th style={th}>AASV</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ p, v }) => (
            <tr key={p.slug} style={{ borderTop: "1px solid var(--border-rule)" }}>
              <td style={{ ...td, textAlign: "left", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, textTransform: "uppercase" }}>
                <Link href={`/analytics/players/${p.slug}`} className="bow-link" style={{ color: "var(--bow-ink)", textDecoration: "none" }}>
                  {p.name}
                </Link>
              </td>
              <td style={{ ...td, textAlign: "left" }}>
                <ApronBadge status={p.apronStatus} compact />
              </td>
              <td style={td}>{fmtMillions(p.capHit)}</td>
              <td style={td}>{fmtMillions(v.trueCost)}</td>
              <td style={td}>{fmtMillions(v.productionValue)}</td>
              <td style={{ ...td, fontWeight: 700, color: v.aasv >= 0 ? "var(--bow-positive)" : "var(--bow-negative)" }}>{fmtSignedMillions(v.aasv)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ margin: 0, padding: "8px 12px", fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--bow-slate)", borderTop: "1px solid var(--border-rule)" }}>
        Live values at default model assumptions · adjust them on the <Link href="/analytics" style={{ color: "var(--bow-blue)" }}>dashboard</Link>
      </p>
    </div>
  );
}

export function AASVChartEmbed({ players, assumptions = DEFAULT_ASSUMPTIONS }: { players: AnalyticsPlayer[]; assumptions?: Assumptions }) {
  return (
    <div style={{ margin: "26px 0" }}>
      <ValueScatter players={players} assumptions={assumptions} height={400} labelCount={players.length <= 6 ? players.length : 3} title="Live from the model" />
      <p style={{ margin: "6px 0 0", fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
        Rendered at default model assumptions · same chart, all players, on the <Link href="/analytics" style={{ color: "var(--bow-blue)" }}>dashboard</Link>
      </p>
    </div>
  );
}
