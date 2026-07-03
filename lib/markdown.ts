/* ============================================================
 * Markdown → AST for the analytics publication.
 *
 * A deliberately small, dependency-free parser covering the authoring
 * feature set the editor exposes: headings, bold/italic, inline code,
 * links, inline + block images, ordered/unordered lists, blockquotes,
 * fenced code blocks, horizontal rules — plus the publication's data
 * embeds, self-closing shortcodes on their own line:
 *
 *   <PlayerCard player="jaylen-brown" />
 *   <AASVChart players="jaylen-brown,jayson-tatum" />
 *   <AASVTable players="jaylen-brown,derrick-white" />
 *
 * Pure functions, no React and no I/O: the same parse runs on the
 * server (article pages) and in the browser (editor live preview).
 * Rendering lives in components/analytics/MarkdownView.
 * ============================================================ */

export type InlineNode =
  | { type: "text"; text: string }
  | { type: "strong"; children: InlineNode[] }
  | { type: "em"; children: InlineNode[] }
  | { type: "code"; text: string }
  | { type: "link"; href: string; children: InlineNode[] }
  | { type: "image"; alt: string; src: string };

export type EmbedName = "PlayerCard" | "AASVChart" | "AASVTable";

export type Block =
  | { type: "heading"; level: 2 | 3 | 4; children: InlineNode[] }
  | { type: "paragraph"; children: InlineNode[] }
  | { type: "list"; ordered: boolean; items: InlineNode[][] }
  | { type: "blockquote"; children: InlineNode[][] }
  | { type: "code"; text: string }
  | { type: "hr" }
  | { type: "image"; alt: string; src: string }
  | { type: "embed"; name: EmbedName; attrs: Record<string, string> };

const EMBED_NAMES: EmbedName[] = ["PlayerCard", "AASVChart", "AASVTable"];
const EMBED_RE = /^<(PlayerCard|AASVChart|AASVTable)\s*((?:\w+="[^"]*"\s*)*)\/>\s*$/;

/** Player slugs referenced by every embed in a document (to prefetch data in one query). */
export function collectEmbedSlugs(blocks: Block[]): string[] {
  const slugs = new Set<string>();
  for (const b of blocks) {
    if (b.type !== "embed") continue;
    const raw = b.attrs.player ?? b.attrs.players ?? "";
    for (const s of raw.split(",").map((x) => x.trim()).filter(Boolean)) slugs.add(s);
  }
  return [...slugs];
}

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === "") {
      i++;
      continue;
    }

    // Fenced code block
    if (trimmed.startsWith("```")) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        buf.push(lines[i]);
        i++;
      }
      i++; // closing fence
      blocks.push({ type: "code", text: buf.join("\n") });
      continue;
    }

    // Data embed shortcode
    const embed = trimmed.match(EMBED_RE);
    if (embed && EMBED_NAMES.includes(embed[1] as EmbedName)) {
      const attrs: Record<string, string> = {};
      for (const m of embed[2].matchAll(/(\w+)="([^"]*)"/g)) attrs[m[1]] = m[2];
      blocks.push({ type: "embed", name: embed[1] as EmbedName, attrs });
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    // Heading (# through ####; h1 is reserved for the article title, so cap at h2)
    const heading = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      const level = Math.max(2, Math.min(4, heading[1].length)) as 2 | 3 | 4;
      blocks.push({ type: "heading", level, children: parseInline(heading[2]) });
      i++;
      continue;
    }

    // Block image: a line that is exactly one image
    const blockImg = trimmed.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    if (blockImg) {
      blocks.push({ type: "image", alt: blockImg[1], src: blockImg[2] });
      i++;
      continue;
    }

    // Blockquote (consecutive > lines; blank quoted lines split paragraphs)
    if (trimmed.startsWith(">")) {
      const paras: InlineNode[][] = [];
      let buf: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        const inner = lines[i].trim().replace(/^>\s?/, "");
        if (inner === "") {
          if (buf.length) paras.push(parseInline(buf.join(" ")));
          buf = [];
        } else {
          buf.push(inner);
        }
        i++;
      }
      if (buf.length) paras.push(parseInline(buf.join(" ")));
      blocks.push({ type: "blockquote", children: paras });
      continue;
    }

    // Lists (unordered - / * or ordered 1.)
    const ulItem = /^[-*]\s+(.*)$/;
    const olItem = /^\d+[.)]\s+(.*)$/;
    if (ulItem.test(trimmed) || olItem.test(trimmed)) {
      const ordered = olItem.test(trimmed);
      const re = ordered ? olItem : ulItem;
      const items: InlineNode[][] = [];
      while (i < lines.length) {
        const m = lines[i].trim().match(re);
        if (!m) break;
        items.push(parseInline(m[1]));
        i++;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    // Paragraph: consecutive plain lines
    const buf: string[] = [line.trim()];
    i++;
    while (i < lines.length) {
      const t = lines[i].trim();
      if (
        t === "" ||
        t.startsWith("#") ||
        t.startsWith(">") ||
        t.startsWith("```") ||
        ulItem.test(t) ||
        olItem.test(t) ||
        EMBED_RE.test(t) ||
        /^(-{3,}|\*{3,}|_{3,})$/.test(t)
      ) {
        break;
      }
      buf.push(t);
      i++;
    }
    blocks.push({ type: "paragraph", children: parseInline(buf.join(" ")) });
  }

  return blocks;
}

/* ---------------- inline parsing ---------------- */

/**
 * Single-pass scanner over inline syntax, earliest match wins:
 * `code` · ![img](src) · [text](href) · **strong** · *em* / _em_.
 * Strong/em/link contents are parsed recursively.
 */
export function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let rest = text;

  const patterns: { re: RegExp; make: (m: RegExpMatchArray) => InlineNode }[] = [
    { re: /`([^`]+)`/, make: (m) => ({ type: "code", text: m[1] }) },
    { re: /!\[([^\]]*)\]\(([^)\s]+)\)/, make: (m) => ({ type: "image", alt: m[1], src: m[2] }) },
    { re: /\[([^\]]+)\]\(([^)\s]+)\)/, make: (m) => ({ type: "link", href: m[2], children: parseInline(m[1]) }) },
    { re: /\*\*([^*]+)\*\*/, make: (m) => ({ type: "strong", children: parseInline(m[1]) }) },
    { re: /\*([^*]+)\*/, make: (m) => ({ type: "em", children: parseInline(m[1]) }) },
    { re: /_([^_]+)_/, make: (m) => ({ type: "em", children: parseInline(m[1]) }) },
  ];

  while (rest.length > 0) {
    let earliest: { index: number; match: RegExpMatchArray; make: (m: RegExpMatchArray) => InlineNode } | null = null;
    for (const p of patterns) {
      const m = rest.match(p.re);
      if (m && m.index != null && (earliest === null || m.index < earliest.index)) {
        earliest = { index: m.index, match: m, make: p.make };
      }
    }
    if (!earliest) {
      nodes.push({ type: "text", text: rest });
      break;
    }
    if (earliest.index > 0) {
      nodes.push({ type: "text", text: rest.slice(0, earliest.index) });
    }
    nodes.push(earliest.make(earliest.match));
    rest = rest.slice(earliest.index + earliest.match[0].length);
  }

  return nodes;
}
