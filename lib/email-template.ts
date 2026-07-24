import "server-only";

import { publicAppOrigin } from "@/lib/transactional-email";

/**
 * Branded HTML + plain-text rendering for every outbound transactional email.
 * Table-based and fully inlined because email clients strip <style> blocks,
 * external stylesheets, SVG, and webfonts.
 */

export interface EmailDetail {
  label: string;
  value: string;
}

export interface EmailContent {
  /** Inbox preview line. Never rendered in the visible body. */
  preheader: string;
  heading: string;
  paragraphs: string[];
  details?: EmailDetail[];
  cta?: { label: string; url: string };
  /** Small print under the divider, e.g. "if you weren't expecting this". */
  note?: string;
}

const INK = "#0a0a0b";
const PAPER = "#f3f0e8";
const BLUE = "#3157ff";
const SLATE = "#6a6d75";
const BORDER = "#d8d5ce";
const DARK_BORDER = "#2a2a2f";
const MUTED_ON_DARK = "#9a9da6";
const SANS = "Helvetica Neue, Helvetica, Arial, sans-serif";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Only absolute http(s) URLs are emitted as href values, so interpolated
 * content can never introduce a javascript: or data: destination.
 */
function safeUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function masthead(): string {
  return `<tr>
    <td style="background:${INK};padding:26px 32px;border-bottom:3px solid ${BLUE};">
      <div style="font-family:${SANS};font-size:30px;font-weight:bold;letter-spacing:-0.5px;color:#ffffff;line-height:1;">BOW</div>
      <div style="font-family:${SANS};font-size:10px;font-weight:bold;letter-spacing:3.4px;color:${MUTED_ON_DARK};line-height:1;padding-top:7px;">SPORTS CAPITAL</div>
    </td>
  </tr>`;
}

function footer(): string {
  const origin = publicAppOrigin();
  const links = origin
    ? `<div style="font-family:${SANS};font-size:12px;color:${SLATE};line-height:1.9;padding-top:14px;">
        <a href="${escapeHtml(origin)}/programs" style="color:${SLATE};text-decoration:underline;">Programs</a>
        &nbsp;&nbsp;·&nbsp;&nbsp;
        <a href="${escapeHtml(origin)}/teach" style="color:${SLATE};text-decoration:underline;">Teach</a>
        &nbsp;&nbsp;·&nbsp;&nbsp;
        <a href="${escapeHtml(origin)}/contact" style="color:${SLATE};text-decoration:underline;">Contact</a>
      </div>`
    : "";

  return `<tr>
    <td style="background:${PAPER};padding:26px 32px;border-top:1px solid ${BORDER};">
      <div style="font-family:${SANS};font-size:10px;font-weight:bold;letter-spacing:2.6px;color:${BLUE};line-height:1;">LEARN &nbsp;·&nbsp; ANALYZE &nbsp;·&nbsp; APPLY</div>
      ${links}
      <div style="font-family:${SANS};font-size:11px;color:${SLATE};line-height:1.7;padding-top:14px;">
        BOW Sports Capital &nbsp;·&nbsp; Est. 2025<br />
        This is an automated message about your BOW Sports Capital account. Please do not reply to this address.
      </div>
    </td>
  </tr>`;
}

function ctaBlock(cta: { label: string; url: string }): string {
  const url = safeUrl(cta.url);
  if (!url) return "";
  const href = escapeHtml(url);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 6px 0;">
      <tr>
        <td style="background:${BLUE};">
          <a href="${href}" style="display:inline-block;padding:14px 30px;font-family:${SANS};font-size:13px;font-weight:bold;letter-spacing:1.4px;text-transform:uppercase;color:#ffffff;text-decoration:none;">${escapeHtml(cta.label)}</a>
        </td>
      </tr>
    </table>
    <div style="font-family:${SANS};font-size:12px;color:${SLATE};line-height:1.7;padding-bottom:6px;">
      If the button does not work, paste this link into your browser:<br />
      <a href="${href}" style="color:${BLUE};text-decoration:underline;word-break:break-all;">${href}</a>
    </div>`;
}

function detailsBlock(details: EmailDetail[]): string {
  const rows = details
    .map((d, i) => {
      // The final row is left open so it never stacks against a following rule.
      const rule = i === details.length - 1 ? "none" : `1px solid ${BORDER}`;
      return `<tr>
        <td style="padding:9px 0;border-bottom:${rule};font-family:${SANS};font-size:11px;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase;color:${SLATE};white-space:nowrap;vertical-align:top;">${escapeHtml(d.label)}</td>
        <td style="padding:9px 0 9px 20px;border-bottom:${rule};font-family:${SANS};font-size:15px;color:${INK};">${escapeHtml(d.value)}</td>
      </tr>`;
    })
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:22px 0 4px 0;border-collapse:collapse;">${rows}</table>`;
}

export function renderTransactionalEmail(content: EmailContent): { text: string; html: string } {
  const paragraphs = content.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px 0;font-family:${SANS};font-size:15px;line-height:1.65;color:${INK};">${escapeHtml(p).replace(/\n/g, "<br />")}</p>`,
    )
    .join("");

  const note = content.note
    ? `<div style="margin-top:26px;padding-top:20px;border-top:1px solid ${BORDER};font-family:${SANS};font-size:12px;line-height:1.7;color:${SLATE};">${escapeHtml(content.note)}</div>`
    : "";

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light only" />
<title>${escapeHtml(content.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(content.preheader)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${PAPER};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#ffffff;border:1px solid ${DARK_BORDER};">
        ${masthead()}
        <tr>
          <td style="padding:34px 32px 30px 32px;">
            <h1 style="margin:0 0 20px 0;font-family:${SANS};font-size:24px;font-weight:bold;line-height:1.25;letter-spacing:-0.3px;color:${INK};">${escapeHtml(content.heading)}</h1>
            ${paragraphs}
            ${content.details?.length ? detailsBlock(content.details) : ""}
            ${content.cta ? ctaBlock(content.cta) : ""}
            ${note}
          </td>
        </tr>
        ${footer()}
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  // Blocks are joined with a blank line so the text part stays readable on
  // its own; line breaks inside a block are meaningful and preserved.
  const origin = publicAppOrigin();
  const blocks: string[] = [content.heading, ...content.paragraphs];
  if (content.details?.length) {
    blocks.push(content.details.map((d) => `${d.label}: ${d.value}`).join("\n"));
  }
  const ctaUrl = content.cta ? safeUrl(content.cta.url) : null;
  if (content.cta && ctaUrl) blocks.push(`${content.cta.label}:\n${ctaUrl}`);
  if (content.note) blocks.push(content.note);
  blocks.push(
    [
      "—",
      "BOW Sports Capital · Learn · Analyze · Apply",
      origin,
      "This is an automated message. Please do not reply to this address.",
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return { text: blocks.join("\n\n"), html };
}

/**
 * Wrapper for messages whose body is authored by staff and stored as plain
 * text. Blank lines separate paragraphs; the first line is not special-cased.
 */
export function renderPlainBodyEmail(heading: string, body: string): { text: string; html: string } {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return renderTransactionalEmail({
    preheader: paragraphs[0]?.slice(0, 140) ?? heading,
    heading,
    paragraphs: paragraphs.length ? paragraphs : [body.trim()],
  });
}
