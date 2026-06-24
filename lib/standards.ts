/* ============================================================
 * Curriculum Standards Alignment (Feature 7) — public.
 *
 * Maps every BOW module to specific AP Economics standards, for
 * school administrators and league contacts who must justify BOW to a
 * curriculum committee. Seed bank (pure data) + read layer + a
 * self-contained downloadable HTML builder (same pattern as the
 * certificate generator).
 *
 * Stored columns key_concepts / ap_micro_standards / ap_macro_standards
 * are JSON arrays of strings.
 * ============================================================ */

import { getDb } from "@/lib/db";
import { escapeHtml } from "@/lib/certificate";

export interface StandardsEntry {
  id: string;
  ordinal: number;
  moduleName: string;
  track: string;
  keyConcepts: string[];
  apMicroStandards: string[];
  apMacroStandards: string[];
}

/** The standards-alignment seed — all 8 modules across both tracks. */
export const STANDARDS_ALIGNMENT: StandardsEntry[] = [
  {
    id: "sa-101-1", ordinal: 1, track: "101", moduleName: "What Is Economics? (Track 101, Module 1)",
    keyConcepts: ["Scarcity", "Opportunity Cost", "Incentives", "Cost-Benefit Analysis", "Comparative Advantage"],
    apMicroStandards: [
      "Unit 1 — Scarcity, opportunity cost, and the production possibilities curve",
      "Unit 1 — Comparative advantage and gains from trade",
      "Unit 1 — Marginal (cost-benefit) analysis and rational decision-making",
    ],
    apMacroStandards: ["Unit 1 — Scarcity and opportunity cost as the shared foundation of macroeconomics"],
  },
  {
    id: "sa-101-2", ordinal: 2, track: "101", moduleName: "How Markets Work (Track 101, Module 2)",
    keyConcepts: ["Law of Demand", "Law of Supply", "Market Equilibrium", "Price Elasticity", "Consumer & Producer Surplus", "Monopoly", "Oligopoly"],
    apMicroStandards: [
      "Unit 2 — Supply and demand; equilibrium price and quantity",
      "Unit 2 — Price elasticity of demand and supply",
      "Unit 2 — Consumer surplus, producer surplus, and market efficiency",
      "Unit 4 — Imperfect competition: monopoly and oligopoly",
    ],
    apMacroStandards: [],
  },
  {
    id: "sa-101-3", ordinal: 3, track: "101", moduleName: "The Big Picture Economy (Track 101, Module 3)",
    keyConcepts: ["GDP", "Inflation", "Unemployment", "Fiscal Policy", "Monetary Policy", "Economic Growth", "Business Cycle", "Multiplier Effect"],
    apMicroStandards: [],
    apMacroStandards: [
      "Unit 2 — Economic indicators: GDP, unemployment types, and inflation (CPI)",
      "Unit 3 — Aggregate demand, aggregate supply, and the spending multiplier",
      "Unit 4 — Fiscal policy: government spending and taxation",
      "Unit 4 — Monetary policy and the role of the central bank",
      "Unit 6 — Economic growth and the business cycle",
    ],
  },
  {
    id: "sa-101-4", ordinal: 4, track: "101", moduleName: "Applied Economics (Track 101, Module 4)",
    keyConcepts: ["Market Failure", "Externalities", "Public Goods", "Cost-Benefit Analysis", "Real-World Trade-offs"],
    apMicroStandards: [
      "Unit 6 — Market failure: positive and negative externalities",
      "Unit 6 — Public goods and the free-rider problem",
      "Unit 6 — The role of government in correcting market failure",
    ],
    apMacroStandards: ["Unit 6 — International trade and public-policy trade-offs"],
  },
  {
    id: "sa-201-1", ordinal: 5, track: "201", moduleName: "The Salary Cap Machine (Track 201, Module 1)",
    keyConcepts: ["Salary Cap", "Bird Rights", "Mid-Level Exception", "Luxury Tax", "Hard & Soft Caps", "Incentives", "Budget Constraints"],
    apMicroStandards: [
      "Unit 1 — Constrained optimization and budget constraints",
      "Unit 1 — Incentives and rational decision-making",
      "Unit 5 — Factor markets: how wages and salaries are determined",
    ],
    apMacroStandards: [],
  },
  {
    id: "sa-201-2", ordinal: 6, track: "201", moduleName: "Revenue, Rights, and Power (Track 201, Module 2)",
    keyConcepts: ["Revenue Sharing", "Market Size", "Media Rights", "Gate Revenue", "Antitrust & Market Power", "Income Distribution"],
    apMicroStandards: [
      "Unit 4 — Market power and pricing in monopoly/oligopoly",
      "Unit 5 — Income distribution and redistribution",
      "Unit 2 — Pricing of ticket and broadcast markets",
    ],
    apMacroStandards: ["Unit 2 — Revenue and the circular flow of income"],
  },
  {
    id: "sa-201-3", ordinal: 7, track: "201", moduleName: "The Analytics Edge (Track 201, Module 3)",
    keyConcepts: ["Analytics", "Wins Above Replacement", "Market Inefficiency", "Marginal Analysis", "Information & Pricing"],
    apMicroStandards: [
      "Unit 2 — Market efficiency and inefficiency",
      "Unit 1 — Marginal analysis applied to player valuation",
      "Unit 4 — Information and pricing in competitive vs. imperfect markets",
    ],
    apMacroStandards: [],
  },
  {
    id: "sa-201-4", ordinal: 8, track: "201", moduleName: "Draft Economics and Roster Windows (Track 201, Module 4)",
    keyConcepts: ["Surplus Value", "Pick Value", "Roster Windows", "Comparative Advantage", "Time Value of Decisions"],
    apMicroStandards: [
      "Unit 5 — Factor markets: valuing labor and surplus value",
      "Unit 1 — Comparative advantage and resource allocation",
      "Unit 2 — Consumer/producer surplus applied to contracts",
    ],
    apMacroStandards: ["Unit 6 — Long-run planning and the time value of investment decisions"],
  },
];

/* eslint-disable @typescript-eslint/no-explicit-any */

function parseJsonArray(v: unknown): string[] {
  if (Array.isArray(v)) return v as string[];
  if (typeof v !== "string" || v.trim() === "") return [];
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** All standards-alignment rows, ordered (DB first, falling back to seed). */
export function getStandardsAlignment(): StandardsEntry[] {
  const rows = getDb().prepare("SELECT * FROM standards_alignment ORDER BY ordinal ASC").all() as any[];
  if (rows.length === 0) return [...STANDARDS_ALIGNMENT].sort((a, b) => a.ordinal - b.ordinal);
  return rows.map((r) => ({
    id: r.id,
    ordinal: Number(r.ordinal) || 0,
    moduleName: r.module_name,
    track: r.track,
    keyConcepts: parseJsonArray(r.key_concepts),
    apMicroStandards: parseJsonArray(r.ap_micro_standards),
    apMacroStandards: parseJsonArray(r.ap_macro_standards),
  }));
}

/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * A self-contained, navy/gold standards-alignment document (same look as the
 * certificate) that a curriculum director can download and email. Pure string
 * builder — no DB, client-safe — so a server component can prebuild it.
 */
export function buildStandardsHtml(entries: StandardsEntry[]): string {
  const list = (items: string[]) =>
    items.length === 0
      ? '<span class="none">—</span>'
      : `<ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`;

  const rows = entries
    .map(
      (e) => `<tr>
        <td class="mod"><span class="track">Track ${escapeHtml(e.track)}</span><br/>${escapeHtml(e.moduleName)}</td>
        <td>${list(e.keyConcepts)}</td>
        <td>${list(e.apMicroStandards)}</td>
        <td>${list(e.apMacroStandards)}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>BOW Sports Capital — AP Economics Standards Alignment</title>
  <meta name="description" content="How every BOW Sports Capital module maps to AP Microeconomics and AP Macroeconomics standards." />
  <meta name="robots" content="noindex" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;500;600;700&family=Archivo:wght@700;800;900&display=swap" rel="stylesheet" />
  <style>
    :root { --navy:#0A1628; --gold:#C9A84C; --ink:#0a0a0b; --ui:'Inter',system-ui,sans-serif; --serif:'Playfair Display',Georgia,serif; --mono:'Archivo','Inter',sans-serif; }
    * { box-sizing:border-box; }
    body { margin:0; background:#f3f0e8; color:var(--ink); font-family:var(--ui); padding:32px 16px 64px; }
    .toolbar { max-width:1040px; margin:0 auto 18px; display:flex; gap:12px; }
    .btn { font-family:var(--mono); font-weight:800; font-size:12px; letter-spacing:1.2px; text-transform:uppercase; padding:12px 24px; border-radius:6px; cursor:pointer; border:1px solid var(--navy); background:var(--navy); color:#fff; }
    .sheet { max-width:1040px; margin:0 auto; background:#fff; border:1px solid #d8d5ce; box-shadow:0 18px 50px rgba(0,0,0,0.12); }
    .head { background:var(--navy); color:#fff; padding:36px 40px; border-bottom:4px solid var(--gold); }
    .head .pill { font-family:var(--mono); font-size:10.5px; font-weight:800; letter-spacing:2.4px; text-transform:uppercase; color:var(--gold); }
    .head h1 { font-family:var(--serif); font-weight:700; font-size:34px; margin:10px 0 6px; }
    .head p { margin:0; color:rgba(255,255,255,0.78); font-size:14px; max-width:760px; line-height:1.6; }
    table { width:100%; border-collapse:collapse; }
    th { text-align:left; font-family:var(--mono); font-size:11px; letter-spacing:1.4px; text-transform:uppercase; color:var(--navy); padding:14px 16px; border-bottom:2px solid var(--navy); background:#f3f0e8; vertical-align:bottom; }
    td { padding:16px; border-bottom:1px solid #e4e1d8; vertical-align:top; font-size:13.5px; line-height:1.5; }
    td.mod { font-weight:600; width:24%; }
    td .track { font-family:var(--mono); font-size:10px; letter-spacing:1.2px; text-transform:uppercase; color:var(--gold); background:var(--navy); padding:2px 7px; border-radius:3px; }
    ul { margin:0; padding-left:18px; } li { margin-bottom:6px; }
    .none { color:#8b8d93; }
    .foot { padding:24px 40px 32px; }
    .foot p { font-size:13.5px; line-height:1.7; color:#3a3a42; margin:0; }
    .foot .sig { margin-top:18px; font-family:var(--mono); font-size:11px; letter-spacing:1.2px; text-transform:uppercase; color:#6d7078; }
    @media print { .toolbar { display:none; } body { background:#fff; padding:0; } .sheet { box-shadow:none; border:none; } }
  </style>
</head>
<body>
  <div class="toolbar"><button class="btn" onclick="window.print()">Print / Save PDF</button></div>
  <div class="sheet">
    <div class="head">
      <div class="pill">Curriculum Standards Alignment</div>
      <h1>BOW Sports Capital × AP Economics</h1>
      <p>Every BOW module maps to specific AP Microeconomics and AP Macroeconomics standards. This document is for curriculum committees and partnership teams evaluating BOW as a standards-aligned economics program.</p>
    </div>
    <table>
      <thead>
        <tr><th>BOW Module</th><th>Key Concepts Taught</th><th>AP Micro Standards</th><th>AP Macro Standards</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="foot">
      <p>BOW Sports Capital is not a sports trivia program. It is an economics education platform that uses sports as the delivery mechanism for concepts that appear on the AP Economics exam. Students who complete both tracks will have been exposed to the majority of AP Micro and AP Macro content — through real decisions, not memorization.</p>
      <div class="sig">BOW Sports Capital · The front office for the next generation · bowsportscapital.com</div>
    </div>
  </div>
</body>
</html>`;
}
