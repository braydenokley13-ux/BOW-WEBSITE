/* ============================================================
 * scripts/seed-site-content.ts — bootstrap and upgrade public CMS content.
 *
 * Phase one inserts the original CMS baseline only when a document, track, or
 * FAQ is missing. Phase two calls `upgradeMarketingArchitecture`, which makes
 * the current organization-focused architecture the published version while
 * preserving prior versions and incompatible owner drafts in history.
 *
 * Safety properties, in order of importance:
 *
 *   1. **Preserves history.** The upgrade publishes a new version; it does not
 *      rewrite or delete old page versions or owner-authored section rows.
 *   2. **Idempotent.** Safe to run again when a deploy retries. Current pages
 *      and verified publication records are recognized and left unchanged.
 *   3. **Non-destructive.** No DELETE or TRUNCATE. Obsolete public documents
 *      are archived, and incompatible active drafts are retained as
 *      superseded versions instead of being discarded.
 *
 * Usage:  npm run content:bootstrap
 *         npm run content:bootstrap -- --dry-run
 * ============================================================ */

import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const DRY_RUN = process.argv.includes("--dry-run");

function connectionUrl(): string {
  const value = (
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    ""
  ).trim();
  if (!value) {
    throw new Error(
      "[content] Missing POSTGRES_URL_NON_POOLING / POSTGRES_URL. Run `vercel env pull .env.local` " +
        "(or export the variable) before bootstrapping site content.",
    );
  }
  return value;
}

const now = () => Date.now();
const id = (prefix: string) => `${prefix}-${randomUUID().slice(0, 12)}`;

/* ------------------------------------------------------------------ *
 * Content types
 * ------------------------------------------------------------------ */

interface SeedSection {
  kind: string;
  data: Record<string, unknown>;
}

interface SeedPage {
  slug: string;
  kind: "page" | "track" | "system";
  path: string | null;
  name: string;
  description?: string;
  seoTitle?: string;
  seoDescription?: string;
  isSystem?: boolean;
  ordinal: number;
  sections: SeedSection[];
}

interface SeedTrack {
  slug: string;
  publicTitle: string;
  internalTitle: string;
  kicker: string;
  badgeLabel: string;
  headline: string;
  shortDescription: string;
  longDescription: string;
  gradeRange: string;
  audience: string;
  curriculumSummary: string;
  studentExperience: string;
  ctaLabel: string;
  ctaHref: string;
  seoTitle: string;
  seoDescription: string;
  featured: boolean;
  displayOrder: number;
  publicationStatus: "draft" | "published";
  sections: SeedSection[];
}

interface SeedFaq {
  question: string;
  answer: string;
  placements: { scopeKind: "page" | "track" | "program"; scopeKey: string }[];
}

/* ------------------------------------------------------------------ *
 * Global settings, navigation, footer
 * ------------------------------------------------------------------ */

const ORG_DESCRIPTION =
  "BOW Sports Capital helps middle and high school students learn economics, finance, leadership, and strategy by making the same decisions that shape teams, leagues, and the business of sports.";

const SYSTEM_PAGES: SeedPage[] = [
  {
    slug: "system-settings",
    kind: "system",
    path: null,
    name: "Global Settings",
    description: "Content that appears across the whole site.",
    isSystem: true,
    ordinal: 1,
    sections: [
      {
        kind: "global_settings",
        data: {
          organizationName: "BOW Sports Capital",
          organizationDescription: ORG_DESCRIPTION,
          primaryAnnouncement: "",
          primaryAnnouncementHref: "",
          defaultSocialImage: "/bow-social-preview.png",
          supportEmail: "hello@bowsportscapital.com",
          defaultRegistrationExplanation:
            "Registering takes about three minutes. You will get an email confirming the spot, plus anything still needed before the first session.",
          defaultInterestListExplanation:
            "Join the interest list and we will email you the moment registration opens — no account needed, and we never share your details.",
          defaultEmptyStateText:
            "New sessions are added regularly. Join the interest list and we will tell you the moment one opens.",
          seoTitlePattern: "%s · BOW Sports Capital",
          defaultSeoTitle: "BOW Sports Capital — The front office for the next generation",
          defaultSeoDescription: ORG_DESCRIPTION,
          primaryCtaLabel: "Find a Program",
          primaryCtaHref: "/programs",
          contactEmail: "hello@bowsportscapital.com",
          contactPhone: "",
          contactLocation: "Brooklyn, New York",
        },
      },
    ],
  },
  {
    slug: "system-navigation",
    kind: "system",
    path: null,
    name: "Navigation",
    description: "The links and buttons in the top bar.",
    isSystem: true,
    ordinal: 2,
    sections: [
      {
        kind: "nav_menu",
        data: {
          items: [
            { label: "Home", href: "/", visible: true, children: [] },
            {
              label: "Programs",
              href: "/programs",
              visible: true,
              children: [
                { label: "Find a Program", href: "/programs/find", visible: true },
                { label: "Track 101", href: "/programs/track-101", visible: true },
                { label: "Track 201", href: "/programs/track-201", visible: true },
              ],
            },
            {
              label: "Get Involved",
              href: "/get-involved",
              visible: true,
              children: [
                { label: "For Families", href: "/get-involved/families", visible: true },
                { label: "For Schools", href: "/get-involved/schools", visible: true },
                { label: "For Camps", href: "/get-involved/camps", visible: true },
                { label: "Youth Organizations", href: "/get-involved/youth-organizations", visible: true },
                { label: "Partners", href: "/get-involved/partners", visible: true },
              ],
            },
            // The simulations were live and linked from nowhere. Top-level
            // placement is the fix — burying the library in a submenu would
            // leave the discovery gap it exists to close.
            {
              label: "Simulations",
              href: "/simulations",
              visible: true,
              children: [
                { label: "All Simulations", href: "/simulations", visible: true },
                { label: "Concept Map", href: "/concept-map", visible: true },
                { label: "Glossary", href: "/glossary", visible: true },
              ],
            },
            { label: "Teach", href: "/teach", visible: true, children: [] },
          ],
          signInLabel: "Sign In",
          signInHref: "/sign-in",
          primaryCtaLabel: "Find a Program",
          primaryCtaHref: "/programs",
          secondaryCtaLabel: "Apply to Teach",
          secondaryCtaHref: "/teach",
        },
      },
    ],
  },
  {
    slug: "system-footer",
    kind: "system",
    path: null,
    name: "Footer",
    description: "Footer description, link columns, contact, social, and legal links.",
    isSystem: true,
    ordinal: 3,
    sections: [
      {
        kind: "footer_columns",
        data: {
          tagline: "Sports Capital",
          description:
            "The front office for the next generation. Read the game. Run the business. Make the decision.",
          contactText: "hello@bowsportscapital.com",
          columns: [
            {
              heading: "Programs",
              links: [
                { label: "Programs Overview", href: "/programs" },
                { label: "Find a Program", href: "/programs/find" },
                { label: "Track 101", href: "/programs/track-101" },
                { label: "Track 201", href: "/programs/track-201" },
                { label: "Track 301 — Coming", href: "/programs/track-301" },
              ],
            },
            {
              heading: "Get Involved",
              links: [
                { label: "Get Involved", href: "/get-involved" },
                { label: "For Families", href: "/get-involved/families" },
                { label: "For Schools", href: "/get-involved/schools" },
                { label: "Partners", href: "/get-involved/partners" },
              ],
            },
            {
              heading: "Learn More",
              links: [
                { label: "About BOW", href: "/about" },
                { label: "Simulations", href: "/simulations" },
                { label: "Concept Map", href: "/concept-map" },
                { label: "Standards Alignment", href: "/standards" },
                { label: "Glossary", href: "/glossary" },
                { label: "Podcast", href: "/podcast" },
              ],
            },
            {
              heading: "Contact",
              links: [
                { label: "Contact / Partnerships", href: "/contact" },
                { label: "Become an Instructor", href: "/teach" },
              ],
            },
            {
              heading: "Account",
              links: [{ label: "Sign In", href: "/sign-in" }],
            },
          ],
          socialLinks: [],
          legalLinks: [],
          baseNote: "EDITORIAL ON THE OUTSIDE · FRONT OFFICE ON THE INSIDE",
        },
      },
    ],
  },
];

/* ------------------------------------------------------------------ *
 * Home
 * ------------------------------------------------------------------ */

const HOME: SeedPage = {
  slug: "home",
  kind: "page",
  path: "/",
  name: "Home",
  ordinal: 1,
  seoTitle: "BOW Sports Capital — The front office for the next generation",
  seoDescription: ORG_DESCRIPTION,
  sections: [
    {
      kind: "hero",
      data: {
        eyebrow: "Sports is the hook. Economics is the lesson.",
        headline: "Learn to make the decisions behind the game.",
        body:
          "BOW Sports Capital teaches middle and high school students economics, finance, and strategy by putting them in the chair where the calls actually get made.",
        ghostText: "101",
        tone: "paper",
        actions: [
          { label: "Find a program", href: "/programs", variant: "primary" },
          { label: "See how it works", href: "#tracks", variant: "secondary" },
        ],
      },
    },
    {
      kind: "text",
      data: {
        eyebrow: "Welcome to the front office",
        headline: "Sports are the entry point. Decision-making is the education.",
        body:
          "BOW doesn’t teach sports trivia. Students run into the same constraints real front offices face — and defend the calls they make.",
        tone: "paper",
      },
    },
    {
      kind: "list",
      data: {
        style: "chips",
        tone: "paper",
        items: [
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
        ],
      },
    },
    {
      kind: "steps",
      data: {
        eyebrow: "Every lesson runs the same loop",
        tone: "paper",
        style: "grid",
        items: [
          { number: "01", label: "The Brief", body: "The economic concept arrives as a problem on your desk: the context, the constraints, and the call you have to make." },
          { number: "02", label: "The Story", body: "A BOW Sports Capital podcast episode grounds the idea in how the sports world actually operates." },
          { number: "03", label: "The Decision", body: "You take the role and make the call inside the simulation — real options, incomplete information, no obviously right answer." },
          { number: "04", label: "The Consequence", body: "The world responds. You live with the result and defend your reasoning." },
        ],
      },
    },
    {
      kind: "decision_demo",
      data: {
        eyebrow: "Try the simulation",
        headline: "Don’t just learn the decision. Make it.",
        body:
          "Every lesson ends in an interactive brief: take the role, weigh what you know against what you don’t, and live with the result.",
        tone: "ink",
        desk: "Decision Desk",
        round: "Round 03 · The Extension",
        prompt:
          "Your franchise point guard wants a max extension. The cap says you can't afford it next summer. What do you do tonight?",
        primaryLabel: "Make the Call",
        meta: [
          { label: "Role", value: "General Manager" },
          { label: "Runtime", value: "12–18 min" },
          { label: "Format", value: "Solo or group" },
        ],
        facts: [
          { label: "Cap Space", value: "-$8.4M", tone: "negative" },
          { label: "Team Value", value: "$3.1B", tone: "neutral" },
          { label: "Title Odds", value: "14%", tone: "neutral" },
          { label: "Luxury Tax", value: "$31M", tone: "warning" },
        ],
        unknowns: ["INJURY RISK: MEDIUM", "MARKET: COOLING", "OWNER PATIENCE: 1 SEASON"],
        options: [
          { id: "extend", label: "Extend him now", detail: "$42M / 3 YRS · pushes you $8.4M over the second apron" },
          { id: "trade", label: "Trade at peak value", detail: "Returns two firsts + a young wing on a rookie deal" },
          { id: "hold", label: "Run it back, decide at the deadline", detail: "Preserve flexibility, risk a cooling market" },
        ],
        outcomes: [
          {
            optionId: "extend",
            status: "warning",
            headline: "You kept the window open — and mortgaged 2027.",
            body: "The extension triggers second-apron penalties: frozen picks, no aggregation, a hard cap. You can win now, but every future move gets harder. That is the cost of certainty.",
          },
          {
            optionId: "trade",
            status: "positive",
            headline: "You sold high and reset the timeline.",
            body: "Two firsts and a cost-controlled wing restore your flexibility. The fan base is furious for a month. Eighteen months later, the rebuild looks like foresight.",
          },
          {
            optionId: "hold",
            status: "negative",
            headline: "You waited — and the market decided for you.",
            body: "A rival overpays at the deadline and your leverage evaporates. Indecision is a decision; it just hands the pen to someone else.",
          },
        ],
      },
    },
    {
      kind: "track_collection",
      data: {
        eyebrow: "The programs",
        headline: "Choose your path into sports business.",
        tone: "raised",
        layout: "compare",
        trackSlugs: ["track-101", "track-201"],
      },
    },
    {
      kind: "program_collection",
      data: {
        eyebrow: "Open now",
        headline: "Upcoming programs",
        tone: "paper",
        limit: 3,
        showAllLabel: "See all programs",
        showAllHref: "/programs",
        hideWhenEmpty: true,
      },
    },
    {
      kind: "stats",
      data: {
        eyebrow: "Where BOW stands",
        headline: "Built and counted, not projected.",
        tone: "ink",
        items: [
          { value: "30", label: "Students in current programs" },
          { value: "2", label: "Active curriculum tracks" },
          { value: "24", label: "Structured lesson records" },
          { value: "4", label: "Press mentions" },
          { value: "1", label: "Track in development" },
        ],
      },
    },
    {
      kind: "testimonials",
      data: { tone: "ink", limit: 3 },
    },
    {
      kind: "feature_cards",
      data: {
        eyebrow: "Find your way in",
        headline: "However you got here, there’s a door.",
        tone: "paper",
        columns: 2,
        groups: [
          {
            label: "Join a program",
            cards: [
              { title: "Students", body: "Explore tracks, make front-office decisions, and learn how the economics of sports actually work.", ctaLabel: "Find your track", href: "/get-involved/families" },
              { title: "Parents", body: "See what students build: economic reasoning, decision-making, communication, and confidence — through decisions they already care about.", ctaLabel: "See what students build", href: "/get-involved/families" },
            ],
          },
          {
            label: "Bring BOW to your group",
            cards: [
              { title: "Schools", body: "Offer a modern, discussion-driven economics and sports-business program that fits your classroom and schedule.", ctaLabel: "Bring BOW to your school", href: "/get-involved/schools" },
              { title: "Camps", body: "High-energy workshops and short simulations built for camp schedules — no economics background needed.", ctaLabel: "See camp formats", href: "/get-involved/camps" },
              { title: "Youth Orgs", body: "Flexible enrichment through workshops or structured courses — adaptable to almost any format or age group.", ctaLabel: "See workshop options", href: "/get-involved/youth-organizations" },
              { title: "Partners", body: "Connect sports, business, media, education, and community engagement through a program built to develop strategic thinkers.", ctaLabel: "Explore a partnership", href: "/get-involved/partners" },
            ],
          },
        ],
      },
    },
    {
      kind: "steps",
      data: {
        eyebrow: "Formats we run",
        tone: "paper",
        style: "spec",
        items: [
          { number: "01", label: "One-Time Workshop", detail: "60–90 MIN" },
          { number: "02", label: "Multi-Session Course", detail: "4–8 WEEKS" },
          { number: "03", label: "Full-Track Program", detail: "1 SEMESTER" },
          { number: "04", label: "Camp Experience", detail: "1–5 DAYS" },
          { number: "05", label: "Custom Sports-Business Event", detail: "FLEXIBLE" },
        ],
      },
    },
    {
      kind: "media_list",
      data: {
        eyebrow: "The BOW Sports Capital podcast",
        headline: "The conversations behind the decisions.",
        body:
          "Each episode connects sports headlines, front-office strategy, and business concepts to the decisions students make throughout the curriculum.",
        tone: "raised",
        actions: [{ label: "Explore the podcast", href: "/podcast", variant: "ink" }],
        items: [
          { tag: "EP 07", kicker: "Salary Cap", title: "The Apron Era: How One Rule Rewired the League", meta: "38 MIN · TRACK 101 · M3 L2", href: "/podcast" },
          { tag: "EP 06", kicker: "Team Building", title: "Stars, Role Players, and the Math of a Contender", meta: "41 MIN · TRACK 101 · M2 L1", href: "/podcast" },
          { tag: "EP 05", kicker: "Ownership", title: "Who Really Pays When a Team Wins?", meta: "35 MIN · TRACK 201 · M1 L3", href: "/podcast" },
          { tag: "EP 04", kicker: "Sports Economics", title: "Opportunity Cost, Explained in Trades", meta: "33 MIN · TRACK 101 · M1 L2", href: "/podcast" },
        ],
      },
    },
    {
      kind: "image_text",
      data: {
        eyebrow: "Now recruiting volunteer instructors",
        headline: "Help us teach the next generation of sports decision-makers.",
        body:
          "Teaching with BOW is a volunteer role. We provide the curriculum and the training. You bring preparation, judgment, and the willingness to improve.",
        tone: "ink",
        imagePosition: "right",
        bullets: ["Clear hiring process", "Training before assignment", "Real work with evidence", "Coaching and growth"],
        actions: [
          { label: "Explore teaching at BOW", href: "/teach", variant: "primary" },
          { label: "Get involved", href: "/get-involved", variant: "secondary" },
        ],
      },
    },
    {
      kind: "faq",
      data: { eyebrow: "FAQ", headline: "What people want to know.", tone: "paper" },
    },
    {
      kind: "cta",
      data: {
        headline: "Step into the front office.",
        body: "Explore the tracks, find the right starting point, and begin making the decisions behind the game.",
        ghostText: "BOW",
        tone: "blue",
        actions: [
          { label: "Explore programs", href: "/programs", variant: "ink" },
          { label: "Join the interest list", href: "/sign-up", variant: "secondary" },
        ],
      },
    },
  ],
};

/* ------------------------------------------------------------------ *
 * Remaining marketing pages
 * ------------------------------------------------------------------ */

const PAGES: SeedPage[] = [
  HOME,
  {
    slug: "about",
    kind: "page",
    path: "/about",
    name: "About",
    ordinal: 2,
    seoTitle: "About BOW Sports Capital",
    seoDescription:
      "Why BOW exists, what students actually build, and how sports became the most honest way to teach economics.",
    sections: [
      {
        kind: "hero",
        data: {
          eyebrow: "About BOW Sports Capital",
          headline: "Sports is the most honest economics classroom there is.",
          body:
            "Every trade, contract, and ticket price is a decision made under scarcity, with incomplete information and real consequences. BOW puts students in that chair.",
          tone: "paper",
          actions: [{ label: "See the programs", href: "/programs", variant: "primary" }],
        },
      },
      {
        kind: "text",
        data: {
          eyebrow: "Why BOW exists",
          headline: "Economics is taught as vocabulary. It is lived as judgment.",
          body:
            "Most students meet economics as a list of definitions to memorise before an exam. BOW inverts that: the decision comes first, the consequence lands second, and the concept is named third — once the student has already felt it.\n\nSports is the entry point because the stakes are legible. A twelve-year-old already has an opinion about a trade. BOW takes that opinion seriously, then shows what it costs.",
          tone: "white",
        },
      },
      {
        kind: "list",
        data: {
          eyebrow: "What students build",
          headline: "The skills that outlast the sport.",
          tone: "paper",
          style: "rows",
          items: [
            "Economic reasoning",
            "Decision-making under pressure",
            "Confidence in complex situations",
            "Communication of strategy",
            "Negotiation skills",
            "Financial literacy",
            "Strategic thinking",
            "Understanding consequences",
          ],
        },
      },
      {
        kind: "stats",
        data: {
          eyebrow: "Where BOW stands",
          headline: "Built and counted, not projected.",
          tone: "ink",
          items: [
            { value: "30", label: "Students in current programs" },
            { value: "2", label: "Active curriculum tracks" },
            { value: "24", label: "Structured lesson records" },
            { value: "4", label: "Press mentions" },
            { value: "1", label: "Track in development" },
          ],
        },
      },
      {
        kind: "cta",
        data: {
          headline: "Bring BOW to your students.",
          body: "Schools, camps, and youth organisations run BOW in formats from a single workshop to a full semester.",
          tone: "blue",
          actions: [
            { label: "Get involved", href: "/get-involved", variant: "ink" },
            { label: "Contact BOW", href: "/contact", variant: "secondary" },
          ],
        },
      },
    ],
  },
  {
    slug: "programs",
    kind: "page",
    path: "/programs",
    name: "Programs",
    ordinal: 3,
    seoTitle: "Programs",
    seoDescription:
      "Real, upcoming BOW Sports Capital programs students can join today — plus the curriculum behind them.",
    sections: [
      {
        kind: "hero",
        data: {
          eyebrow: "Programs",
          headline: "What can my student join?",
          body: "Real programs, real dates. Register directly below — no account required.",
          tone: "ink",
          actions: [{ label: "Find the right fit", href: "/programs/find", variant: "primary" }],
        },
      },
      {
        kind: "program_collection",
        data: {
          eyebrow: "Join Now",
          headline: "Upcoming programs",
          tone: "paper",
          limit: 0,
          emptyHeadline: "No programs are open for registration right now.",
          emptyBody: "New sessions are added regularly. Join the interest list and we will tell you the moment one opens.",
          emptyActionLabel: "Join the Interest List",
          emptyActionHref: "/sign-up",
        },
      },
      {
        kind: "track_collection",
        data: {
          eyebrow: "Explore the BOW Curriculum",
          headline: "What BOW teaches",
          tone: "white",
          layout: "grid",
        },
      },
      {
        kind: "faq",
        data: { eyebrow: "FAQ", headline: "Before you register", tone: "paper" },
      },
    ],
  },
  {
    slug: "programs-find",
    kind: "page",
    path: "/programs/find",
    name: "Find a Program",
    ordinal: 4,
    seoTitle: "Find a Program",
    seoDescription:
      "Answer a few short questions and see which BOW Sports Capital programs fit your student.",
    sections: [
      {
        kind: "hero",
        data: {
          eyebrow: "Find a Program",
          headline: "A few questions, a real list of fits.",
          body:
            "This is a straightforward match against each program’s grade range, format, and schedule — not an algorithm making a decision for you.",
          tone: "ink",
        },
      },
    ],
  },
  {
    slug: "programs-register",
    kind: "page",
    path: "/programs/register",
    name: "Family Registration",
    ordinal: 5,
    seoTitle: "Register",
    seoDescription: "Register one or more children for BOW Sports Capital programs in a single form.",
    sections: [
      {
        kind: "hero",
        data: {
          eyebrow: "Registration",
          headline: "Register your family",
          body:
            "Add every child you’re registering and the programs each one is joining. No account is required — one submission covers your whole family.",
          tone: "paper",
        },
      },
    ],
  },
  {
    slug: "get-involved",
    kind: "page",
    path: "/get-involved",
    name: "Get Involved",
    ordinal: 6,
    seoTitle: "Get Involved",
    seoDescription:
      "Step into the front office. Bring BOW to a school, camp, or youth organization, join as a student or family, or explore a partnership.",
    sections: [
      {
        kind: "hero",
        data: {
          eyebrow: "Get Involved",
          headline: "Step into the front office.",
          body:
            "Tell us who you are and what you are trying to run. The form below adapts to your answer, and a real person reads every submission.",
          tone: "ink",
        },
      },
    ],
  },
  {
    slug: "get-involved-families",
    kind: "page",
    path: "/get-involved/families",
    name: "For Families",
    ordinal: 7,
    seoTitle: "For Families",
    seoDescription:
      "What students actually build in BOW — economic reasoning, decision-making, and the confidence to defend a call.",
    sections: [
      {
        kind: "hero",
        data: {
          eyebrow: "For Families",
          headline: "Your student already argues about trades. We take that seriously.",
          body:
            "BOW turns the opinions a student already has about sports into economic reasoning they can use anywhere — and gives them the language to defend it.",
          tone: "paper",
          actions: [
            { label: "See open programs", href: "/programs", variant: "primary" },
            { label: "Find the right fit", href: "/programs/find", variant: "secondary" },
          ],
        },
      },
      {
        kind: "steps",
        data: {
          eyebrow: "What a student does",
          headline: "The journey through a BOW program.",
          tone: "white",
          style: "grid",
          items: [
            { number: "01", label: "Enter the Problem", body: "A sports decision where the stakes are real and the budget is tight. No vocabulary list first." },
            { number: "02", label: "Make the Call", body: "Choose from meaningful options. Each one has a real tradeoff the student must weigh." },
            { number: "03", label: "See What Changes", body: "The consequence arrives. Cap space, wins, fan trust, sponsor revenue — something shifts." },
            { number: "04", label: "Name the Principle", body: "Now the economic concept appears — scarcity, opportunity cost, incentives — grounded in what just happened." },
          ],
        },
      },
      {
        kind: "list",
        data: {
          eyebrow: "What we reward",
          headline: "The habits BOW is actually building.",
          tone: "paper",
          style: "rows",
          items: [
            "Curiosity about how decisions get made",
            "Willingness to use evidence",
            "Interest in revising an answer",
            "Ability to explain a tradeoff",
            "Confidence in arguing a position",
            "Willingness to experiment",
          ],
        },
      },
      { kind: "faq", data: { eyebrow: "FAQ", headline: "Questions families ask", tone: "white" } },
      {
        kind: "cta",
        data: {
          headline: "Find the right program for your student.",
          body: "Answer a few questions and see which BOW programs fit their grade, schedule, and format.",
          tone: "blue",
          actions: [
            { label: "Find a program", href: "/programs/find", variant: "ink" },
            { label: "Join the interest list", href: "/sign-up", variant: "secondary" },
          ],
        },
      },
    ],
  },
  {
    slug: "get-involved-schools",
    kind: "page",
    path: "/get-involved/schools",
    name: "For Schools",
    ordinal: 8,
    seoTitle: "For Schools",
    seoDescription:
      "A discussion-driven economics and sports-business program that fits a class period, an advisory block, or a full semester.",
    sections: [
      {
        kind: "hero",
        data: {
          eyebrow: "For Schools",
          headline: "Economics that fits your period, your standards, and your students.",
          body:
            "BOW provides the curriculum, the facilitation guides, the discussion prompts, and the case materials. A teacher can lead it, or BOW can facilitate directly.",
          tone: "paper",
          actions: [
            { label: "Start a conversation", href: "/get-involved", variant: "primary" },
            { label: "See standards alignment", href: "/standards", variant: "secondary" },
          ],
        },
      },
      {
        kind: "list",
        data: {
          eyebrow: "Learning outcomes",
          headline: "What a student can do afterwards.",
          tone: "white",
          style: "numbered",
          items: [
            "Identify an economic constraint in a real sports-business situation",
            "Distinguish revenue from profit and explain why both matter",
            "Explain opportunity cost using evidence from a case",
            "Predict how changing one variable affects an outcome",
            "Compare short-term and long-term strategies and weigh tradeoffs",
            "Defend a resource-allocation decision with economic reasoning",
            "Connect one economic model across two different settings",
            "Use evidence to support — and revise — a conclusion",
          ],
        },
      },
      {
        kind: "steps",
        data: {
          eyebrow: "Formats we run",
          tone: "paper",
          style: "spec",
          items: [
            { number: "01", label: "One-Time Workshop", detail: "60–90 MIN" },
            { number: "02", label: "Multi-Session Course", detail: "4–8 WEEKS" },
            { number: "03", label: "Full-Track Program", detail: "1 SEMESTER" },
            { number: "04", label: "Camp Experience", detail: "1–5 DAYS" },
            { number: "05", label: "Custom Sports-Business Event", detail: "FLEXIBLE" },
          ],
        },
      },
      { kind: "faq", data: { eyebrow: "FAQ", headline: "Questions schools ask", tone: "white" } },
      {
        kind: "cta",
        data: {
          headline: "Bring BOW to your school.",
          body: "Tell us about your students, your schedule, and what you are trying to run.",
          tone: "blue",
          actions: [{ label: "Get in touch", href: "/get-involved", variant: "ink" }],
        },
      },
    ],
  },
  {
    slug: "get-involved-camps",
    kind: "page",
    path: "/get-involved/camps",
    name: "For Camps",
    ordinal: 9,
    seoTitle: "For Camps",
    seoDescription:
      "High-energy sports-business workshops and short simulations built for camp schedules — no economics background needed.",
    sections: [
      {
        kind: "hero",
        data: {
          eyebrow: "For Camps",
          headline: "A session campers argue about at dinner.",
          body:
            "Designed for a standard indoor space, one device per team, and a group that has never opened an economics textbook.",
          tone: "paper",
          actions: [{ label: "Talk to us about a session", href: "/get-involved", variant: "primary" }],
        },
      },
      {
        kind: "steps",
        data: {
          eyebrow: "What a session looks like",
          tone: "white",
          style: "grid",
          items: [
            { number: "01", label: "Set the brief", body: "Teams get a front-office problem with a budget that does not stretch far enough." },
            { number: "02", label: "Argue it out", body: "Each team weighs the options and has to commit to one, out loud." },
            { number: "03", label: "Live the result", body: "The consequence lands. Something they cared about moves." },
            { number: "04", label: "Name the idea", body: "The economics gets named once they have already felt it." },
          ],
        },
      },
      { kind: "faq", data: { eyebrow: "FAQ", headline: "Questions camps ask", tone: "paper" } },
      {
        kind: "cta",
        data: {
          headline: "Run BOW at your camp.",
          body: "Tell us your group size, age range, and how long you have.",
          tone: "blue",
          actions: [{ label: "Get in touch", href: "/get-involved", variant: "ink" }],
        },
      },
    ],
  },
  {
    slug: "get-involved-youth-organizations",
    kind: "page",
    path: "/get-involved/youth-organizations",
    name: "For Youth Organizations",
    ordinal: 10,
    seoTitle: "For Youth Organizations",
    seoDescription:
      "Flexible enrichment through workshops or structured courses — adaptable to almost any format or age group.",
    sections: [
      {
        kind: "hero",
        data: {
          eyebrow: "For Youth Organizations",
          headline: "Enrichment that transfers beyond the sport.",
          body:
            "BOW cases are designed to be facilitated at different depths and age bands, and the closing transfer challenge can be shaped around your organisation’s own context.",
          tone: "paper",
          actions: [{ label: "Start a conversation", href: "/get-involved", variant: "primary" }],
        },
      },
      {
        kind: "feature_cards",
        data: {
          eyebrow: "How organisations run BOW",
          tone: "white",
          columns: 3,
          groups: [
            {
              label: "",
              cards: [
                { title: "Staff-led", body: "BOW provides facilitation guides and case materials; your staff run the sessions." },
                { title: "BOW-facilitated", body: "A trained BOW facilitator runs the session with your group." },
                { title: "Recurring program", body: "Multi-session arcs that build a complete reasoning progression." },
              ],
            },
          ],
        },
      },
      { kind: "faq", data: { eyebrow: "FAQ", headline: "Questions organizations ask", tone: "paper" } },
      {
        kind: "cta",
        data: {
          headline: "Bring BOW to your participants.",
          body: "Tell us about your group and what you are trying to build.",
          tone: "blue",
          actions: [{ label: "Get in touch", href: "/get-involved", variant: "ink" }],
        },
      },
    ],
  },
  {
    slug: "get-involved-partners",
    kind: "page",
    path: "/get-involved/partners",
    name: "Partners",
    ordinal: 11,
    seoTitle: "Partners",
    seoDescription:
      "Connect sports, business, media, education, and community engagement through a program built to develop strategic thinkers.",
    sections: [
      {
        kind: "hero",
        data: {
          eyebrow: "Partnerships",
          headline: "Build the front office for the next generation with us.",
          body: "BOW partners bring distribution, expertise, authenticity, or access — and get a program that puts real economics in front of students who would not otherwise meet it.",
          tone: "paper",
          actions: [{ label: "Explore a partnership", href: "/get-involved/partner-inquiry", variant: "primary" }],
        },
      },
      {
        kind: "feature_cards",
        data: {
          eyebrow: "Where partners fit",
          headline: "Six ways to work together.",
          tone: "white",
          columns: 3,
          groups: [
            {
              label: "",
              cards: [
                { title: "Program Distribution", body: "Schools, camps, youth networks, libraries, and enrichment providers who can bring BOW to more students." },
                { title: "Curriculum & Academic Review", body: "Economists, educators, curriculum specialists, and researchers who can strengthen and validate the learning model." },
                { title: "Sports Industry Access", body: "Teams, leagues, sports business professionals, and front-office experts who can deepen the authenticity of cases." },
                { title: "Media & Storytelling", body: "Podcast, journalism, video, and educational content partners who can extend the BOW voice." },
                { title: "Technology & Simulation", body: "Organizations that can support interactive learning infrastructure, simulation development, or platform expansion." },
                { title: "Access & Sponsorship", body: "Partners that can help provide programming to students who would not otherwise have access." },
              ],
            },
          ],
        },
      },
      {
        kind: "stats",
        data: {
          eyebrow: "Honest numbers",
          headline: "Built and counted, not projected.",
          tone: "ink",
          items: [
            { value: "30", label: "Students in current programs" },
            { value: "2", label: "Active curriculum tracks" },
            { value: "24", label: "Structured lesson records" },
            { value: "4", label: "Press mentions" },
            { value: "1", label: "Track in development" },
          ],
        },
      },
      {
        kind: "cta",
        data: {
          headline: "Start a partnership conversation.",
          body: "Tell us what you can bring and what you would want out of it.",
          tone: "blue",
          actions: [{ label: "Partnership inquiry", href: "/get-involved/partner-inquiry", variant: "ink" }],
        },
      },
    ],
  },
  {
    slug: "get-involved-partner-inquiry",
    kind: "page",
    path: "/get-involved/partner-inquiry",
    name: "Partnership Inquiry",
    ordinal: 12,
    seoTitle: "Partnership Inquiry",
    seoDescription: "Tell BOW Sports Capital about your organisation and what a partnership could look like.",
    sections: [
      {
        kind: "hero",
        data: {
          eyebrow: "Partnerships",
          headline: "Tell us about your organisation.",
          body: "A real person reads every submission. Expect a reply within a few business days.",
          tone: "paper",
        },
      },
    ],
  },
  {
    slug: "teach",
    kind: "page",
    path: "/teach",
    name: "Teach with BOW",
    ordinal: 13,
    seoTitle: "Teach with BOW",
    seoDescription:
      "Help young people learn economics, finance, leadership, and strategy through sports-business decisions.",
    sections: [
      {
        kind: "hero",
        data: {
          eyebrow: "We’re building the instructor team",
          headline: "Help students learn to make the decisions behind sports.",
          body:
            "BOW instructors turn sports into a live classroom for economics, finance, leadership, and strategy. You do not lecture from a textbook — you guide decisions, tradeoffs, and consequences. Teaching with BOW is a volunteer role.",
          ghostText: "TEACH",
          tone: "ink",
          actions: [
            { label: "Apply to Teach", href: "/get-involved/apply", variant: "primary" },
            { label: "See what BOW teaches", href: "/programs", variant: "secondary" },
          ],
        },
      },
      {
        kind: "steps",
        data: {
          eyebrow: "The role",
          headline: "Teach the business of sports. Build judgment that travels beyond it.",
          tone: "white",
          style: "grid",
          items: [
            { number: "01", label: "Prepare", body: "Learn BOW’s curriculum and enter each session ready to guide decisions." },
            { number: "02", label: "Facilitate", body: "Help students explain tradeoffs, challenge assumptions, and adapt their strategy." },
            { number: "03", label: "Close the loop", body: "Record what happened, respond to coaching, and improve the next session." },
          ],
        },
      },
      {
        kind: "list",
        data: {
          eyebrow: "What we provide",
          tone: "paper",
          style: "rows",
          items: [
            "A clear hiring process with real feedback",
            "Training before your first assignment",
            "Curriculum, facilitation guides, and case materials",
            "Coaching against a written quality standard",
          ],
        },
      },
      { kind: "faq", data: { eyebrow: "FAQ", headline: "Questions instructors ask", tone: "white" } },
      {
        kind: "cta",
        data: {
          headline: "Apply to teach with BOW.",
          body: "Tell us who you are and what you want to help students learn.",
          tone: "blue",
          actions: [{ label: "Apply to Teach", href: "/get-involved/apply", variant: "ink" }],
        },
      },
    ],
  },
  {
    slug: "contact",
    kind: "page",
    path: "/contact",
    name: "Contact",
    ordinal: 14,
    seoTitle: "Contact BOW Sports Capital",
    seoDescription:
      "Bring BOW Sports Capital to your students. Reach out about a league, school, camp, or youth-organization partnership.",
    sections: [
      {
        kind: "contact",
        data: {
          eyebrow: "Partnerships",
          headline: "Bring BOW to your students.",
          body:
            "Self-paced. Standards-aligned to AP Micro and AP Macro. Measurable engagement for every student. Tell us about your program and we’ll be in touch.",
          tone: "ink",
          email: "hello@bowsportscapital.com",
          location: "Brooklyn, New York",
          formIntro: "",
          showForm: true,
        },
      },
    ],
  },
  {
    slug: "news",
    kind: "page",
    path: "/news",
    name: "In the News",
    ordinal: 15,
    seoTitle: "In the News",
    seoDescription:
      "Real sports-business headlines, tied to the economic concepts BOW teaches. See the front office at work in the news.",
    sections: [
      {
        kind: "hero",
        data: {
          eyebrow: "In the News",
          headline: "The front office, in real time.",
          body:
            "Real sports-business stories, each tagged with the BOW concept it illustrates. The economics you learn is happening in the headlines right now.",
          tone: "ink",
        },
      },
    ],
  },
  {
    slug: "glossary",
    kind: "page",
    path: "/glossary",
    name: "Glossary",
    ordinal: 16,
    seoTitle: "Front Office Glossary",
    seoDescription:
      "A searchable, plain-English glossary of every term in the BOW curriculum — from salary cap and Bird Rights to opportunity cost and Wins Above Replacement.",
    sections: [
      {
        kind: "hero",
        data: {
          eyebrow: "BOW Sports Capital Curriculum",
          headline: "The Front Office Glossary",
          body:
            "Every term BOW students learn, defined in plain English with a real-world example — the language of the front office, made readable for a twelve-year-old.",
          tone: "ink",
        },
      },
    ],
  },
  {
    slug: "standards",
    kind: "page",
    path: "/standards",
    name: "Standards Alignment",
    ordinal: 17,
    seoTitle: "AP Economics Standards Alignment",
    seoDescription:
      "How every BOW Sports Capital module maps to specific AP Microeconomics and AP Macroeconomics standards — the document a curriculum committee needs.",
    sections: [
      {
        kind: "hero",
        data: {
          eyebrow: "BOW Sports Capital Curriculum",
          headline: "AP Economics Standards Alignment",
          body:
            "Every BOW module maps to specific AP Microeconomics and AP Macroeconomics standards. This is the document a curriculum committee or partnership team needs to evaluate BOW.",
          tone: "ink",
        },
      },
      {
        kind: "text",
        data: {
          tone: "paper",
          body:
            "BOW Sports Capital is not a sports trivia program. It is an economics education platform that uses sports as the delivery mechanism for concepts that appear on the AP Economics exam. Students who complete both tracks will have been exposed to the majority of AP Micro and AP Macro content — through real decisions, not memorization.",
        },
      },
    ],
  },
  {
    slug: "concept-map",
    kind: "page",
    path: "/concept-map",
    name: "Concept Map",
    ordinal: 18,
    seoTitle: "The Front Office Concept Map",
    seoDescription:
      "Every concept taught in BOW, drawn from AP Microeconomics, AP Macroeconomics, or real front-office practice.",
    sections: [
      {
        kind: "hero",
        data: {
          eyebrow: "BOW Sports Capital Curriculum",
          headline: "The Front Office Concept Map",
          body:
            "Every concept taught in BOW is drawn from AP Microeconomics, AP Macroeconomics, or real NBA/NFL/MLB front-office practice. This is what your students will learn.",
          tone: "ink",
        },
      },
    ],
  },
  {
    slug: "simulation",
    kind: "page",
    path: "/simulation",
    name: "Simulation",
    ordinal: 19,
    seoTitle: "Simulation",
    seoDescription:
      "Step into the war room. You’re the GM: across three rounds, decide what your young star is really worth — and what you’re willing to give up to win now.",
    sections: [
      {
        kind: "hero",
        data: {
          eyebrow: "Try it now",
          headline: "You’re the GM. Three rounds. One roster spot.",
          body:
            "Decide what your young star is really worth — and what you’re willing to give up to win now.",
          tone: "paper",
        },
      },
    ],
  },
  {
    slug: "podcast",
    kind: "page",
    path: "/podcast",
    name: "Podcast",
    ordinal: 20,
    seoTitle: "The BOW Sports Capital Podcast",
    seoDescription:
      "The conversations behind the decisions — sports headlines, front-office strategy, and the economics underneath both.",
    sections: [
      {
        kind: "hero",
        data: {
          eyebrow: "The BOW Sports Capital podcast",
          headline: "The conversations behind the decisions.",
          body:
            "Each episode connects sports headlines, front-office strategy, and business concepts to the decisions students make throughout the curriculum.",
          tone: "ink",
        },
      },
    ],
  },
  {
    slug: "highway-world",
    kind: "page",
    path: "/highway-world",
    name: "Highway World",
    ordinal: 21,
    seoTitle: "Highway World",
    seoDescription:
      "BOW’s interactive sports-business world — a driving overworld, mission interiors, and a live franchise headquarters, currently in development.",
    sections: [
      {
        kind: "hero",
        data: {
          eyebrow: "In development",
          headline: "Highway World",
          body:
            "BOW’s interactive sports-business world: a driving overworld, mission interiors, and a live franchise headquarters. Sign up to follow development and get early access.",
          tone: "ink",
          actions: [{ label: "Join the interest list", href: "/sign-up", variant: "primary" }],
        },
      },
    ],
  },
];

/* ------------------------------------------------------------------ *
 * Tracks
 * ------------------------------------------------------------------ */

const LESSON_BEATS: SeedSection = {
  kind: "steps",
  data: {
    eyebrow: "Inside a lesson",
    headline: "Eight beats, every time.",
    tone: "paper",
    style: "grid",
    items: [
      { number: "01", label: "Cold Open", body: "A scenario that forces a position before the full economic picture is clear." },
      { number: "02", label: "The Economic Concept", body: "The core idea — scarcity, opportunity cost, incentives — defined through the problem already on the table." },
      { number: "03", label: "Front-Office Brief", body: "The facts, constraints, and what the decision requires. More information than expected. Less than wanted." },
      { number: "04", label: "Podcast Connection", body: "A BOW Sports Capital episode grounds the concept in how the sports world actually operates." },
      { number: "05", label: "The Decision", body: "You take the role. Real options, incomplete information, competing incentives. No obviously right answer.", emphasis: true },
      { number: "06", label: "The Consequence", body: "The world responds. Cash, wins, chemistry, media, and ownership pressure all shift — immediately.", emphasis: true },
      { number: "07", label: "The Debrief", body: "Review what happened, the economics behind each option, and what the decision reveals about the concept." },
      { number: "08", label: "Podcast Extension", body: "Optional: more analysis, a longer argument, a different case for students who want to push further." },
    ],
  },
};

const TRACKS: SeedTrack[] = [
  {
    slug: "track-101",
    publicTitle: "101",
    internalTitle: "Track 101",
    kicker: "Track 101 · Introductory",
    badgeLabel: "Recommended Start",
    headline: "Learn how the business of sports actually works — one decision at a time.",
    shortDescription:
      "Learn the essential ideas behind sports economics, team building, finance, and front-office decision-making.",
    longDescription:
      "Track 101 is the foundation. Students meet scarcity, opportunity cost, marginal value, incentives, constraints, and revenue tradeoffs — each one introduced through a decision they have to make, not a definition they have to memorise.",
    gradeRange: "Grades 5–6",
    audience: "Students new to economics",
    curriculumSummary: "4 modules · 12 lessons · 12 connected simulations · companion podcast episodes",
    studentExperience:
      "Most lessons take 12–18 minutes plus a simulation running another 8–15 minutes. A full lesson including the podcast extension and discussion typically fits within 45 minutes.",
    ctaLabel: "Explore Track 101",
    ctaHref: "/programs",
    seoTitle: "Track 101",
    seoDescription:
      "Learn how the business of sports actually works — one decision at a time. The introductory, recommended starting track.",
    featured: true,
    displayOrder: 1,
    publicationStatus: "published",
    sections: [
      {
        kind: "stats",
        data: {
          tone: "white",
          items: [
            { value: "4", label: "Modules" },
            { value: "12", label: "Lessons" },
            { value: "12", label: "Simulations" },
            { value: "5–6", label: "Grades" },
          ],
        },
      },
      {
        kind: "list",
        data: {
          eyebrow: "What you’ll be able to do",
          headline: "By the end, you can read the room — and the cap sheet.",
          tone: "white",
          style: "numbered",
          items: [
            "Explain what a team gives up when it makes a move",
            "Read a cap sheet and say what it constrains",
            "Weigh a short-term win against a long-term cost",
            "Argue a position using evidence from the brief",
            "Recognise the same economic idea in a setting that has nothing to do with sports",
          ],
        },
      },
      {
        kind: "feature_cards",
        data: {
          eyebrow: "What you’ll learn",
          headline: "Real economic concepts — used, not memorized.",
          tone: "paper",
          columns: 3,
          groups: [
            {
              label: "",
              cards: [
                { title: "Opportunity Cost", body: "Every yes is a no. The deal you did not make is the price of the one you did." },
                { title: "Scarcity", body: "Roster spots, cap space, and attention are all finite. Economics starts there." },
                { title: "Marginal Value", body: "What the next player, dollar, or hour is actually worth to this team." },
                { title: "Incentives", body: "People respond to the rules they are given — including the ones nobody intended." },
                { title: "Constraints", body: "The cap, the calendar, and the owner's patience all bound what is possible." },
                { title: "Revenue Tradeoffs", body: "Ticket prices, sponsorship, and media rights pull against each other." },
              ],
            },
          ],
        },
      },
      LESSON_BEATS,
      {
        kind: "cta",
        data: {
          headline: "Start with Track 101.",
          body: "See which upcoming programs run this track.",
          tone: "blue",
          actions: [
            { label: "See programs", href: "/programs", variant: "ink" },
            { label: "Join the interest list", href: "/sign-up", variant: "secondary" },
          ],
        },
      },
    ],
  },
  {
    slug: "track-201",
    publicTitle: "201",
    internalTitle: "Track 201",
    kicker: "Track 201 · Advanced",
    badgeLabel: "",
    headline: "Run the front office when every option costs you something.",
    shortDescription:
      "Apply deeper economic thinking to more complex front-office situations, competing priorities, and strategic tradeoffs.",
    longDescription:
      "Track 201 adds cap mechanics, surplus value, expected value, and negotiation. The decisions have more moving parts and fewer clean answers — the point is to defend a call, not to find the right one.",
    gradeRange: "Grades 7–8",
    audience: "Students ready for harder tradeoffs",
    curriculumSummary: "4 modules · 12 lessons · 12 connected simulations · companion podcast episodes",
    studentExperience:
      "Sessions run the same eight-beat loop as Track 101, with longer briefs, more competing incentives, and consequences that arrive over several rounds.",
    ctaLabel: "Explore Track 201",
    ctaHref: "/programs",
    seoTitle: "Track 201",
    seoDescription:
      "Run the front office: cap management, analytics, ownership, and the draft. The advanced BOW curriculum track.",
    featured: false,
    displayOrder: 2,
    publicationStatus: "published",
    sections: [
      {
        kind: "stats",
        data: {
          tone: "white",
          items: [
            { value: "4", label: "Modules" },
            { value: "12", label: "Lessons" },
            { value: "12", label: "Simulations" },
            { value: "7–8", label: "Grades" },
          ],
        },
      },
      {
        kind: "feature_cards",
        data: {
          eyebrow: "What you’ll learn",
          headline: "The economics behind the harder calls.",
          tone: "paper",
          columns: 3,
          groups: [
            {
              label: "",
              cards: [
                { title: "Cap Mechanics", body: "Aprons, exceptions, and why the rulebook shapes every roster." },
                { title: "Surplus Value", body: "What a contract is worth relative to what it costs." },
                { title: "Expected Value", body: "Deciding well under uncertainty, and judging the decision rather than the outcome." },
                { title: "Negotiation", body: "Leverage, information, and the cost of walking away." },
                { title: "Revenue Sharing", body: "A deal that helps the league can hurt you. Sign it?" },
                { title: "Long-Term Strategy", body: "Chase relevance now, or rebuild the foundation." },
              ],
            },
          ],
        },
      },
      LESSON_BEATS,
      {
        kind: "cta",
        data: {
          headline: "Step up to Track 201.",
          body: "See which upcoming programs run this track.",
          tone: "blue",
          actions: [
            { label: "See programs", href: "/programs", variant: "ink" },
            { label: "Join the interest list", href: "/sign-up", variant: "secondary" },
          ],
        },
      },
    ],
  },
  {
    slug: "track-301",
    publicTitle: "301",
    internalTitle: "Track 301",
    kicker: "Track 301 · Executive",
    badgeLabel: "In Development",
    headline: "Contract negotiation, franchise valuation, and ownership strategy.",
    shortDescription:
      "Contract negotiation, franchise valuation, and ownership strategy — the advanced track BOW is building next.",
    longDescription:
      "Track 301 is in development. It moves from running a roster to running a business: valuing a franchise, structuring a deal, and answering to an ownership group.",
    gradeRange: "In Development",
    audience: "Advanced and older students",
    curriculumSummary: "In development",
    studentExperience: "",
    ctaLabel: "Follow development",
    ctaHref: "/sign-up",
    seoTitle: "Track 301",
    seoDescription:
      "Contract negotiation, franchise valuation, and ownership strategy — the advanced BOW track currently in development.",
    featured: false,
    displayOrder: 3,
    publicationStatus: "published",
    sections: [
      {
        kind: "text",
        data: {
          eyebrow: "Status",
          headline: "Track 301 is being built.",
          body:
            "It is not yet a purchasable track. Join the interest list and we will tell you when the first cohort opens.",
          tone: "white",
        },
      },
      {
        kind: "cta",
        data: {
          headline: "Be first to know.",
          body: "Join the interest list for Track 301.",
          tone: "blue",
          actions: [{ label: "Join the interest list", href: "/sign-up", variant: "ink" }],
        },
      },
    ],
  },
];

/* ------------------------------------------------------------------ *
 * FAQs
 * ------------------------------------------------------------------ */

const FAQS: SeedFaq[] = [
  {
    question: "Who is BOW Sports Capital for?",
    answer:
      "BOW is designed for students in grades 5 through 10 (Track 101 for grades 5–6, Track 201 for grades 7–8, both adaptable for older students) who want to learn economics through sports-business decisions. It works for individual students and group settings — schools, camps, and enrichment programs.",
    placements: [{ scopeKind: "page", scopeKey: "home" }, { scopeKind: "page", scopeKey: "programs" }],
  },
  {
    question: "Do students need to know economics already?",
    answer:
      "No. BOW introduces every concept through the sports-business decisions students already care about. You encounter each idea when it matters to the problem you’re solving — not in a vacuum.",
    placements: [{ scopeKind: "page", scopeKey: "home" }, { scopeKind: "page", scopeKey: "get-involved-families" }],
  },
  {
    question: "Do students need to be sports experts?",
    answer:
      "No sports expertise required. BOW teaches through the business side of sports — contracts, salaries, stadium deals, media rights. If you’ve ever had a strong opinion about a trade or a salary, you’re already ready.",
    placements: [{ scopeKind: "page", scopeKey: "home" }, { scopeKind: "page", scopeKey: "get-involved-families" }],
  },
  {
    question: "How long is a lesson?",
    answer:
      "Most lessons take 12–18 minutes to complete, plus an optional simulation running another 8–15 minutes. Full lessons including the podcast extension and discussion typically fit within 45 minutes.",
    placements: [{ scopeKind: "page", scopeKey: "home" }, { scopeKind: "track", scopeKey: "track-101" }],
  },
  {
    question: "What is included in a track?",
    answer:
      "Each active track (101 and 201) includes 4 modules, 12 lessons, 12 connected simulations, and companion podcast episodes. Tracks are a progression, but students can enter through any individual lesson.",
    placements: [
      { scopeKind: "page", scopeKey: "home" },
      { scopeKind: "track", scopeKey: "track-101" },
      { scopeKind: "track", scopeKey: "track-201" },
    ],
  },
  {
    question: "Can BOW run a workshop for a school or camp?",
    answer:
      "Yes. BOW works with schools, camps, and enrichment programs in formats ranging from a single 90-minute workshop to multi-session semester programs. We provide curriculum, simulations, discussion prompts, and facilitation guidance.",
    placements: [{ scopeKind: "page", scopeKey: "home" }, { scopeKind: "page", scopeKey: "get-involved-schools" }],
  },
  {
    question: "Is Highway World available yet?",
    answer:
      "Highway World is currently in development. It is BOW’s interactive sports-business world — a driving overworld, mission interiors, and a live franchise headquarters. Sign up to follow development and get early access.",
    placements: [{ scopeKind: "page", scopeKey: "home" }],
  },
  {
    question: "How does the podcast connect to the lessons?",
    answer:
      "Each podcast episode connects to a specific lesson, module, and economic concept. Episodes provide the real-world sports-business context before students enter the simulation — the context that makes the decision real.",
    placements: [{ scopeKind: "page", scopeKey: "home" }],
  },
  {
    question: "Can students participate remotely?",
    answer:
      "Yes. BOW’s lessons and simulations are designed for online delivery. Individual students can work through tracks on any device, and schools and camps can run remote sessions using BOW’s facilitation guides.",
    placements: [{ scopeKind: "page", scopeKey: "home" }, { scopeKind: "page", scopeKey: "programs" }],
  },
  {
    question: "How can an organization partner with BOW?",
    answer:
      "Fill out the inquiry form on the Get Involved page and tell us about your group. We’ll reach out about formats, timing, and how to build the right program for your students.",
    placements: [{ scopeKind: "page", scopeKey: "home" }],
  },
  {
    question: "Is prior economics knowledge required?",
    answer:
      "No. BOW introduces every concept through the decision itself. Students encounter scarcity, opportunity cost, and incentives by making choices — not by reading definitions first.",
    placements: [{ scopeKind: "page", scopeKey: "get-involved-schools" }],
  },
  {
    question: "Can BOW fit into one class period?",
    answer:
      "Yes. Single-session workshops run 45–75 minutes and are designed to stand alone. Multi-session programs build across several class periods or advisory blocks.",
    placements: [{ scopeKind: "page", scopeKey: "get-involved-schools" }],
  },
  {
    question: "Can a teacher lead the program?",
    answer:
      "Yes. BOW provides curriculum, facilitation guides, discussion prompts, and case materials. A teacher-led program is fully supported. BOW can also facilitate directly.",
    placements: [{ scopeKind: "page", scopeKey: "get-involved-schools" }],
  },
  {
    question: "What technology is required?",
    answer:
      "One device shared between 2–3 students. A projector or screen helps for group facilitation. The program can also run with printed case materials.",
    placements: [
      { scopeKind: "page", scopeKey: "get-involved-schools" },
      { scopeKind: "page", scopeKey: "get-involved-camps" },
    ],
  },
  {
    question: "Can the session run indoors?",
    answer:
      "Yes. Every BOW camp session is designed for a standard indoor space — a cabin, gym, classroom, or meeting room.",
    placements: [{ scopeKind: "page", scopeKey: "get-involved-camps" }],
  },
  {
    question: "Can the same session work for different ages?",
    answer:
      "Yes. BOW cases are designed to adjust in depth. The same “You’re the GM” session can run for a 10-year-old group or a 16-year-old group with different facilitation emphasis.",
    placements: [
      { scopeKind: "page", scopeKey: "get-involved-camps" },
      { scopeKind: "page", scopeKey: "get-involved-youth-organizations" },
    ],
  },
  {
    question: "What ages is BOW for?",
    answer:
      "BOW is designed for students in grades 5 through 10, approximately ages 10–16. Track 101 targets grades 5–6. Track 201 targets grades 7–8. Both can be adapted for older or more advanced students.",
    placements: [{ scopeKind: "page", scopeKey: "get-involved-families" }],
  },
  {
    question: "Is this a game or a class?",
    answer:
      "It’s neither and both. BOW is structured economic education delivered through the experience of making a real front-office decision. Students learn by doing — not by watching.",
    placements: [{ scopeKind: "page", scopeKey: "get-involved-families" }],
  },
  {
    question: "Can our staff facilitate?",
    answer:
      "Yes. BOW provides facilitation guides and case materials for staff-led delivery. We can also provide a trained facilitator directly.",
    placements: [{ scopeKind: "page", scopeKey: "get-involved-youth-organizations" }],
  },
  {
    question: "Can the program be adapted to our group?",
    answer:
      "Yes. BOW cases are designed to be facilitated at different depths and age bands. We work with organizations to identify the right entry point for their participants.",
    placements: [{ scopeKind: "page", scopeKey: "get-involved-youth-organizations" }],
  },
  {
    question: "Is teaching with BOW a paid role?",
    answer:
      "Teaching with BOW is currently a volunteer role. We provide the curriculum, the training, and coaching against a written quality standard; you bring preparation and judgment.",
    placements: [{ scopeKind: "page", scopeKey: "teach" }],
  },
  {
    question: "Do I need a teaching background to instruct?",
    answer:
      "No. What matters is preparation, comfort leading a discussion, and a willingness to be coached. BOW trains every instructor before their first assignment.",
    placements: [{ scopeKind: "page", scopeKey: "teach" }],
  },
];

/* ------------------------------------------------------------------ *
 * Runner
 * ------------------------------------------------------------------ */

async function main(): Promise<void> {
  const sql = postgres(connectionUrl(), { prepare: false, max: 1 });
  const created = { pages: 0, tracks: 0, faqs: 0, placements: 0 };
  const skipped = { pages: 0, tracks: 0, faqs: 0 };

  try {
    const tableCheck = await sql`SELECT to_regclass('public.site_pages') AS present`;
    if (!tableCheck[0]?.present) {
      throw new Error(
        "[content] site_pages does not exist. Apply migrations first: `npm run migrate`.",
      );
    }

    /* ---- Tracks (curricula) --------------------------------------- */
    for (const track of TRACKS) {
      const existing = await sql`SELECT id FROM curricula WHERE public_slug = ${track.slug} LIMIT 1`;
      if (existing.length > 0) {
        skipped.tracks += 1;
        console.log(`[content] track ${track.slug} already exists — left untouched`);
        continue;
      }
      const trackId = id("crc");
      console.log(`[content] creating track ${track.slug}${DRY_RUN ? " (dry run)" : ""}`);
      if (DRY_RUN) continue;

      await sql.begin(async (tx) => {
        await tx`
          INSERT INTO curricula (
            id, title, description, age_range, published, created_at, updated_at,
            public_slug, public_title, public_kicker, headline, short_description, long_description,
            grade_range, audience, curriculum_summary, student_experience, badge_label,
            cta_label, cta_href, seo_title, seo_description, featured, display_order, publication_status
          ) VALUES (
            ${trackId}, ${track.internalTitle}, ${track.shortDescription}, ${track.gradeRange}, 1, ${now()}, ${now()},
            ${track.slug}, ${track.publicTitle}, ${track.kicker}, ${track.headline}, ${track.shortDescription},
            ${track.longDescription}, ${track.gradeRange}, ${track.audience}, ${track.curriculumSummary},
            ${track.studentExperience}, ${track.badgeLabel}, ${track.ctaLabel}, ${track.ctaHref},
            ${track.seoTitle}, ${track.seoDescription}, ${track.featured}, ${track.displayOrder},
            ${track.publicationStatus}
          )
        `;
        await insertDocument(tx, {
          slug: `track-${track.slug}`,
          kind: "track",
          path: `/programs/${track.slug}`,
          name: `Track page — ${track.internalTitle}`,
          entityId: trackId,
          isSystem: false,
          ordinal: track.displayOrder,
          seoTitle: track.seoTitle,
          seoDescription: track.seoDescription,
          sections: track.sections,
          publish: track.publicationStatus === "published",
        });
      });
      created.tracks += 1;
    }

    /* ---- Pages ----------------------------------------------------- */
    for (const page of [...SYSTEM_PAGES, ...PAGES]) {
      const existing = await sql`SELECT id FROM site_pages WHERE slug = ${page.slug} LIMIT 1`;
      if (existing.length > 0) {
        skipped.pages += 1;
        console.log(`[content] page ${page.slug} already exists — left untouched`);
        continue;
      }
      console.log(`[content] creating page ${page.slug}${DRY_RUN ? " (dry run)" : ""}`);
      if (DRY_RUN) continue;
      await sql.begin(async (tx) => {
        await insertDocument(tx, {
          slug: page.slug,
          kind: page.kind,
          path: page.path,
          name: page.name,
          description: page.description,
          entityId: null,
          isSystem: page.isSystem ?? false,
          ordinal: page.ordinal,
          seoTitle: page.seoTitle,
          seoDescription: page.seoDescription,
          sections: page.sections,
          publish: true,
        });
      });
      created.pages += 1;
    }

    /* ---- FAQs ------------------------------------------------------ */
    let faqOrdinal = 0;
    for (const faq of FAQS) {
      faqOrdinal += 1;
      const existing = await sql`SELECT id FROM site_faqs WHERE question = ${faq.question} LIMIT 1`;
      if (existing.length > 0) {
        skipped.faqs += 1;
        continue;
      }
      if (DRY_RUN) {
        console.log(`[content] would create FAQ "${faq.question.slice(0, 48)}…"`);
        continue;
      }
      const faqId = id("faq");
      await sql.begin(async (tx) => {
        await tx`
          INSERT INTO site_faqs (id, question, answer, status, ordinal, created_at, updated_at)
          VALUES (${faqId}, ${faq.question}, ${faq.answer}, 'published', ${faqOrdinal}, ${now()}, ${now()})
        `;
        let placementOrdinal = 0;
        for (const placement of faq.placements) {
          await tx`
            INSERT INTO site_faq_placements (id, faq_id, scope_kind, scope_key, ordinal, created_at)
            VALUES (${id("fqp")}, ${faqId}, ${placement.scopeKind}, ${placement.scopeKey}, ${placementOrdinal}, ${now()})
            ON CONFLICT (faq_id, scope_kind, scope_key) DO NOTHING
          `;
          placementOrdinal += 1;
        }
      });
      created.faqs += 1;
      created.placements += faq.placements.length;
    }

    console.log(
      `\n[content] done${DRY_RUN ? " (dry run — nothing written)" : ""}. ` +
        `created: ${created.pages} pages, ${created.tracks} tracks, ${created.faqs} FAQs ` +
        `(${created.placements} placements). left untouched: ${skipped.pages} pages, ` +
        `${skipped.tracks} tracks, ${skipped.faqs} FAQs.`,
    );
  } finally {
    await sql.end({ timeout: 5 });
  }

  /* ---- helpers -------------------------------------------------- */

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function insertDocument(tx: any, input: {
    slug: string;
    kind: string;
    path: string | null;
    name: string;
    description?: string;
    entityId: string | null;
    isSystem: boolean;
    ordinal: number;
    seoTitle?: string;
    seoDescription?: string;
    sections: SeedSection[];
    publish: boolean;
  }): Promise<void> {
    const pageId = id("spg");
    const versionId = id("spv");

    await tx`
      INSERT INTO site_pages (id, kind, slug, path, entity_id, name, description, status, is_system, ordinal, created_at, updated_at)
      VALUES (${pageId}, ${input.kind}, ${input.slug}, ${input.path}, ${input.entityId}, ${input.name},
              ${input.description ?? null}, ${input.publish ? "published" : "draft"}, ${input.isSystem},
              ${input.ordinal}, ${now()}, ${now()})
    `;
    await tx`
      INSERT INTO site_page_versions (id, page_id, version_no, state, title, seo_title, seo_description, noindex, note, created_at, published_at)
      VALUES (${versionId}, ${pageId}, 1, ${input.publish ? "published" : "draft"}, ${input.name},
              ${input.seoTitle ?? null}, ${input.seoDescription ?? null}, false,
              'Migrated from the hand-written page', ${now()}, ${input.publish ? now() : null})
    `;
    let ordinal = 0;
    for (const section of input.sections) {
      await tx`
        INSERT INTO site_page_sections (id, version_id, kind, ordinal, hidden, data, created_at, updated_at)
        VALUES (${id("sps")}, ${versionId}, ${section.kind}, ${ordinal}, false,
                ${tx.json(section.data as never)}, ${now()}, ${now()})
      `;
      ordinal += 1;
    }
    if (input.publish) {
      await tx`UPDATE site_pages SET published_version_id = ${versionId} WHERE id = ${pageId}`;
    } else {
      await tx`UPDATE site_pages SET draft_version_id = ${versionId} WHERE id = ${pageId}`;
    }
  }
}

main()
  .then(async () => {
    const { upgradeMarketingArchitecture } = await import("./upgrade-marketing-architecture");
    await upgradeMarketingArchitecture();
  })
  .catch((error) => {
    console.error("[content] failed:", error);
    process.exitCode = 1;
  });
