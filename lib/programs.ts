import type { DataItem } from "@/components/ds";
import { lessons, type SimulationStatus } from "@/lib/lessons";

/* ===================================================================== */
/* Shared types                                                          */
/* ===================================================================== */

export interface ProgressionStage {
  num: string;
  label: string;
  dev: string;
  status: string;
  tone: string;
  cta: string;
  href: string;
}

export interface Concept {
  name: string;
  body: string;
}

export interface DeliveryFormat {
  n: string;
  title: string;
  body: string;
}

export interface ModuleLesson {
  n: string;
  title: string;
  overview: string;
  concept: string;
  runtime: string;
  podcast: string;
  sim: string;
  slug: string;
}

export interface TrackModule {
  n: string;
  title: string;
  theme: string;
  lessons: ModuleLesson[];
}

export interface Capstone {
  tag: string;
  title: string;
  body: string;
}

export interface BuildAreaItem {
  n: string;
  title: string;
  body: string;
}

export interface BuildStep {
  n: string;
  label: string;
  state: string;
  dot: string;
}

/* ===================================================================== */
/* Programs page                                                         */
/* ===================================================================== */

export const progression: ProgressionStage[] = [
  { num: "101", label: "Understand the Organization", dev: "How a sports business works — money, talent, and the cost of every choice.", status: "Available", tone: "var(--bow-blue)", cta: "Enter Track 101", href: "/programs/track-101" },
  { num: "201", label: "Operate the Organization", dev: "Run the front office: cap management, analytics, ownership, and the draft.", status: "Available", tone: "var(--bow-orange)", cta: "Enter Track 201", href: "/programs/track-201" },
  { num: "301", label: "Shape the Industry", dev: "Negotiation, valuation, media rights, and league-level strategy.", status: "In Development", tone: "var(--bow-warning)", cta: "Preview Track 301", href: "/programs/track-301" },
  { num: "HW", label: "Live in the Universe", dev: "Apply every decision across Highway World — a living sports-business overworld.", status: "In Development", tone: "var(--bow-positive)", cta: "See Highway World", href: "/highway-world" },
];

export const start101: string[] = [
  "You are new to sports economics",
  "You want guided decisions",
  "You are in middle school",
  "You want a clear introduction",
];

export const start201: string[] = [
  "You already understand basic economics",
  "You want more difficult tradeoffs",
  "You are an older or advanced student",
  "You have completed Track 101",
];

/* ===================================================================== */
/* Shared across track pages                                             */
/* ===================================================================== */

export const trackDelivery: DeliveryFormat[] = [
  { n: "01", title: "Schools", body: "Semester courses or enrichment blocks that fit a single class period." },
  { n: "02", title: "Camps", body: "High-energy 45–75 minute sessions and multi-day front-office challenges." },
  { n: "03", title: "After-School", body: "Weekly cohorts that build a full track across a term." },
  { n: "04", title: "Youth Organizations", body: "Adaptable group programming for almost any age band or format." },
  { n: "05", title: "Independent Cohorts", body: "Small groups running a complete track together, online or in person." },
  { n: "06", title: "Workshops", body: "One-off events built around a single front-office decision." },
];

/* ===================================================================== */
/* Track 101                                                             */
/* ===================================================================== */

const track101Lessons = lessons.filter((l) => l.track === "101");
const track101PlayableSims = track101Lessons.filter((l) => l.simulationStatus === "available").length;

export const track101Stats: DataItem[] = [
  { label: "Level", value: "Introductory" },
  { label: "Modules", value: "4" },
  { label: "Lessons", value: String(track101Lessons.length) },
  { label: "Playable Sims", value: String(track101PlayableSims) },
  { label: "Grades", value: "5–6" },
  { label: "Length", value: "~8 weeks" },
];

export const track101Outcomes: string[] = [
  "Read a cap sheet and explain what it allows",
  "Weigh short-term wins against long-term value",
  "Build a roster under a hard constraint",
  "Recognize incentives behind a deal",
  "Defend a decision with economic reasoning",
  "Connect a headline to the business underneath it",
];

export const track101Concepts: Concept[] = [
  { name: "Scarcity", body: "Why you can’t have everything, and how to choose." },
  { name: "Opportunity Cost", body: "Every yes is a no somewhere else on the roster." },
  { name: "Marginal Value", body: "What one more win — or player — is actually worth." },
  { name: "Incentives", body: "How the rules quietly shape every decision." },
  { name: "Constraints", body: "Reading the cap and building inside it." },
  { name: "Revenue Tradeoffs", body: "Balancing price, access, and the bottom line." },
  { name: "Risk", body: "Making the call without the full picture." },
  { name: "Long-Term Value", body: "Patience, valuation, and the long game." },
];

/**
 * Track module maps are derived from the canonical lesson dataset so the titles,
 * overviews, runtimes, and slugs always match the lesson detail pages they link to.
 */
const SIM_LABEL: Record<SimulationStatus, string> = {
  available: "Ready",
  pilot: "Beta",
  "coming-soon": "Soon",
  "in-development": "TBD",
};

function buildModules(track: string): TrackModule[] {
  const trackLessons = lessons.filter((l) => l.track === track);
  const moduleNumbers = Array.from(new Set(trackLessons.map((l) => l.moduleNumber))).sort((a, b) => a - b);
  return moduleNumbers.map((mod) => {
    const ls = trackLessons.filter((l) => l.moduleNumber === mod).sort((a, b) => a.lessonNumber - b.lessonNumber);
    const first = ls[0];
    return {
      n: `Module ${String(mod).padStart(2, "0")}`,
      title: first.moduleTitle,
      theme: first.moduleTheme,
      lessons: ls.map((l) => ({
        n: `L${l.lessonNumber}`,
        title: l.shortTitle || l.title,
        overview: l.overview || l.summary,
        concept: l.concepts[0] ?? "",
        runtime: l.duration,
        podcast: l.podcastEpisode ?? "—",
        sim: SIM_LABEL[l.simulationStatus],
        slug: l.slug,
      })),
    };
  });
}

export const track101Modules: TrackModule[] = buildModules("101");

/* ===================================================================== */
/* Track 201                                                             */
/* ===================================================================== */

const track201Lessons = lessons.filter((l) => l.track === "201");
const track201PlayableSims = track201Lessons.filter((l) => l.simulationStatus === "available").length;

export const track201Stats: DataItem[] = [
  { label: "Level", value: "Advanced" },
  { label: "Modules", value: "4" },
  { label: "Lessons", value: String(track201Lessons.length) },
  { label: "Playable Sims", value: String(track201PlayableSims) },
  { label: "Grades", value: "7–8" },
  { label: "Length", value: "~8 weeks" },
];

export const track201Concepts: Concept[] = [
  { name: "Cap Mechanics", body: "Exceptions, holds, and the levers that create or kill flexibility." },
  { name: "Marginal Cost", body: "Why the next dollar of payroll can cost far more than a dollar." },
  { name: "Surplus Value", body: "The gap between what a player produces and what he’s paid." },
  { name: "Expected Value", body: "Weighing outcomes by probability instead of hoping." },
  { name: "Revenue Sharing", body: "How leagues redistribute money — and why owners fight over it." },
  { name: "Draft Value Curve", body: "What each pick is worth, and where the bargains hide." },
  { name: "Negotiation", body: "Finding the number when both sides hold leverage." },
  { name: "Risk & Uncertainty", body: "Making the call when the information is incomplete." },
];

export const track201Outcomes: string[] = [
  "Manage a roster against the cap, luxury tax, and apron thresholds",
  "Calculate a player’s surplus value relative to his contract",
  "Use a model to support — not replace — a roster decision",
  "Value a draft pick and decide when to trade up or down",
  "Explain how league revenue and ownership incentives shape strategy",
  "Defend a multi-year plan under real uncertainty",
];

export const track201Modules: TrackModule[] = buildModules("201");

export const track201Capstone: Capstone = {
  tag: "Capstone Simulation",
  title: "Run the Front Office",
  body: "A full-season capstone: cap, draft, deadline, and the owner’s patience all on the table at once. Make the calls, then defend the plan.",
};

/* ===================================================================== */
/* Track 301                                                             */
/* ===================================================================== */

export const track301Areas: BuildAreaItem[] = [
  { n: "01", title: "Contract Negotiation", body: "Sit across the table when both sides have leverage and information is scarce." },
  { n: "02", title: "Franchise Valuation", body: "What a team is actually worth — and why owners disagree by billions." },
  { n: "03", title: "Collective Bargaining", body: "Players, owners, and the rules they fight to write." },
  { n: "04", title: "Stadium Economics", body: "Public money, private profit, and the deal behind the building." },
  { n: "05", title: "Media Rights", body: "The attention market that funds the entire industry." },
  { n: "06", title: "Sports Investing", body: "Risk, return, and the new money entering ownership." },
  { n: "07", title: "Ownership Strategy", body: "The long game played above the front office." },
  { n: "08", title: "League Governance", body: "Parity, power, and the economics of the whole system." },
];

export const track301Build: BuildStep[] = [
  { n: "01", label: "Curriculum Design", state: "In Progress", dot: "var(--bow-warning)" },
  { n: "02", label: "Simulation Engine", state: "In Progress", dot: "var(--bow-warning)" },
  { n: "03", label: "Pilot Cohorts", state: "Planned", dot: "#6d7078" },
  { n: "04", label: "Public Launch", state: "Planned", dot: "#6d7078" },
];
