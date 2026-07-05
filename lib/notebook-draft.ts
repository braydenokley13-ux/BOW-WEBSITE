/* ============================================================
 * lib/notebook-draft.ts — notebook → publication-ready markdown.
 *
 * Compiles a NotebookState into a draft the site's own editor
 * understands (lib/markdown.ts): headings, blockquotes, lists, and
 * the publication's live data-embed shortcodes, self-closing and on
 * their own line, e.g. `<ContractVerdict player="jaylen-brown" />`.
 * Pure function, no I/O — the notebook workbench pastes the output
 * straight into the editor's content field.
 *
 * Section structure (in order):
 *   # <working title>            — from the hypothesis, or a placeholder
 *   **The claim.** ...           — hypothesis + lens(es) evidence was gathered under
 *   ## The case                  — `supports` clips: prose + note quote + live embed
 *   ## The counter-case          — `challenges` clips, same treatment (always emitted,
 *                                   even empty — an argument with no counter-case is
 *                                   taught, not hidden)
 *   ## What's still open         — `open` clips + any `question`-kind clips, as a list
 *   ## Assumptions disclosure    — one shared block if every clip froze the same
 *                                   assumptions, else one line per clip
 *
 * A clip missing the refs an embed needs (no player slug, no team,
 * no two-sided trade) degrades gracefully: prose still emits, the
 * embed line is simply skipped.
 * ============================================================ */

import { fmtMillions, type Assumptions } from "@/lib/aasv";
import { assumptionsEqual } from "@/lib/lenses";
import type { Clip, NotebookState } from "@/lib/research-types";

const PLACEHOLDER_TITLE = "Untitled research note";

/** Collapse whitespace/newlines a reader may have pasted into the hypothesis field. */
function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function workingTitle(hypothesis: string): string {
  const h = clean(hypothesis);
  if (!h) return PLACEHOLDER_TITLE;
  // Title case is overkill for a working title — keep the reader's own words,
  // just capitalize the leading letter and trim a trailing question mark's twin.
  const capitalized = h.charAt(0).toUpperCase() + h.slice(1);
  return capitalized.length > 140 ? `${capitalized.slice(0, 139)}…` : capitalized;
}

function distinctLensNames(clips: Clip[]): string[] {
  return [...new Set(clips.map((c) => c.lensName))];
}

function claimParagraph(nb: NotebookState): string {
  const hyp = clean(nb.hypothesis);
  const lenses = distinctLensNames(nb.clips);
  const lensPhrase =
    lenses.length === 0
      ? "no evidence has been clipped into this notebook yet"
      : lenses.length === 1
        ? `gathered entirely under the ${lenses[0]} lens`
        : `gathered across ${lenses.length} worldviews — ${lenses.join(", ")}`;
  if (!hyp) {
    return `**The claim.** This notebook doesn't have a working claim yet — the evidence below was ${lensPhrase}.`;
  }
  return `**The claim.** ${hyp} The evidence below was ${lensPhrase}.`;
}

/** The right live embed for a clip's kind, or null when its refs can't support one. */
function embedForClip(clip: Clip): string | null {
  const playerSlug = clip.refs.find((r) => r.kind === "player" && r.slugs[0])?.slugs[0];
  switch (clip.kind) {
    case "verdict":
      return playerSlug ? `<ContractVerdict player="${playerSlug}" />` : null;
    case "valuation":
      return playerSlug ? `<PlayerCard player="${playerSlug}" />` : null;
    case "scenario":
      return playerSlug ? `<ScenarioBand player="${playerSlug}" />` : null;
    case "trade": {
      const tradeRef = clip.refs.find((r) => r.kind === "trade" && r.slugs.length >= 2);
      return tradeRef ? `<TradeAnalysis send="${tradeRef.slugs[0]}" receive="${tradeRef.slugs[1]}" />` : null;
    }
    case "team": {
      const teamRef = clip.refs.find((r) => r.kind === "team" && (r.team || r.slugs[0]));
      const team = teamRef?.team ?? teamRef?.slugs[0];
      return team ? `<TeamFlex team="${team.toUpperCase()}" />` : null;
    }
    case "question":
    case "note":
      return null;
  }
}

/** One clip rendered as prose scaffolding + optional note quote + optional embed. */
function renderClipBlock(clip: Clip): string {
  const lines: string[] = [];
  const title = clip.title || "Untitled clip";
  const detail = clip.detail ? clip.detail : "";
  lines.push(detail ? `**${title}.** ${detail}` : `**${title}.**`);
  if (clip.note.trim()) {
    lines.push("");
    lines.push(`> ${clean(clip.note)}`);
  }
  const embed = embedForClip(clip);
  if (embed) {
    lines.push("");
    lines.push(embed);
  }
  return lines.join("\n");
}

function renderClipSection(heading: string, clips: Clip[], emptyPrompt: string): string {
  const lines = [`## ${heading}`, ""];
  if (clips.length === 0) {
    lines.push(emptyPrompt);
    return lines.join("\n");
  }
  const blocks = clips.map(renderClipBlock);
  lines.push(blocks.join("\n\n"));
  return lines.join("\n");
}

function renderOpenSection(clips: Clip[]): string {
  const lines = ["## What's still open", ""];
  if (clips.length === 0) {
    lines.push("Nothing left open — every clip in this notebook has taken a side.");
    return lines.join("\n");
  }
  for (const clip of clips) {
    const title = clip.title || "Untitled clip";
    const detail = clip.detail ? ` — ${clip.detail}` : "";
    const note = clip.note.trim() ? ` (reader's note: ${clean(clip.note)})` : "";
    lines.push(`- **${title}**${detail}${note}`);
  }
  return lines.join("\n");
}

function fmtAssumptions(a: Assumptions): string {
  const { below, first, second } = a.apronMultipliers;
  return `${fmtMillions(a.dollarsPerWin)} per win, apron multipliers ${below.toFixed(2)}× / ${first.toFixed(2)}× / ${second.toFixed(2)}× (below / first / second), replacement level ${a.replacementLevel.toFixed(1)} per 100 possessions`;
}

function renderDisclosure(clips: Clip[]): string {
  const lines = ["## Assumptions disclosure", ""];
  if (clips.length === 0) {
    lines.push("No evidence has been captured yet, so there's nothing to disclose.");
    return lines.join("\n");
  }
  const shared = clips.every((c) => assumptionsEqual(c.assumptions, clips[0].assumptions));
  if (shared) {
    lines.push(
      `Every clip in this notebook was captured under one assumption set — **${clips[0].lensName}**: ${fmtAssumptions(clips[0].assumptions)}.`,
    );
    return lines.join("\n");
  }
  lines.push("This notebook mixes worldviews — the evidence below was captured under different assumptions:");
  lines.push("");
  for (const clip of clips) {
    lines.push(`- **${clip.title || "Untitled clip"}** — ${clip.lensName}: ${fmtAssumptions(clip.assumptions)}.`);
  }
  return lines.join("\n");
}

/** Compile a notebook into a publication-ready markdown draft. */
export function draftFromNotebook(nb: NotebookState): string {
  const supports = nb.clips.filter((c) => c.stance === "supports");
  const challenges = nb.clips.filter((c) => c.stance === "challenges");
  const open = nb.clips.filter((c) => c.stance === "open" || c.kind === "question");

  const parts = [
    `# ${workingTitle(nb.hypothesis)}`,
    "",
    claimParagraph(nb),
    "",
    renderClipSection(
      "The case",
      supports,
      "No supporting evidence has been clipped yet — the case is only as strong as what you've captured.",
    ),
    "",
    renderClipSection(
      "The counter-case",
      challenges,
      "No counter-evidence clipped yet — go find the strongest argument against this claim before you publish.",
    ),
    "",
    renderOpenSection(open),
    "",
    renderDisclosure(nb.clips),
  ];

  return parts.join("\n");
}
