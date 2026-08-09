/* ============================================================
 * One-time upgrade from the original curriculum-heavy marketing site to the
 * partner-focused public information architecture.
 *
 * The architecture_version marker makes this safe to run on every deploy.
 * Version 1 pages receive a new published version. Version 2 pages, including
 * anything the owner edits afterward, are never overwritten.
 * ============================================================ */

import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

interface UpgradeSection {
  kind: string;
  data: Record<string, unknown>;
}

interface UpgradePage {
  slug: string;
  kind: "page" | "system";
  path: string | null;
  name: string;
  description: string;
  ordinal: number;
  isSystem?: boolean;
  cmsVisible: boolean;
  seoTitle: string;
  seoDescription: string;
  sections: UpgradeSection[];
}

const id = (prefix: string) => `${prefix}-${randomUUID().slice(0, 12)}`;
const now = () => Date.now();

const ORGANIZATION_DESCRIPTION =
  "BOW Sports Capital is an online program that teaches financial literacy and economics to students in Grades 5–8 through sports concepts and interactive simulations.";

const HOME: UpgradePage = {
  slug: "home",
  kind: "page",
  path: "/",
  name: "Home",
  description: "Short partner-focused overview of BOW.",
  ordinal: 1,
  cmsVisible: true,
  seoTitle: "Financial literacy and economics through sports",
  seoDescription: ORGANIZATION_DESCRIPTION,
  sections: [
    {
      kind: "hero",
      data: {
        eyebrow: "Online financial literacy · Grades 5–8",
        headline: "Economics makes more sense when sports make it real.",
        body: "BOW Sports Capital is an online program that helps middle school students learn financial literacy and economics through the business decisions behind sports.",
        note: "Designed for schools, camps, nonprofits, and youth organizations.",
        ghostText: "BOW",
        tone: "paper",
        actions: [
          { label: "Bring BOW to Your Organization", href: "/partner-with-bow", variant: "primary" },
          { label: "Explore Programs", href: "/programs", variant: "secondary" },
        ],
      },
    },
    {
      kind: "press",
      data: {
        eyebrow: "Featured in",
        headline: "BOW in the press",
        body: "Independent coverage of BOW's approach to sports-based economics.",
        tone: "white",
        emptyBody: "Verified coverage will appear here once it is published.",
      },
    },
    {
      kind: "text",
      data: {
        eyebrow: "What BOW is",
        headline: "Sports gives students a reason to care about the numbers.",
        body: "Budgets, contracts, ticket prices, trades, and draft choices are all economic decisions. BOW starts with situations students recognize, lets them work through a simulation, and then connects the result to the financial idea underneath it.",
        tone: "paper",
      },
    },
    {
      kind: "steps",
      data: {
        eyebrow: "The teaching model",
        headline: "Three steps connect the game to the lesson.",
        body: "Every BOW lesson follows the same clear path.",
        tone: "ink",
        style: "grid",
        items: [
          { number: "01", label: "Sports concept", body: "Begin with a familiar sports business situation, such as a salary cap, media deal, ticket price, trade, or draft pick.", detail: "", emphasis: false },
          { number: "02", label: "Simulation", body: "Students work through the situation, compare choices, and see how the numbers change the result.", detail: "", emphasis: true },
          { number: "03", label: "Economics behind it", body: "The group names and applies the economic idea, including incentives, scarcity, opportunity cost, risk, or market value.", detail: "", emphasis: false },
        ],
      },
    },
    {
      kind: "feature_cards",
      data: {
        eyebrow: "Inside the program",
        headline: "Real simulations from BOW classes.",
        body: "These examples come from activities already used or developed for the program.",
        tone: "raised",
        columns: 3,
        groups: [
          {
            label: "",
            cards: [
              { title: "MLB media contract", body: "Students negotiate a long-term media deal while balancing the interests of players, owners, fans, and networks.", ctaLabel: "", href: "" },
              { title: "NBA roster budget", body: "Students manage a roster, work within a budget, and decide when a star is worth the luxury-tax cost.", ctaLabel: "", href: "" },
              { title: "NFL draft risk", body: "Students weigh upside, uncertainty, and opportunity cost as they decide how to use each pick.", ctaLabel: "", href: "" },
            ],
          },
        ],
      },
    },
    {
      kind: "list",
      data: {
        eyebrow: "What students learn",
        headline: "Financial ideas hidden inside sports.",
        body: "The exact mix depends on the lesson. Examples from the BOW program include:",
        tone: "white",
        style: "chips",
        items: ["Budgets", "Incentives", "Scarcity", "Opportunity cost", "Supply and demand", "Risk", "Market value", "Contracts", "Ticket pricing", "Salary caps"],
      },
    },
    {
      kind: "feature_cards",
      data: {
        eyebrow: "Built for organizations",
        headline: "A clear online program for the students you serve.",
        body: "BOW works with organizations that want an engaging way to introduce financial literacy and economics to middle school students.",
        tone: "paper",
        columns: 4,
        groups: [
          {
            label: "",
            cards: [
              { title: "Schools", body: "Add an interactive economics experience for students in Grades 5–8.", ctaLabel: "", href: "" },
              { title: "Camps", body: "Use sports-based learning to add educational depth to a youth program.", ctaLabel: "", href: "" },
              { title: "Nonprofits", body: "Bring financial literacy into a mission-driven student program.", ctaLabel: "", href: "" },
              { title: "Youth organizations", body: "Offer a structured online experience to a community or team.", ctaLabel: "", href: "" },
            ],
          },
        ],
      },
    },
    {
      kind: "cta",
      data: {
        eyebrow: "Start a conversation",
        headline: "Bring BOW to your organization.",
        body: "Tell us who you serve and what you hope students will learn. We will talk through whether BOW is a good fit.",
        ghostText: "PARTNER",
        tone: "blue",
        actions: [{ label: "Bring BOW to Your Organization", href: "/partner-with-bow#partnership-inquiry", variant: "secondary" }],
      },
    },
  ],
};

const PROGRAMS: UpgradePage = {
  slug: "programs",
  kind: "page",
  path: "/programs",
  name: "Programs",
  description: "Verified BOW program model, learning goals, and real simulations.",
  ordinal: 2,
  cmsVisible: true,
  seoTitle: "Online economics programs for Grades 5–8",
  seoDescription: "See how BOW uses sports concepts and interactive simulations to teach financial literacy and economics to middle school students.",
  sections: [
    {
      kind: "hero",
      data: {
        eyebrow: "Programs · Grades 5–8",
        headline: "An online economics program students can step into.",
        body: "BOW uses sports business situations to help middle school students practice financial thinking, explain their choices, and understand the economic ideas behind each result.",
        note: "The established BOW course model uses six weekly online sessions with 45-minute classes.",
        ghostText: "PROGRAMS",
        tone: "paper",
        actions: [{ label: "Bring BOW to Your Organization", href: "/partner-with-bow", variant: "primary" }],
      },
    },
    {
      kind: "text",
      data: {
        eyebrow: "Program format",
        headline: "Short instruction, open discussion, and interactive practice.",
        body: "BOW has run two six-week courses on Zoom for about 30 middle school students. Each 45-minute class combined a focused explanation, group discussion, and an interactive simulation. New organizational programs are discussed directly so the audience and timing are clear before anything is promised.",
        tone: "white",
      },
    },
    {
      kind: "steps",
      data: {
        eyebrow: "How a lesson works",
        headline: "Sports concept. Simulation. Economics behind it.",
        body: "Students first recognize the situation, then test a choice, then connect what happened to a useful financial idea.",
        tone: "ink",
        style: "grid",
        items: [
          { number: "01", label: "Sports concept", body: "A real sports business question gives the class a clear starting point.", detail: "", emphasis: false },
          { number: "02", label: "Simulation", body: "Students use information, make a choice, and see its effect.", detail: "", emphasis: true },
          { number: "03", label: "Economics behind it", body: "The class explains the financial principle and where else it applies.", detail: "", emphasis: false },
        ],
      },
    },
    {
      kind: "feature_cards",
      data: {
        eyebrow: "Example activities",
        headline: "Simulations drawn from the actual BOW program.",
        body: "Examples show the range of sports situations BOW can use without promising a fixed curriculum for every group.",
        tone: "raised",
        columns: 3,
        groups: [
          {
            label: "",
            cards: [
              { title: "MLB Money Maker", body: "Negotiate a major media contract while considering several groups with different incentives.", ctaLabel: "", href: "" },
              { title: "NBA GM Crisis Manager", body: "Balance a roster budget and performance goals while responding to changing information.", ctaLabel: "", href: "" },
              { title: "Luxury tax decision", body: "Decide whether keeping a star is worth the cost of crossing a league tax line.", ctaLabel: "", href: "" },
              { title: "NFL draft", body: "Compare risk and potential value before committing a limited pick.", ctaLabel: "", href: "" },
              { title: "Trade negotiation", body: "Consider scarcity, value, and competing incentives while seeking an agreement.", ctaLabel: "", href: "" },
              { title: "Ticket pricing", body: "Explore how demand, access, revenue, and fan response affect a price decision.", ctaLabel: "", href: "" },
            ],
          },
        ],
      },
    },
    {
      kind: "list",
      data: {
        eyebrow: "Learning examples",
        headline: "Concepts students can meet through the program.",
        body: "BOW selects concepts that fit the sports situation and the age of the group.",
        tone: "paper",
        style: "chips",
        items: ["Financial literacy", "Budgets", "Incentives", "Opportunity cost", "Scarcity", "Supply and demand", "Market value", "Risk", "Contracts", "Pricing"],
      },
    },
    {
      kind: "text",
      data: {
        eyebrow: "For organizational partners",
        headline: "Start with the students, not a catalog number.",
        body: "Tell BOW about your organization, the grades you serve, and the result you want for students. BOW will discuss the fit, timing, and online format with you before defining the program.",
        tone: "white",
      },
    },
    {
      kind: "cta",
      data: {
        eyebrow: "Next step",
        headline: "Talk with BOW about your group.",
        body: "Share a few details about your organization and the students you serve.",
        ghostText: "ONLINE",
        tone: "blue",
        actions: [{ label: "Bring BOW to Your Organization", href: "/partner-with-bow#partnership-inquiry", variant: "secondary" }],
      },
    },
  ],
};

const PARTNER: UpgradePage = {
  slug: "partner-with-bow",
  kind: "page",
  path: "/partner-with-bow",
  name: "Partner With BOW",
  description: "Who BOW works with, what the program provides, and how to start.",
  ordinal: 3,
  cmsVisible: true,
  seoTitle: "Bring BOW to your organization",
  seoDescription: "Partner with BOW to bring an online sports-based financial literacy and economics program to students in Grades 5–8.",
  sections: [
    {
      kind: "hero",
      data: {
        eyebrow: "Partner with BOW",
        headline: "Bring sports-based economics to the students you serve.",
        body: "BOW works with schools, camps, nonprofits, and youth or community organizations that want an engaging online financial literacy experience for students in Grades 5–8.",
        note: "Start with a conversation about your group, goals, and timing.",
        ghostText: "PARTNER",
        tone: "paper",
        actions: [{ label: "Bring BOW to Your Organization", href: "#partnership-inquiry", variant: "primary" }],
      },
    },
    {
      kind: "feature_cards",
      data: {
        eyebrow: "Who BOW works with",
        headline: "Organizations that already bring young people together.",
        body: "BOW is designed for organizational partners serving middle school students.",
        tone: "white",
        columns: 4,
        groups: [
          { label: "", cards: [
            { title: "Schools", body: "For student groups looking for an applied introduction to economics and financial literacy.", ctaLabel: "", href: "" },
            { title: "Camps", body: "For youth programs that want to combine sports interest with structured learning.", ctaLabel: "", href: "" },
            { title: "Nonprofits", body: "For mission-driven programs expanding access to useful financial ideas.", ctaLabel: "", href: "" },
            { title: "Youth and community organizations", body: "For leagues, clubs, and community groups serving students in Grades 5–8.", ctaLabel: "", href: "" },
          ] },
        ],
      },
    },
    {
      kind: "feature_cards",
      data: {
        eyebrow: "What BOW provides",
        headline: "The pieces needed to run a clear online learning experience.",
        body: "The exact program is confirmed with each organization before launch.",
        tone: "raised",
        columns: 4,
        groups: [
          { label: "", cards: [
            { title: "Lesson sequence", body: "A structured path from a sports concept to a financial or economic idea.", ctaLabel: "", href: "" },
            { title: "Interactive simulations", body: "Activities that ask students to work with information and make a meaningful choice.", ctaLabel: "", href: "" },
            { title: "Online instruction", body: "Live facilitation that keeps the discussion clear, active, and age-appropriate.", ctaLabel: "", href: "" },
            { title: "Program planning", body: "A direct conversation about the audience, goals, timing, and responsibilities before launch.", ctaLabel: "", href: "" },
          ] },
        ],
      },
    },
    {
      kind: "steps",
      data: {
        eyebrow: "A simple process",
        headline: "From first conversation to program launch.",
        body: "Each step confirms the fit before the next one begins.",
        tone: "ink",
        style: "grid",
        items: [
          { number: "01", label: "Tell us about your organization", body: "Share who you serve, the grades involved, and what you want students to gain.", detail: "", emphasis: false },
          { number: "02", label: "Discuss the fit", body: "Talk through the online format, likely group size, timing, and the sports interests of the students.", detail: "", emphasis: false },
          { number: "03", label: "Confirm the program", body: "Agree on the program plan, point people, and practical next steps.", detail: "", emphasis: true },
          { number: "04", label: "Launch", body: "Students join the program and begin with a sports concept they can immediately explore.", detail: "", emphasis: false },
        ],
      },
    },
  ],
};

const ABOUT: UpgradePage = {
  slug: "about",
  kind: "page",
  path: "/about",
  name: "About",
  description: "Concise explanation of BOW's purpose and approach.",
  ordinal: 4,
  cmsVisible: true,
  seoTitle: "About BOW Sports Capital",
  seoDescription: "BOW helps middle school students understand financial literacy and economics through sports concepts and interactive simulations.",
  sections: [
    {
      kind: "hero",
      data: {
        eyebrow: "About BOW",
        headline: "Sports is the starting point. Financial understanding is the goal.",
        body: "BOW Sports Capital was created to make economics more engaging for middle school students by connecting it to the business of sports.",
        note: "Online learning for students in Grades 5–8.",
        ghostText: "ABOUT",
        tone: "paper",
        actions: [{ label: "See the Program Model", href: "/programs", variant: "primary" }],
      },
    },
    {
      kind: "text",
      data: {
        eyebrow: "Why BOW exists",
        headline: "Abstract ideas become clearer when students can see the choice.",
        body: "A salary cap can introduce a budget constraint. A draft pick can introduce risk and opportunity cost. A ticket price can introduce supply and demand. BOW turns those connections into structured lessons and interactive simulations so students can reason through the idea instead of only memorizing a definition.",
        tone: "white",
      },
    },
    {
      kind: "feature_cards",
      data: {
        eyebrow: "What guides the program",
        headline: "Clear, active, and useful learning.",
        body: "BOW keeps the sports identity while making the economic idea easy to name and apply.",
        tone: "raised",
        columns: 3,
        groups: [
          { label: "", cards: [
            { title: "Clear", body: "Plain language and a focused question help students understand what they are solving.", ctaLabel: "", href: "" },
            { title: "Active", body: "Students work through information, compare choices, and explain their reasoning.", ctaLabel: "", href: "" },
            { title: "Useful", body: "Each sports example leads to a financial concept students can recognize beyond the game.", ctaLabel: "", href: "" },
          ] },
        ],
      },
    },
    {
      kind: "cta",
      data: {
        eyebrow: "Work with BOW",
        headline: "Bring the program to your students.",
        body: "Start with a simple conversation about your organization and the students you serve.",
        ghostText: "BOW",
        tone: "blue",
        actions: [{ label: "Bring BOW to Your Organization", href: "/partner-with-bow#partnership-inquiry", variant: "secondary" }],
      },
    },
  ],
};

const TEACH: UpgradePage = {
  slug: "teach",
  kind: "page",
  path: "/teach",
  name: "Teach",
  description: "Clear explanation of the current volunteer instructor role.",
  ordinal: 5,
  cmsVisible: true,
  seoTitle: "Teach with BOW Sports Capital",
  seoDescription: "Apply for the current volunteer instructor role and help middle school students learn economics through sports.",
  sections: [
    {
      kind: "hero",
      data: {
        eyebrow: "Teach with BOW",
        headline: "Help students connect sports to financial thinking.",
        body: "BOW instructors prepare a structured lesson, guide an online discussion, and help students explain the economic idea inside a sports simulation.",
        note: "Teaching with BOW is currently a volunteer role.",
        ghostText: "TEACH",
        tone: "paper",
        actions: [{ label: "Apply to Teach", href: "/join/sports-economics-instructor", variant: "primary" }],
      },
    },
    {
      kind: "feature_cards",
      data: {
        eyebrow: "The role",
        headline: "Prepare, facilitate, and help students make the connection.",
        body: "You do not need a formal teaching background. You do need preparation, comfort leading a discussion, and a willingness to be coached.",
        tone: "white",
        columns: 3,
        groups: [
          { label: "", cards: [
            { title: "Prepare the lesson", body: "Understand the sports situation, simulation, and economic concept before class.", ctaLabel: "", href: "" },
            { title: "Lead the discussion", body: "Ask clear questions and make space for students to explain different choices.", ctaLabel: "", href: "" },
            { title: "Connect the result", body: "Help students name the financial idea and recognize where else it applies.", ctaLabel: "", href: "" },
          ] },
        ],
      },
    },
    {
      kind: "steps",
      data: {
        eyebrow: "How to join",
        headline: "A clear path to your first class.",
        body: "BOW reviews the fit before assigning any teaching responsibility.",
        tone: "ink",
        style: "grid",
        items: [
          { number: "01", label: "Apply", body: "Tell BOW about your experience, interests, and availability.", detail: "", emphasis: false },
          { number: "02", label: "Talk with BOW", body: "Discuss the role, expectations, and whether the current opportunity is a fit.", detail: "", emphasis: false },
          { number: "03", label: "Train and prepare", body: "Learn the lesson structure and practice facilitating the simulation.", detail: "", emphasis: true },
          { number: "04", label: "Teach", body: "Lead the online session with support and a clear plan.", detail: "", emphasis: false },
        ],
      },
    },
    {
      kind: "cta",
      data: {
        eyebrow: "Instructor application",
        headline: "Interested in teaching with BOW?",
        body: "Read the current opening and submit an application for that role.",
        ghostText: "APPLY",
        tone: "blue",
        actions: [{ label: "Apply to Teach", href: "/join/sports-economics-instructor", variant: "secondary" }],
      },
    },
  ],
};

const CONTACT: UpgradePage = {
  slug: "contact",
  kind: "page",
  path: "/contact",
  name: "Contact",
  description: "General contact page for questions outside the partner inquiry.",
  ordinal: 6,
  cmsVisible: true,
  seoTitle: "Contact BOW Sports Capital",
  seoDescription: "Contact BOW Sports Capital with a general question or use the partner form to discuss a program for your organization.",
  sections: [
    {
      kind: "hero",
      data: {
        eyebrow: "Contact",
        headline: "Have a question for BOW?",
        body: "Use the partner page if you want to bring BOW to an organization. For a general question, contact BOW directly.",
        note: "",
        ghostText: "CONTACT",
        tone: "paper",
        actions: [{ label: "Partner With BOW", href: "/partner-with-bow", variant: "primary" }],
      },
    },
    {
      kind: "contact",
      data: {
        eyebrow: "General questions",
        headline: "Contact BOW Sports Capital",
        body: "Email is the clearest way to reach the BOW team.",
        tone: "white",
        email: "hello@bowsportscapital.com",
        phone: "",
        location: "",
        formIntro: "",
        showForm: true,
      },
    },
  ],
};

const PODCAST: UpgradePage = {
  slug: "podcast",
  kind: "page",
  path: "/podcast",
  name: "Podcast",
  description: "Honest holding page until complete playable audio exists.",
  ordinal: 20,
  cmsVisible: false,
  seoTitle: "BOW podcast",
  seoDescription: "BOW does not currently publish complete playable podcast episodes.",
  sections: [
    {
      kind: "hero",
      data: {
        eyebrow: "Podcast",
        headline: "Complete podcast episodes are not live yet.",
        body: "BOW does not currently publish playable full-length episodes. When complete audio is available, this page can be updated and added back to the main navigation.",
        note: "No episode list is shown until the audio is real and playable.",
        ghostText: "AUDIO",
        tone: "paper",
        actions: [{ label: "Explore the Programs", href: "/programs", variant: "primary" }],
      },
    },
  ],
};

const SETTINGS: UpgradePage = {
  slug: "system-settings",
  kind: "system",
  path: null,
  name: "Global Settings",
  description: "Content that appears across the whole site.",
  ordinal: 1,
  isSystem: true,
  cmsVisible: true,
  seoTitle: "Global Settings",
  seoDescription: ORGANIZATION_DESCRIPTION,
  sections: [
    {
      kind: "global_settings",
      data: {
        organizationName: "BOW Sports Capital",
        organizationDescription: ORGANIZATION_DESCRIPTION,
        primaryAnnouncement: "",
        primaryAnnouncementHref: "",
        defaultSocialImage: "/bow-social-preview.png",
        supportEmail: "hello@bowsportscapital.com",
        defaultRegistrationExplanation: "Registration details are shown only after a real program is published and ready to accept students.",
        defaultInterestListExplanation: "Share your email to hear when a real BOW program becomes available.",
        defaultEmptyStateText: "No public program is open right now. Organizations can contact BOW to discuss a program for their students.",
        seoTitlePattern: "%s · BOW Sports Capital",
        defaultSeoTitle: "BOW Sports Capital · Financial literacy through sports",
        defaultSeoDescription: ORGANIZATION_DESCRIPTION,
        primaryCtaLabel: "Bring BOW to Your Organization",
        primaryCtaHref: "/partner-with-bow",
        contactEmail: "hello@bowsportscapital.com",
        contactPhone: "",
        contactLocation: "",
      },
    },
  ],
};

const NAVIGATION: UpgradePage = {
  slug: "system-navigation",
  kind: "system",
  path: null,
  name: "Navigation",
  description: "The links and button in the top bar.",
  ordinal: 2,
  isSystem: true,
  cmsVisible: true,
  seoTitle: "Navigation",
  seoDescription: "Primary site navigation.",
  sections: [
    {
      kind: "nav_menu",
      data: {
        items: [
          { label: "Home", href: "/", visible: true, children: [] },
          { label: "Programs", href: "/programs", visible: true, children: [] },
          { label: "Partner With BOW", href: "/partner-with-bow", visible: true, children: [] },
          { label: "About", href: "/about", visible: true, children: [] },
          { label: "Teach", href: "/teach", visible: true, children: [] },
        ],
        signInLabel: "Sign In",
        signInHref: "/sign-in",
        primaryCtaLabel: "Bring BOW to Your Organization",
        primaryCtaHref: "/partner-with-bow",
        secondaryCtaLabel: "Explore Programs",
        secondaryCtaHref: "/programs",
      },
    },
  ],
};

const FOOTER: UpgradePage = {
  slug: "system-footer",
  kind: "system",
  path: null,
  name: "Footer",
  description: "Footer description, useful links, and contact information.",
  ordinal: 3,
  isSystem: true,
  cmsVisible: true,
  seoTitle: "Footer",
  seoDescription: "Shared site footer.",
  sections: [
    {
      kind: "footer_columns",
      data: {
        tagline: "Sports-based financial literacy",
        description: "An online program that teaches financial literacy and economics to students in Grades 5–8 through sports concepts and interactive simulations.",
        contactText: "hello@bowsportscapital.com",
        columns: [
          { heading: "Program", links: [
            { label: "Programs", href: "/programs" },
            { label: "Partner With BOW", href: "/partner-with-bow" },
          ] },
          { heading: "BOW", links: [
            { label: "About", href: "/about" },
            { label: "Teach", href: "/teach" },
            { label: "Contact", href: "/contact" },
          ] },
          { heading: "Account", links: [{ label: "Sign In", href: "/sign-in" }] },
        ],
        socialLinks: [],
        legalLinks: [],
        baseNote: "SPORTS CONCEPT · SIMULATION · ECONOMICS BEHIND IT",
      },
    },
  ],
};

const UPGRADE_PAGES: UpgradePage[] = [SETTINGS, NAVIGATION, FOOTER, HOME, PROGRAMS, PARTNER, ABOUT, TEACH, CONTACT, PODCAST];

const ARCHIVE_SLUGS = [
  "programs-find",
  "get-involved",
  "get-involved-families",
  "get-involved-schools",
  "get-involved-camps",
  "get-involved-youth-organizations",
  "get-involved-partners",
  "get-involved-partner-inquiry",
  "news",
];

const HIDE_FROM_PRIMARY_CMS = [
  "programs-register",
  "glossary",
  "standards",
  "concept-map",
  "simulation",
  "highway-world",
];

const VERIFIED_PUBLICATIONS = [
  {
    id: "pub-jewish-link",
    name: "The Jewish Link",
    articleTitle: "New Simulation Program Helps Middle Schoolers Understand the Economics Behind Sports",
    articleUrl: "https://jewishlink.news/new-simulation-program-helps-middle-schoolers-understand-the-economics-behind-sports/",
    publicationDate: "2026-06-11",
  },
  {
    id: "pub-jewish-standard",
    name: "The Jewish Standard",
    articleTitle: "Sports, and math, and business, oh my!",
    articleUrl: "https://jewishstandard.timesofisrael.com/sports-and-math-and-business-oh-my/amp/",
    publicationDate: "2026-06-18",
  },
  {
    id: "pub-yonkers-times",
    name: "Yonkers Times",
    articleTitle: "Local Student Uses Sports Business to Make Economics More Engaging",
    articleUrl: "https://yonkerstimes.com/local-student-uses-sports-business-to-make-economics-more-engaging/",
    publicationDate: "2026-06-19",
  },
] as const;

function connectionUrl(): string {
  const value = (
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    ""
  ).trim();
  if (!value) throw new Error("[content] Missing the configured Postgres URL.");
  return value;
}

export async function upgradeMarketingArchitecture(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const sql = postgres(connectionUrl(), { prepare: false, max: 1 });
  let upgraded = 0;
  let skipped = 0;

  try {
    for (const page of UPGRADE_PAGES) {
      const rows = await sql`
        SELECT id, architecture_version, published_version_id, draft_version_id
          FROM site_pages WHERE slug = ${page.slug} LIMIT 1
      `;
      const existing = rows[0];

      if (existing && Number(existing.architecture_version) >= 2) {
        skipped += 1;
        continue;
      }
      if (existing?.draft_version_id) {
        skipped += 1;
        console.log(`[content] ${page.slug} has an owner draft; architecture upgrade left it untouched`);
        continue;
      }

      console.log(`[content] upgrading ${page.slug}${dryRun ? " (dry run)" : ""}`);
      if (dryRun) {
        upgraded += 1;
        continue;
      }

      await sql.begin(async (tx) => {
        const pageId = existing ? String(existing.id) : id("spg");
        let versionNo = 1;
        if (existing) {
          const maxRows = await tx`SELECT COALESCE(MAX(version_no), 0) AS n FROM site_page_versions WHERE page_id = ${pageId}`;
          versionNo = (Number(maxRows[0]?.n) || 0) + 1;
          if (existing.published_version_id) {
            await tx`UPDATE site_page_versions SET state = 'superseded' WHERE id = ${existing.published_version_id}`;
          }
        } else {
          await tx`
            INSERT INTO site_pages (
              id, kind, slug, path, name, description, status, is_system, ordinal,
              architecture_version, cms_visible, created_at, updated_at
            ) VALUES (
              ${pageId}, ${page.kind}, ${page.slug}, ${page.path}, ${page.name}, ${page.description},
              'published', ${page.isSystem ?? false}, ${page.ordinal}, 2, ${page.cmsVisible}, ${now()}, ${now()}
            )
          `;
        }

        const versionId = id("spv");
        await tx`
          INSERT INTO site_page_versions (
            id, page_id, version_no, state, title, seo_title, seo_description,
            noindex, note, created_at, published_at
          ) VALUES (
            ${versionId}, ${pageId}, ${versionNo}, 'published', ${page.name}, ${page.seoTitle},
            ${page.seoDescription}, false, 'Partner-focused marketing architecture', ${now()}, ${now()}
          )
        `;

        for (let ordinal = 0; ordinal < page.sections.length; ordinal += 1) {
          const section = page.sections[ordinal];
          await tx`
            INSERT INTO site_page_sections (id, version_id, kind, ordinal, hidden, data, created_at, updated_at)
            VALUES (${id("sps")}, ${versionId}, ${section.kind}, ${ordinal}, false,
                    ${tx.json(section.data as never)}, ${now()}, ${now()})
          `;
        }

        await tx`
          UPDATE site_pages
             SET kind = ${page.kind}, path = ${page.path}, name = ${page.name}, description = ${page.description},
                 status = 'published', published_version_id = ${versionId}, draft_version_id = NULL,
                 is_system = ${page.isSystem ?? false}, ordinal = ${page.ordinal},
                 architecture_version = 2, cms_visible = ${page.cmsVisible}, updated_at = ${now()}
           WHERE id = ${pageId}
        `;
      });
      upgraded += 1;
    }

    if (!dryRun) {
      await sql.begin(async (tx) => {
        await tx`UPDATE site_pages SET status = 'archived', cms_visible = false, architecture_version = 2, updated_at = ${now()} WHERE slug IN ${tx(ARCHIVE_SLUGS)}`;
        await tx`UPDATE site_pages SET cms_visible = false, architecture_version = 2, updated_at = ${now()} WHERE slug IN ${tx(HIDE_FROM_PRIMARY_CMS)}`;
        await tx`UPDATE site_pages SET status = 'archived', cms_visible = false, architecture_version = 2, updated_at = ${now()} WHERE kind = 'track'`;
        await tx`UPDATE curricula SET publication_status = 'archived', updated_at = ${now()} WHERE public_slug IS NOT NULL`;
      });

      let ordinal = 0;
      for (const publication of VERIFIED_PUBLICATIONS) {
        await sql`
          INSERT INTO site_publications (
            id, name, logo_url, article_title, article_url, publication_date,
            status, ordinal, created_at, updated_at
          ) VALUES (
            ${publication.id}, ${publication.name}, NULL, ${publication.articleTitle}, ${publication.articleUrl},
            ${publication.publicationDate}, 'published', ${ordinal}, ${now()}, ${now()}
          )
          ON CONFLICT (article_url) DO NOTHING
        `;
        ordinal += 1;
      }
    }

    console.log(`[content] partner architecture complete: ${upgraded} upgraded, ${skipped} already current or protected`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}
