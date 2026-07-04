import Link from "next/link";
import type { Block, InlineNode } from "@/lib/markdown";
import type { AnalyticsPlayer } from "@/lib/aasv";
import { EmbedMissing, TrendChartEmbed } from "@/components/analytics/embeds";
import {
  LiveAASVChart,
  LiveAASVTable,
  LiveContractVerdict,
  LivePlayerCard,
  LiveScenarioBand,
  LiveTeamCapSheet,
  LiveTeamFlex,
  LiveTradeAnalysis,
} from "@/components/analytics/embeds/LiveAssumptions";
import type { SeasonStat } from "@/lib/nba";

/* ============================================================
 * MarkdownView — renders the publication's markdown AST with the
 * BOW editorial voice (Newsreader body, condensed display heads)
 * and resolves data embeds against a prefetched player map.
 *
 * Shared component (no directive): article pages render it on the
 * server; the admin editor renders the same component client-side
 * for a live preview that is pixel-identical to the real page.
 *
 * Assumption-aware embeds (everything but TrendChart, which has no
 * assumptions dependency) are rendered through the "Live*" wrappers in
 * components/analytics/embeds/LiveAssumptions — those are the ONE client
 * boundary in this tree; they read the reader's tuned sliders themselves
 * (falling back to the model defaults before hydration / with nothing
 * saved) and hand the result down as props to the same server-safe embed
 * components. MarkdownView never touches assumptions directly.
 * ============================================================ */

interface MarkdownViewProps {
  blocks: Block[];
  /** Prefetched players keyed by slug — the data the embeds draw from. TeamCapSheet needs every
   *  tracked player for the teams it references, not just embed-referenced slugs — see the
   *  article page's prefetch, which merges those in under the same shape. */
  players: Record<string, AnalyticsPlayer>;
  /** Season histories keyed by slug, for <TrendChart/> — only populated for embed-referenced slugs. */
  playerHistories?: Record<string, SeasonStat[]>;
  /** Full curated player list — <ContractVerdict/> and <TeamFlex/> rank/score against the whole
   *  tracked set, not just the slugs a given article happens to reference. */
  allPlayers?: AnalyticsPlayer[];
}

const BODY_FONT: React.CSSProperties = {
  fontFamily: "var(--font-editorial)",
  fontSize: "clamp(16.5px,1.5vw,19px)",
  lineHeight: 1.72,
  color: "var(--bow-ink)",
};

function renderInline(nodes: InlineNode[], keyPrefix = ""): React.ReactNode[] {
  return nodes.map((n, i) => {
    const key = `${keyPrefix}${i}`;
    switch (n.type) {
      case "text":
        return <span key={key}>{n.text}</span>;
      case "strong":
        return <strong key={key} style={{ fontWeight: 700 }}>{renderInline(n.children, `${key}-`)}</strong>;
      case "em":
        return <em key={key}>{renderInline(n.children, `${key}-`)}</em>;
      case "code":
        return (
          <code key={key} style={{ fontFamily: "var(--font-data)", fontSize: "0.85em", background: "var(--bow-paper)", border: "1px solid var(--border-rule)", padding: "1px 5px" }}>
            {n.text}
          </code>
        );
      case "link": {
        const external = /^https?:\/\//.test(n.href);
        const style: React.CSSProperties = { color: "var(--bow-blue)", textDecorationThickness: 1, textUnderlineOffset: 3 };
        return external ? (
          <a key={key} href={n.href} target="_blank" rel="noopener noreferrer" style={style}>
            {renderInline(n.children, `${key}-`)}
          </a>
        ) : (
          <Link key={key} href={n.href} style={style}>
            {renderInline(n.children, `${key}-`)}
          </Link>
        );
      }
      case "image":
        // eslint-disable-next-line @next/next/no-img-element
        return <img key={key} src={n.src} alt={n.alt} style={{ maxWidth: "100%", height: "auto", display: "inline-block", verticalAlign: "middle" }} />;
    }
  });
}

function EmbedBlock({
  block,
  players,
  playerHistories,
  allPlayers,
}: {
  block: Extract<Block, { type: "embed" }>;
  players: Record<string, AnalyticsPlayer>;
  playerHistories: Record<string, SeasonStat[]>;
  allPlayers: AnalyticsPlayer[];
}) {
  // TeamCapSheet / TeamFlex key off a team abbreviation, not a player slug —
  // aggregateTeam filters by team itself, so an unknown/empty team just
  // yields an empty rollup (each embed's own missing state).
  if (block.name === "TeamCapSheet") {
    const team = (block.attrs.team ?? "").trim().toUpperCase();
    return <LiveTeamCapSheet team={team} players={Object.values(players)} />;
  }
  if (block.name === "TeamFlex") {
    const team = (block.attrs.team ?? "").trim().toUpperCase();
    return <LiveTeamFlex team={team} allPlayers={allPlayers} />;
  }
  // TradeAnalysis keys off two slugs — a "send" and a "receive" — not the
  // shared player/players attrs, so resolve it before the generic path.
  if (block.name === "TradeAnalysis") {
    const sendSlug = (block.attrs.send ?? "").trim();
    const receiveSlug = (block.attrs.receive ?? "").trim();
    const pa = players[sendSlug];
    const pb = players[receiveSlug];
    if (!pa || !pb) {
      const missing: string[] = [];
      if (!pa) missing.push(sendSlug || "(no send)");
      if (!pb) missing.push(receiveSlug || "(no receive)");
      return <EmbedMissing slugs={missing} />;
    }
    return <LiveTradeAnalysis playerA={pa} playerB={pb} />;
  }

  const requested = (block.attrs.player ?? block.attrs.players ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const found = requested.map((s) => players[s]).filter((p): p is AnalyticsPlayer => Boolean(p));
  const missing = requested.filter((s) => !players[s]);

  if (requested.length === 0 || found.length === 0) {
    return <EmbedMissing slugs={requested.length ? requested : ["(no player attribute)"]} />;
  }

  return (
    <>
      {missing.length > 0 && <EmbedMissing slugs={missing} />}
      {block.name === "PlayerCard" && <LivePlayerCard player={found[0]} />}
      {block.name === "AASVChart" && <LiveAASVChart players={found} />}
      {block.name === "AASVTable" && <LiveAASVTable players={found} />}
      {block.name === "TrendChart" && <TrendChartEmbed player={found[0]} history={playerHistories[found[0].slug] ?? []} />}
      {block.name === "ContractVerdict" && <LiveContractVerdict player={found[0]} allPlayers={allPlayers} />}
      {block.name === "ScenarioBand" && <LiveScenarioBand player={found[0]} />}
    </>
  );
}

export default function MarkdownView({ blocks, players, playerHistories = {}, allPlayers = [] }: MarkdownViewProps) {
  return (
    <div>
      {blocks.map((b, i) => {
        switch (b.type) {
          case "heading": {
            if (b.level === 2) {
              return (
                <h2 key={i} style={{ margin: "38px 0 14px", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(23px,2.6vw,30px)", lineHeight: 1.15, letterSpacing: "-0.01em", color: "var(--bow-ink)" }}>
                  {renderInline(b.children, `h${i}-`)}
                </h2>
              );
            }
            if (b.level === 3) {
              return (
                <h3 key={i} style={{ margin: "30px 0 10px", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(18px,1.9vw,22px)", textTransform: "uppercase", letterSpacing: "0.01em", lineHeight: 1.05, color: "var(--bow-ink)" }}>
                  {renderInline(b.children, `h${i}-`)}
                </h3>
              );
            }
            return (
              <h4 key={i} style={{ margin: "24px 0 8px", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--bow-slate)" }}>
                {renderInline(b.children, `h${i}-`)}
              </h4>
            );
          }
          case "paragraph":
            return (
              <p key={i} style={{ ...BODY_FONT, margin: "0 0 20px" }}>
                {renderInline(b.children, `p${i}-`)}
              </p>
            );
          case "list": {
            const items = b.items.map((item, j) => (
              <li key={j} style={{ ...BODY_FONT, marginBottom: 8 }}>
                {renderInline(item, `l${i}-${j}-`)}
              </li>
            ));
            return b.ordered ? (
              <ol key={i} style={{ margin: "0 0 20px", paddingLeft: 26 }}>{items}</ol>
            ) : (
              <ul key={i} style={{ margin: "0 0 20px", paddingLeft: 24 }}>{items}</ul>
            );
          }
          case "blockquote":
            return (
              <blockquote key={i} style={{ margin: "26px 0", padding: "6px 0 6px 22px", borderLeft: "4px solid var(--bow-orange)" }}>
                {b.children.map((para, j) => (
                  <p key={j} style={{ ...BODY_FONT, fontSize: "clamp(18px,1.8vw,22px)", fontWeight: 500, fontStyle: "italic", lineHeight: 1.5, margin: j === b.children.length - 1 ? 0 : "0 0 12px" }}>
                    {renderInline(para, `q${i}-${j}-`)}
                  </p>
                ))}
              </blockquote>
            );
          case "code":
            return (
              <pre key={i} style={{ margin: "0 0 20px", padding: "14px 16px", background: "var(--bow-ink)", color: "#e6e6ea", overflowX: "auto", fontFamily: "var(--font-data)", fontSize: 13, lineHeight: 1.6 }}>
                <code>{b.text}</code>
              </pre>
            );
          case "hr":
            return <hr key={i} style={{ margin: "32px 0", border: "none", borderTop: "1px solid var(--border-rule)" }} />;
          case "image":
            return (
              <figure key={i} style={{ margin: "26px 0" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.src} alt={b.alt} style={{ maxWidth: "100%", height: "auto", display: "block", border: "1px solid var(--border-rule)" }} />
                {b.alt && (
                  <figcaption style={{ marginTop: 8, fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.04em", color: "var(--bow-slate)" }}>
                    {b.alt}
                  </figcaption>
                )}
              </figure>
            );
          case "embed":
            return <EmbedBlock key={i} block={b} players={players} playerHistories={playerHistories} allPlayers={allPlayers} />;
        }
      })}
    </div>
  );
}
