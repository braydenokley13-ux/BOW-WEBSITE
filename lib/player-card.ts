/* ============================================================
 * Player Card (Feature 4) — the shareable gamification artifact.
 *
 * After completing modules, a student earns a collectible "Player
 * Card" that looks like a basketball trading card but represents their
 * own BOW stats. The card is rendered on /card from live data and can
 * be downloaded as a self-contained HTML file (same pattern as the
 * certificate). Generation is recorded idempotently in `player_cards`.
 *
 * Server-only for the data/record functions. The HTML builder is a
 * pure string function (client-safe), so a server component can prebuild it.
 * ============================================================ */

import { getDb } from "@/lib/db";
import { getStudentScore, computeStats, type BowRank } from "@/lib/scoring";
import { getQuizModuleSections, getSelfModuleViews } from "@/lib/self-paced";
import { getStreak } from "@/lib/streak";
import { escapeHtml } from "@/lib/certificate";
import { TRACK_101, TRACK_201 } from "@/lib/account";

export interface PlayerCardData {
  studentId: string;
  name: string;
  rankName: string;
  rankKey: BowRank["key"];
  bowScore: number;
  modulesCompleted: number;
  totalModules: number;
  quizScorePct: number | null;
  currentStreak: number;
  positionLabel: string;
}

/** Inputs the position label is derived from. */
interface PositionInputs {
  quizScorePct: number | null;
  simulationCompleted: boolean;
  discussionPosts: number;
  weeklyCompletions: number;
}

/**
 * The card's "position" label, based on the student's strongest area.
 * Precedence follows the order the spec lists the rules in.
 */
export function getPositionLabel(p: PositionInputs): string {
  if (p.quizScorePct !== null && p.quizScorePct > 80) return "Analyst";
  if (p.simulationCompleted) return "GM";
  if (p.discussionPosts > 3) return "Scout";
  if (p.weeklyCompletions > 2) return "Executive";
  return "Rookie";
}

/** One-line flavor text for each position label. */
export function positionTagline(label: string): string {
  switch (label) {
    case "Analyst": return "Reads the numbers behind every call.";
    case "GM": return "Runs the room. Makes the decision.";
    case "Scout": return "Spots the value everyone else misses.";
    case "Executive": return "Sets the strategy, week after week.";
    default: return "Every front office starts here.";
  }
}

/** Quiz MC percentage across the student's unlocked modules (both tracks). */
function quizPct(studentId: string): number | null {
  let correct = 0;
  let answered = 0;
  for (const track of [TRACK_101, TRACK_201]) {
    for (const s of getQuizModuleSections(studentId, track)) {
      if (!s.unlocked) continue;
      correct += s.mcCorrect;
      answered += s.mcAnswered;
    }
  }
  return answered > 0 ? Math.round((correct / answered) * 100) : null;
}

/** Assemble the live data for a student's Player Card. */
export function getPlayerCardData(studentId: string): PlayerCardData | null {
  const score = getStudentScore(studentId, 0);
  if (!score) return null;
  const stats = computeStats(studentId, 0);
  const pct = quizPct(studentId);
  const streak = getStreak(studentId);
  const totalModules =
    getSelfModuleViews(studentId, TRACK_101).length + getSelfModuleViews(studentId, TRACK_201).length;

  const positionLabel = getPositionLabel({
    quizScorePct: pct,
    simulationCompleted: stats.simulationCompleted,
    discussionPosts: stats.discussionPosts,
    weeklyCompletions: stats.weeklyCompletions,
  });

  return {
    studentId: score.studentId,
    name: score.name,
    rankName: score.rank.name,
    rankKey: score.rank.key,
    bowScore: score.bowScore,
    modulesCompleted: stats.modulesCompleted,
    totalModules,
    quizScorePct: pct,
    currentStreak: streak.current,
    positionLabel,
  };
}

/**
 * Record (idempotently) that a student generated their card. One row per
 * student, updated with the latest position label on each generation.
 */
export function recordPlayerCard(studentId: string, positionLabel: string): void {
  getDb()
    .prepare(
      "INSERT INTO player_cards (id, student_id, generated_at, position_label) VALUES (?, ?, ?, ?) ON CONFLICT(student_id) DO UPDATE SET generated_at = excluded.generated_at, position_label = excluded.position_label",
    )
    .run(`pc-${studentId}`, studentId, Date.now(), positionLabel);
}

/** A filesystem-safe download filename for the card. */
export function playerCardFilename(name: string): string {
  const slug = name.trim().replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "Student";
  return `BOW-Player-Card-${slug}.html`;
}

/**
 * A self-contained basketball-trading-card-style HTML file — dark navy with gold
 * accents, the student's name large, rank badge, position, and their BOW stats.
 * Pure string builder (no DB), so it can be prebuilt on the server and downloaded.
 */
export function buildPlayerCardHtml(d: PlayerCardData): string {
  const name = escapeHtml(d.name || "Student");
  const rank = escapeHtml(d.rankName);
  const position = escapeHtml(d.positionLabel);
  const tagline = escapeHtml(positionTagline(d.positionLabel));
  const quiz = d.quizScorePct === null ? "—" : `${d.quizScorePct}%`;
  const streak = d.currentStreak > 0 ? `${d.currentStreak}` : "0";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>BOW Player Card · ${name}</title>
  <meta name="description" content="${name}'s BOW Sports Capital player card — ${position}, ${rank}." />
  <meta name="robots" content="noindex" />
  <meta property="og:title" content="${name} — BOW Player Card" />
  <meta property="og:description" content="${position} · ${rank} · BOW Score ${d.bowScore}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wght@600;700;800;900&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap" rel="stylesheet" />
  <style>
    :root { --navy:#0A1628; --navy2:#13243d; --gold:#C9A84C; --lime:#C8FF3D; --display:'Anton','Arial Narrow',sans-serif; --mono:'IBM Plex Mono',monospace; --ui:'Inter',system-ui,sans-serif; --archivo:'Archivo','Inter',sans-serif; }
    * { box-sizing:border-box; }
    html,body { margin:0; }
    body { background:#070f1c; min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:32px 16px 56px; font-family:var(--ui); }
    .toolbar { margin-bottom:22px; }
    .btn { font-family:var(--archivo); font-weight:800; font-size:12px; letter-spacing:1.4px; text-transform:uppercase; padding:13px 26px; border-radius:7px; cursor:pointer; border:1px solid var(--gold); background:var(--gold); color:var(--navy); }
    .card { width:380px; max-width:100%; background:linear-gradient(160deg,var(--navy2),var(--navy)); border:2px solid var(--gold); border-radius:18px; overflow:hidden; box-shadow:0 24px 60px rgba(0,0,0,0.6); position:relative; }
    .card::before { content:""; position:absolute; inset:8px; border:1px solid rgba(201,168,76,0.4); border-radius:12px; pointer-events:none; }
    .top { display:flex; align-items:center; justify-content:space-between; padding:18px 22px 0; }
    .pill { font-family:var(--mono); font-size:10px; font-weight:600; letter-spacing:1.6px; text-transform:uppercase; color:var(--navy); background:var(--gold); padding:4px 10px; border-radius:100px; }
    .rank { font-family:var(--mono); font-size:10px; letter-spacing:1.6px; text-transform:uppercase; color:var(--lime); }
    .pos { padding:30px 22px 6px; text-align:center; }
    .pos .label { font-family:var(--display); font-size:64px; line-height:0.9; letter-spacing:1px; color:var(--gold); text-transform:uppercase; }
    .pos .tag { font-family:var(--ui); font-size:12.5px; color:rgba(255,255,255,0.66); margin-top:8px; }
    .name { text-align:center; padding:14px 22px 18px; }
    .name h1 { margin:0; font-family:var(--archivo); font-weight:900; font-size:26px; letter-spacing:-0.01em; color:#fff; text-transform:uppercase; line-height:1.05; }
    .name .sub { font-family:var(--mono); font-size:10.5px; letter-spacing:1.4px; text-transform:uppercase; color:#9aa3b2; margin-top:6px; }
    .stats { display:grid; grid-template-columns:1fr 1fr; gap:1px; background:rgba(201,168,76,0.25); margin:0 18px 18px; border:1px solid rgba(201,168,76,0.25); border-radius:10px; overflow:hidden; }
    .stat { background:var(--navy); padding:14px 16px; }
    .stat .v { font-family:var(--archivo); font-weight:900; font-size:24px; color:#fff; line-height:1; }
    .stat .v .gold { color:var(--gold); }
    .stat .k { font-family:var(--mono); font-size:9px; letter-spacing:1.2px; text-transform:uppercase; color:#9aa3b2; margin-top:6px; }
    .foot { display:flex; align-items:center; justify-content:space-between; padding:0 22px 18px; }
    .foot .wm { font-family:var(--display); font-size:18px; letter-spacing:1px; color:var(--gold); text-transform:uppercase; }
    .foot .yr { font-family:var(--mono); font-size:9.5px; letter-spacing:1.4px; color:#9aa3b2; text-transform:uppercase; }
    @media print { @page { margin:0; } body { background:#fff; padding:0; } .toolbar { display:none; } .card { box-shadow:none; } }
  </style>
</head>
<body>
  <div class="toolbar"><button class="btn" onclick="window.print()">Print / Save PDF</button></div>
  <div class="card">
    <div class="top"><span class="pill">BOW Sports Capital</span><span class="rank">${rank}</span></div>
    <div class="pos"><div class="label">${position}</div><div class="tag">${tagline}</div></div>
    <div class="name"><h1>${name}</h1><div class="sub">Official Player Card</div></div>
    <div class="stats">
      <div class="stat"><div class="v"><span class="gold">${d.bowScore}</span></div><div class="k">BOW Score</div></div>
      <div class="stat"><div class="v">${d.modulesCompleted}/${d.totalModules}</div><div class="k">Modules</div></div>
      <div class="stat"><div class="v">${quiz}</div><div class="k">Quiz Score</div></div>
      <div class="stat"><div class="v">🔥 ${streak}</div><div class="k">Day Streak</div></div>
    </div>
    <div class="foot"><span class="wm">BOW</span><span class="yr">bowsportscapital.com</span></div>
  </div>
</body>
</html>`;
}
