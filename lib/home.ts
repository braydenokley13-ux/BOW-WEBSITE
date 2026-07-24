import type { DataItem, DecisionOption, Consequence } from "@/components/ds";
import { partnerVerifiedFacts } from "@/lib/get-involved";

/* ============================================================
 * Home page content — ported from the design prototype.
 * ============================================================ */

export const heroDecisionFacts: DataItem[] = [
  { label: "Cap Space", value: "-$8.4M", tone: "negative" },
  { label: "Team Value", value: "$3.1B" },
  { label: "Title Odds", value: "14%" },
  { label: "Luxury Tax", value: "$31M", tone: "warning" },
];

export const heroDecisionUnknowns: string[] = ["INJURY RISK: MEDIUM", "MARKET: COOLING", "OWNER PATIENCE: 1 SEASON"];

export const heroDecisionOptions: DecisionOption[] = [
  { id: "extend", label: "Extend him now", detail: "$42M / 3 YRS · pushes you $8.4M over the second apron" },
  { id: "trade", label: "Trade at peak value", detail: "Returns two firsts + a young wing on a rookie deal" },
  { id: "hold", label: "Run it back, decide at the deadline", detail: "Preserve flexibility, risk a cooling market" },
];

export const heroDecisionConsequence: Consequence = {
  byChoice: {
    extend: {
      status: "warning",
      headline: "You kept the window open — and mortgaged 2027.",
      body: "The extension triggers second-apron penalties: frozen picks, no aggregation, a hard cap. You can win now, but every future move gets harder. That is the cost of certainty.",
    },
    trade: {
      status: "positive",
      headline: "You sold high and reset the timeline.",
      body: "Two firsts and a cost-controlled wing restore your flexibility. The fan base is furious for a month. Eighteen months later, the rebuild looks like foresight.",
    },
    hold: {
      status: "negative",
      headline: "You waited — and the market decided for you.",
      body: "A rival overpays at the deadline and your leverage evaporates. Indecision is a decision; it just hands the pen to someone else.",
    },
  },
};

export const concepts: string[] = [
  "Opportunity Cost",
  "Incentives",
  "Salary-Cap Constraints",
  "Marginal Value",
  "Risk & Uncertainty",
  "Market Power",
  "Revenue Tradeoffs",
  "Negotiation",
  "Long-Term Value",
  "Leadership",
];

export interface Step {
  n: string;
  label: string;
  body: string;
}

export const modelSteps: Step[] = [
  { n: "01", label: "Learn the Concept", body: "The economic idea, the context, and the problem on the table." },
  { n: "02", label: "Hear the Story", body: "A podcast episode brings the issue into the real sports world." },
  { n: "03", label: "Make the Decision", body: "You take the role and make the call inside the simulation." },
  { n: "04", label: "See the Consequence", body: "You live with the result and defend your reasoning." },
];

export const lessonFlow: Step[] = [
  { n: "01", label: "The Front-Office Brief", body: "You receive the economic concept, the context, and the problem to solve." },
  { n: "02", label: "The Podcast Connection", body: "A related BOW Sports Capital Podcast episode grounds it in the real sports world." },
  { n: "03", label: "The Simulation", body: "You make the decision through a standalone interactive experience." },
  { n: "04", label: "The Debrief", body: "You examine the consequence, defend your call, and tie it back to the economics." },
];

export interface Track {
  num: string;
  kind: string;
  kindColor: string;
  recommended: boolean;
  title: string;
  desc: string;
  meta: string[];
  cta: string;
  btnVariant: "primary" | "secondary" | "ink";
  bg: string;
  fg: string;
  muted: string;
  line: string;
  topPad: string;
  href: string;
}

export const tracks: Track[] = [
  {
    num: "101",
    kind: "Introductory",
    kindColor: "var(--bow-blue)",
    recommended: true,
    title: "Build the foundation.",
    desc: "Learn the essential ideas behind sports economics, team building, finance, and front-office decision-making.",
    meta: ["4 modules", "12 lessons", "12 connected simulations", "Podcast connections"],
    cta: "Explore Track 101",
    btnVariant: "primary",
    bg: "#fff",
    fg: "var(--bow-ink)",
    muted: "var(--bow-slate)",
    line: "var(--bow-blue)",
    topPad: "14px",
    href: "/programs/track-101",
  },
  {
    num: "201",
    kind: "Advanced",
    kindColor: "var(--bow-orange)",
    recommended: false,
    title: "Take control of harder decisions.",
    desc: "Apply deeper economic thinking to more complex front-office situations, competing priorities, and strategic tradeoffs.",
    meta: ["4 modules", "12 lessons", "12 connected simulations", "Podcast connections"],
    cta: "Explore Track 201",
    btnVariant: "secondary",
    bg: "var(--bow-paper)",
    fg: "var(--bow-ink)",
    muted: "var(--bow-slate)",
    line: "var(--bow-orange)",
    topPad: "0px",
    href: "/programs/track-201",
  },
  // Track 301 is not yet a real, purchasable track — it's intentionally left out of this
  // comparison grid so visitors only compare tracks that actually exist. It's still
  // reachable at /programs/track-301, linked only from the footer ("Track 301 — Coming").
];

export interface FeaturedLesson {
  bigNum: string;
  category: string;
  hook: string;
  trackmod: string;
  title: string;
  decision: string;
  concept: string;
  runtime: string;
  podcast: string;
  href: string;
}

export const featuredLessons: FeaturedLesson[] = [
  { bigNum: "01", category: "Sports Economics", hook: "Every yes is a no.", trackmod: "TRACK 101 · MODULE 1", title: "Opportunity cost, explained in trades.", decision: "Trade or hold", concept: "Opportunity cost", runtime: "14 min", podcast: "EP 04", href: "/lessons/opportunity-cost-in-trades" },
  { bigNum: "02", category: "Roster Construction", hook: "Build under the cap.", trackmod: "TRACK 101 · MODULE 2", title: "You have one roster spot and three good options.", decision: "Who makes the team", concept: "Marginal value", runtime: "14 min", podcast: "EP 06", href: "/lessons/one-spot-three-options" },
  { bigNum: "03", category: "Salary Cap", hook: "Spend now or protect the future.", trackmod: "TRACK 101 · MODULE 3", title: "The extension that wins games — and costs you 2027.", decision: "Extend or trade", concept: "Opportunity cost", runtime: "16 min", podcast: "EP 07", href: "/lessons/the-apron-era" },
  { bigNum: "04", category: "Revenue & Ownership", hook: "Price the building.", trackmod: "TRACK 101 · MODULE 4", title: "Raise ticket prices, or protect the fan base?", decision: "Flat or dynamic pricing", concept: "Price elasticity", runtime: "16 min", podcast: "EP 05", href: "/lessons/the-price-of-a-seat" },
  { bigNum: "05", category: "Revenue Sharing", hook: "Help your rivals? Vote now.", trackmod: "TRACK 201 · MODULE 2", title: "A deal that helps the league can hurt you. Sign it?", decision: "Vote yes or no", concept: "Revenue sharing", runtime: "15 min", podcast: "EP 08", href: "/lessons/the-league-as-a-business" },
  { bigNum: "06", category: "Franchise Management", hook: "The team is fading. Fix it your way.", trackmod: "TRACK 201 · MODULE 2", title: "The franchise is sliding. Chase relevance now, or rebuild the foundation?", decision: "Win now or rebuild", concept: "Long-term strategy", runtime: "18 min", podcast: "EP 05", href: "/lessons/save-the-franchise" },
];

export interface LessonStep {
  n: string;
  label: string;
  tag: string;
  body: string;
  bg: string;
  fg: string;
  muted: string;
  numColor: string;
  tagColor: string;
}

export const lessonSteps: LessonStep[] = [
  { n: "01", label: "Cold Open", tag: "Hook", body: "A scenario that forces a position before the full economic picture is clear.", bg: "#fff", fg: "var(--bow-ink)", muted: "var(--bow-slate)", numColor: "var(--bow-blue)", tagColor: "var(--bow-blue)" },
  { n: "02", label: "The Economic Concept", tag: "Foundation", body: "The core idea — scarcity, opportunity cost, incentives — defined through the problem already on the table.", bg: "var(--bow-paper)", fg: "var(--bow-ink)", muted: "var(--bow-slate)", numColor: "var(--bow-blue)", tagColor: "var(--bow-orange)" },
  { n: "03", label: "Front-Office Brief", tag: "Context", body: "The facts, constraints, and what the decision requires. More information than expected. Less than wanted.", bg: "#fff", fg: "var(--bow-ink)", muted: "var(--bow-slate)", numColor: "var(--bow-orange)", tagColor: "var(--bow-orange)" },
  { n: "04", label: "Podcast Connection", tag: "Story", body: "A BOW Sports Capital episode grounds the concept in how the sports world actually operates.", bg: "var(--bow-paper)", fg: "var(--bow-ink)", muted: "var(--bow-slate)", numColor: "var(--bow-blue)", tagColor: "var(--bow-blue)" },
  { n: "05", label: "The Decision", tag: "Simulation", body: "You take the role. Real options, incomplete information, competing incentives. No obviously right answer.", bg: "var(--bow-ink)", fg: "#fff", muted: "#b9bcc4", numColor: "#6f8bff", tagColor: "var(--bow-orange)" },
  { n: "06", label: "The Consequence", tag: "Response", body: "The world responds. Cash, wins, chemistry, media, and ownership pressure all shift — immediately.", bg: "var(--bow-ink)", fg: "#fff", muted: "#b9bcc4", numColor: "var(--bow-positive)", tagColor: "var(--bow-positive)" },
  { n: "07", label: "The Debrief", tag: "Analysis", body: "Review what happened, the economics behind each option, and what the decision reveals about the concept.", bg: "var(--bow-paper)", fg: "var(--bow-ink)", muted: "var(--bow-slate)", numColor: "var(--bow-blue)", tagColor: "var(--bow-blue)" },
  { n: "08", label: "Podcast Extension", tag: "Deeper Read", body: "Optional: more analysis, a longer argument, a different case for students who want to push further.", bg: "#fff", fg: "var(--bow-ink)", muted: "var(--bow-slate)", numColor: "var(--bow-slate)", tagColor: "var(--bow-slate)" },
];

export interface Episode {
  num: string;
  topic: string;
  title: string;
  meta: string;
}

export const homeEpisodes: Episode[] = [
  { num: "EP 07", topic: "Salary Cap", title: "The Apron Era: How One Rule Rewired the League", meta: "38 MIN · TRACK 101 · M3 L2" },
  { num: "EP 06", topic: "Team Building", title: "Stars, Role Players, and the Math of a Contender", meta: "41 MIN · TRACK 101 · M2 L1" },
  { num: "EP 05", topic: "Ownership", title: "Who Really Pays When a Team Wins?", meta: "35 MIN · TRACK 201 · M1 L3" },
  { num: "EP 04", topic: "Sports Economics", title: "Opportunity Cost, Explained in Trades", meta: "33 MIN · TRACK 101 · M1 L2" },
];

export interface Pathway {
  title: string;
  accent: string;
  body: string;
  cta: string;
  href: string;
}

export const pathways: Pathway[] = [
  { title: "Students", accent: "var(--bow-blue)", body: "Explore tracks, make front-office decisions, and learn how the economics of sports actually work.", cta: "Find Your Track", href: "/get-involved/families" },
  { title: "Parents", accent: "var(--bow-orange)", body: "See what students build: economic reasoning, decision-making, communication, and confidence through decisions they already care about.", cta: "Explore the Program", href: "/get-involved/families" },
  { title: "Schools", accent: "var(--bow-positive)", body: "Offer a modern, discussion-driven economics and sports-business program that fits your classroom and schedule.", cta: "Bring BOW to School", href: "/get-involved/schools" },
  { title: "Camps", accent: "#5A6BFF", body: "High-energy workshops and short simulations built for camp schedules — no economics background needed.", cta: "Camp Programs", href: "/get-involved/camps" },
  { title: "Youth Orgs", accent: "var(--bow-warning)", body: "Flexible enrichment through workshops or structured courses — adaptable to almost any format or age group.", cta: "Workshop Options", href: "/get-involved/youth-organizations" },
  { title: "Partners", accent: "var(--bow-ink)", body: "Connect sports, business, media, education, and community engagement through a program built to develop strategic thinkers.", cta: "Explore a Partnership", href: "/get-involved/partners" },
];

export interface Format {
  n: string;
  title: string;
  detail: string;
}

export const formats: Format[] = [
  { n: "01", title: "One-Time Workshop", detail: "60–90 MIN" },
  { n: "02", title: "Multi-Session Course", detail: "4–8 WEEKS" },
  { n: "03", title: "Full-Track Program", detail: "1 SEMESTER" },
  { n: "04", title: "Camp Experience", detail: "1–5 DAYS" },
  { n: "05", title: "Custom Sports-Business Event", detail: "FLEXIBLE" },
];

export interface Impact {
  value: string;
  label: string;
}

// Sourced from lib/get-involved.ts's partnerVerifiedFacts — the same
// verified numbers shown on the Partners page's "Honest Numbers" section,
// so the homepage never claims more than what's actually built and counted.
export const impact: Impact[] = partnerVerifiedFacts.map((f) => ({ value: f.value, label: f.label }));

export interface Faq {
  id: string;
  q: string;
  a: string;
}

export const faqs: Faq[] = [
  { id: "who", q: "Who is BOW Sports Capital for?", a: "BOW is designed for students in grades 5 through 10 (Track 101 for grades 5–6, Track 201 for grades 7–8, both adaptable for older students) who want to learn economics through sports-business decisions. It works for individual students and group settings — schools, camps, and enrichment programs." },
  { id: "econ", q: "Do students need to know economics already?", a: "No. BOW introduces every concept through the sports-business decisions students already care about. You encounter each idea when it matters to the problem you’re solving — not in a vacuum." },
  { id: "sports", q: "Do students need to be sports experts?", a: "No sports expertise required. BOW teaches through the business side of sports — contracts, salaries, stadium deals, media rights. If you’ve ever had a strong opinion about a trade or a salary, you’re already ready." },
  { id: "length", q: "How long is a lesson?", a: "Most lessons take 12–18 minutes to complete, plus an optional simulation running another 8–15 minutes. Full lessons including the podcast extension and discussion typically fit within 45 minutes." },
  { id: "track", q: "What is included in a track?", a: "Each active track (101 and 201) includes 4 modules, 12 lessons, 12 connected simulations, and companion podcast episodes. Tracks are a progression, but students can enter through any individual lesson." },
  { id: "school", q: "Can BOW run a workshop for a school or camp?", a: "Yes. BOW works with schools, camps, and enrichment programs in formats ranging from a single 90-minute workshop to multi-session semester programs. We provide curriculum, simulations, discussion prompts, and facilitation guidance." },
  { id: "highway", q: "Is Highway World available yet?", a: "Highway World is currently in development. It is BOW’s interactive sports-business world — a driving overworld, mission interiors, and a live franchise headquarters. Sign up to follow development and get early access." },
  { id: "podcast", q: "How does the podcast connect to the lessons?", a: "Each podcast episode connects to a specific lesson, module, and economic concept. Episodes provide the real-world sports-business context before students enter the simulation — the context that makes the decision real." },
  { id: "remote", q: "Can students participate remotely?", a: "Yes. BOW’s lessons and simulations are designed for online delivery. Individual students can work through tracks on any device, and schools and camps can run remote sessions using BOW’s facilitation guides." },
  { id: "partner", q: "How can an organization partner with BOW?", a: "Fill out the inquiry form on the Get Involved page and tell us about your group. We’ll reach out about formats, timing, and how to build the right program for your students." },
];
