/* ============================================================
 * One-time upgrade from the original curriculum-heavy marketing site to the
 * partner-focused public information architecture.
 *
 * The architecture_version marker and the published section signature make
 * this safe to run on every deploy. A marker alone is not trusted because a
 * partially completed upgrade can leave version-1 content live. Pages whose
 * published structure is already current, including owner-edited pages, are
 * never overwritten.
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

export const MARKETING_ARCHITECTURE_VERSION = 3;

const ORGANIZATION_DESCRIPTION =
  "BOW Sports Capital helps students in Grades 5 to 8 learn economics and financial literacy through sports, simulations, and guided discussion.";

const HOME: UpgradePage = {
  slug: "home",
  kind: "page",
  path: "/",
  name: "Home",
  description: "A concise overview of BOW Sports Capital.",
  ordinal: 1,
  cmsVisible: true,
  seoTitle: "BOW Sports Capital | Economics and Financial Literacy Through Sports",
  seoDescription: ORGANIZATION_DESCRIPTION,
  sections: [
    {
      kind: "hero",
      data: {
        eyebrow: "",
        headline: "Economics, taught through sports.",
        body: "BOW Sports Capital is a live online program for students in Grades 5 to 8. Students learn financial literacy and economics through sports business, guided simulations, and discussion.",
        note: "",
        ghostText: "",
        tone: "paper",
        actions: [
          { label: "Bring BOW to Your Organization", href: "/partner-with-bow", variant: "primary" },
          { label: "View Classes", href: "/programs", variant: "secondary" },
        ],
      },
    },
    {
      kind: "press",
      data: {
        eyebrow: "",
        headline: "Featured in",
        body: "",
        tone: "white",
        emptyBody: "Verified coverage will appear here once it is published.",
      },
    },
    {
      kind: "text",
      data: {
        eyebrow: "",
        headline: "A more concrete way to learn economics",
        body: "Many economic ideas are easier to understand when students can see the decision in front of them.\n\nA roster has a budget. A player has a market value. Spending more in one area leaves less available somewhere else.\n\nBOW uses situations like these to introduce the economics behind them.",
        tone: "paper",
      },
    },
    {
      kind: "steps",
      data: {
        eyebrow: "",
        headline: "How a BOW lesson works",
        body: "",
        tone: "ink",
        style: "grid",
        items: [
          { number: "01", label: "Learn the sports concept", body: "Students first understand the situation, the rules, and the decision in front of them.", detail: "", emphasis: false },
          { number: "02", label: "Use it in a simulation", body: "They work through the problem and make their own choice.", detail: "", emphasis: true },
          { number: "03", label: "Study the economics", body: "The class then examines the financial or economic concept behind what happened.", detail: "", emphasis: false },
        ],
      },
    },
    {
      kind: "image_text",
      data: {
        eyebrow: "",
        headline: "Built around active participation",
        body: "BOW classes combine instruction, discussion, and interactive simulations.\n\nStudents may work with a roster budget, compare player value, respond to changing information, or decide how limited resources should be used.",
        tone: "raised",
        imageUrl: "",
        imageAlt: "",
        imagePosition: "right",
        bullets: [],
        actions: [{ label: "Explore Programs", href: "/programs", variant: "primary" }],
      },
    },
    {
      kind: "list",
      data: {
        eyebrow: "",
        headline: "Economics students can see",
        body: "Depending on the program, students work with concepts including:",
        tone: "white",
        style: "chips",
        items: ["Opportunity cost", "Incentives", "Supply and demand", "Risk", "Budgets", "Value", "Tradeoffs"],
      },
    },
    {
      kind: "cta",
      data: {
        eyebrow: "",
        headline: "Bring BOW to your students",
        body: "BOW works with schools, camps, nonprofits, and youth organizations serving students in Grades 5 to 8.\n\nWe work with partners on the program format, schedule, and delivery.",
        tone: "paper",
        ghostText: "",
        actions: [{ label: "Partner With BOW", href: "/partner-with-bow", variant: "primary" }],
      },
    },
    {
      kind: "cta",
      data: {
        eyebrow: "",
        headline: "Looking for a class?",
        body: "Families can view BOW classes that are currently open for registration.",
        ghostText: "",
        tone: "white",
        actions: [{ label: "View Classes", href: "/programs", variant: "primary" }],
      },
    },
    {
      kind: "cta",
      data: {
        eyebrow: "",
        headline: "Bring BOW to your organization",
        body: "Tell us about your students and what you're looking for.",
        ghostText: "",
        tone: "blue",
        actions: [{ label: "Get Started", href: "/partner-with-bow#partnership-inquiry", variant: "secondary" }],
      },
    },
  ],
};

const PROGRAMS: UpgradePage = {
  slug: "programs",
  kind: "page",
  path: "/programs",
  name: "Programs",
  description: "Current BOW classes open to families.",
  ordinal: 2,
  cmsVisible: true,
  seoTitle: "BOW Programs | Online Economics Programs for Grades 5 to 8",
  seoDescription: "Explore current BOW Sports Capital classes for students in Grades 5 to 8 and register for an available online program.",
  sections: [
    {
      kind: "hero",
      data: {
        eyebrow: "",
        headline: "Programs for Grades 5 to 8",
        body: "View BOW classes currently available to families, including dates, schedules, grade levels, and registration.",
        note: "",
        ghostText: "",
        tone: "paper",
        actions: [],
      },
    },
    {
      kind: "program_collection",
      data: {
        eyebrow: "",
        headline: "Classes open for registration",
        body: "",
        tone: "white",
        limit: 0,
        featuredOnly: false,
        programSlugs: [],
        showAllLabel: "",
        showAllHref: "",
        hideWhenEmpty: false,
        emptyHeadline: "No public classes are open right now",
        emptyBody: "Join the interest list and we'll contact you when a relevant BOW program becomes available.",
        emptyActionLabel: "Join the Interest List",
        emptyActionHref: "/sign-up",
      },
    },
    {
      kind: "text",
      data: {
        eyebrow: "",
        headline: "What happens in class",
        body: "BOW classes are instructor-led.\n\nStudents learn the sports context, work through a simulation or activity, and discuss the economics behind their choices.",
        tone: "paper",
      },
    },
    {
      kind: "cta",
      data: {
        eyebrow: "",
        headline: "Planning a program for a group?",
        body: "Schools, camps, nonprofits, and youth organizations can work directly with BOW.",
        ghostText: "",
        tone: "blue",
        actions: [{ label: "Partner With BOW", href: "/partner-with-bow", variant: "secondary" }],
      },
    },
  ],
};

const PARTNER: UpgradePage = {
  slug: "partner-with-bow",
  kind: "page",
  path: "/partner-with-bow",
  name: "Partner With BOW",
  description: "Information for schools, camps, and youth organizations considering BOW.",
  ordinal: 3,
  cmsVisible: true,
  seoTitle: "Partner With BOW | Programs for Schools, Camps and Youth Organizations",
  seoDescription: "Bring BOW Sports Capital to your school, camp, nonprofit, or youth organization and give students in Grades 5 to 8 a sports-based way to learn economics and financial literacy.",
  sections: [
    {
      kind: "hero",
      data: {
        eyebrow: "",
        headline: "Bring BOW to your organization",
        body: "BOW offers live economics and financial literacy programming for students in Grades 5 to 8, taught through the business of sports.",
        note: "",
        ghostText: "",
        tone: "paper",
        actions: [{ label: "Discuss a Program", href: "#partnership-inquiry", variant: "primary" }],
      },
    },
    {
      kind: "list",
      data: {
        eyebrow: "",
        headline: "Who we work with",
        body: "BOW works with organizations serving students in Grades 5 to 8, including:",
        tone: "white",
        style: "chips",
        items: ["Schools", "Camps", "Nonprofits", "Youth organizations", "Community programs"],
      },
    },
    {
      kind: "feature_cards",
      data: {
        eyebrow: "",
        headline: "What BOW provides",
        body: "",
        tone: "raised",
        columns: 4,
        groups: [
          { label: "", cards: [
            { title: "Curriculum", body: "Structured lessons that connect sports business to economics and financial literacy.", ctaLabel: "", href: "" },
            { title: "Simulations and activities", body: "Interactive experiences that give students a problem to work through, not just information to remember.", ctaLabel: "", href: "" },
            { title: "Program structure", body: "A defined learning experience designed for students in Grades 5 to 8.", ctaLabel: "", href: "" },
            { title: "Delivery support", body: "We work with each partner on scheduling, instruction, and the details required to run the program.", ctaLabel: "", href: "" },
          ] },
        ],
      },
    },
    {
      kind: "list",
      data: {
        eyebrow: "",
        headline: "What we plan with you",
        body: "Before a program begins, we'll confirm:",
        tone: "paper",
        style: "rows",
        items: ["Student group and grade levels", "Program format", "Schedule", "Expected enrollment", "Registration and communication process", "Any organization-specific logistics"],
      },
    },
    {
      kind: "steps",
      data: {
        eyebrow: "",
        headline: "How partnership works",
        body: "",
        tone: "ink",
        style: "grid",
        items: [
          { number: "01", label: "Tell us about your organization", body: "Share the basics about your students and what you're looking for.", detail: "", emphasis: false },
          { number: "02", label: "Plan the program", body: "We'll determine the appropriate format, schedule, and delivery approach.", detail: "", emphasis: false },
          { number: "03", label: "Confirm the details", body: "We finalize the dates, registration process, and program logistics.", detail: "", emphasis: true },
          { number: "04", label: "Begin the program", body: "Students join the scheduled BOW experience.", detail: "", emphasis: false },
        ],
      },
    },
    {
      kind: "cta",
      data: {
        eyebrow: "",
        headline: "Interested in bringing BOW to your students?",
        body: "Tell us about your organization. We'll follow up to discuss fit and next steps.",
        ghostText: "",
        tone: "blue",
        actions: [{ label: "Partner With BOW", href: "#partnership-inquiry", variant: "secondary" }],
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
  seoDescription: "BOW Sports Capital was built around a simple idea: students already think about economics when they talk about sports, even if they don't call it economics yet.",
  sections: [
    {
      kind: "hero",
      data: {
        eyebrow: "",
        headline: "Why sports?",
        body: "Sports gives students a familiar way to encounter economic ideas that can otherwise feel abstract.",
        note: "",
        ghostText: "",
        tone: "paper",
        actions: [],
      },
    },
    {
      kind: "text",
      data: {
        eyebrow: "",
        headline: "Economics is already part of the game",
        body: "Teams operate with limited resources.\n\nPlayers have changing market values.\n\nContracts involve risk.\n\nEvery roster decision has a cost.\n\nThese are sports questions, but they're also economic questions.\n\nBOW was created around the idea that students can understand economics more naturally when they first encounter it in a setting they already recognize.",
        tone: "white",
      },
    },
    {
      kind: "text",
      data: {
        eyebrow: "",
        headline: "Understand the decision before the definition",
        body: "BOW does not start by asking students to memorize terminology.\n\nStudents first work with a concrete situation. Once they understand the problem and make a choice, the class connects that experience to the economic concept behind it.\n\nThe goal is understanding, not vocabulary for its own sake.",
        tone: "raised",
      },
    },
    {
      kind: "cta",
      data: {
        eyebrow: "",
        headline: "A practical introduction to economics",
        body: "BOW is designed for students in Grades 5 to 8 who may be encountering many of these ideas for the first time.\n\nSports makes the context familiar. The economics is the lesson.",
        ghostText: "",
        tone: "blue",
        actions: [{ label: "Explore Programs", href: "/programs", variant: "secondary" }],
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
  seoTitle: "Teach With BOW Sports Capital",
  seoDescription: "Apply to teach BOW Sports Capital and help students in Grades 5 to 8 learn economics and financial literacy through sports.",
  sections: [
    {
      kind: "hero",
      data: {
        eyebrow: "Teach with BOW",
        headline: "Teach with BOW",
        body: "Lead live BOW classes for students in Grades 5 to 8 using prepared curriculum, simulations, and discussion.",
        note: "",
        ghostText: "",
        tone: "paper",
        actions: [{ label: "Apply to Teach", href: "/join/sports-economics-instructor", variant: "primary" }],
      },
    },
    {
      kind: "list",
      data: {
        eyebrow: "",
        headline: "What instructors do",
        body: "BOW instructors lead students through each lesson from beginning to end.\n\nThat includes:",
        tone: "white",
        style: "rows",
        items: ["Preparing with BOW curriculum and materials", "Teaching the sports context", "Guiding simulations and activities", "Leading discussion", "Explaining the economics behind the lesson", "Keeping students engaged and involved"],
      },
    },
    {
      kind: "list",
      data: {
        eyebrow: "",
        headline: "What BOW provides",
        body: "You won't create a course from scratch.\n\nBOW provides:",
        tone: "paper",
        style: "rows",
        items: ["Curriculum", "Lesson materials", "Simulations and activities", "Instructor training", "Ongoing guidance"],
      },
    },
    {
      kind: "text",
      data: {
        eyebrow: "",
        headline: "Who we're looking for",
        body: "Strong instructors can explain ideas clearly, lead a group, prepare consistently, and work well with younger students.\n\nAn interest in sports, economics, finance, business, or education is useful. Reliability matters more than trying to sound like an expert.",
        tone: "white",
      },
    },
    {
      kind: "text",
      data: {
        eyebrow: "",
        headline: "The commitment",
        body: "Teaching with BOW is a volunteer role.\n\nInstructors complete training before teaching and receive the schedule for a program before accepting an assignment.",
        tone: "raised",
      },
    },
    {
      kind: "steps",
      data: {
        eyebrow: "",
        headline: "How to apply",
        body: "",
        tone: "ink",
        style: "grid",
        items: [
          { number: "01", label: "Apply", body: "Complete the instructor application.", detail: "", emphasis: false },
          { number: "02", label: "Interview", body: "Speak with the BOW team about the role and your experience.", detail: "", emphasis: false },
          { number: "03", label: "Train", body: "Learn the curriculum and BOW teaching format.", detail: "", emphasis: true },
          { number: "04", label: "Teach", body: "Join a program when an appropriate assignment is available.", detail: "", emphasis: false },
        ],
      },
    },
    {
      kind: "cta",
      data: {
        eyebrow: "",
        headline: "",
        body: "",
        ghostText: "",
        tone: "blue",
        actions: [{ label: "Start Your Application", href: "/join/sports-economics-instructor", variant: "secondary" }],
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
        headline: "Contact BOW",
        body: "For general questions, contact BOW directly.\n\nOrganizations can visit Partner With BOW. Families can visit Programs. Instructor candidates can visit Teach.",
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
        body: "Use the form below for a general inquiry.",
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
        defaultRegistrationExplanation: "",
        defaultInterestListExplanation: "Join the interest list and we'll contact you when a relevant BOW program becomes available.",
        defaultEmptyStateText: "Join the interest list and we'll contact you when a relevant BOW program becomes available.",
        seoTitlePattern: "%s",
        defaultSeoTitle: "BOW Sports Capital | Economics and Financial Literacy Through Sports",
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
        secondaryCtaLabel: "View Classes",
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
        tagline: "Economics and financial literacy through sports",
        description: "A live online program for students in Grades 5 to 8.",
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
        baseNote: "",
      },
    },
  ],
};

export const UPGRADE_PAGES: UpgradePage[] = [SETTINGS, NAVIGATION, FOOTER, HOME, PROGRAMS, PARTNER, ABOUT, TEACH, CONTACT, PODCAST];

export interface PublishedArchitectureState {
  status: string | null;
  publishedVersionId: string | null;
  publishedState: string | null;
  publishedSectionKinds: string[];
}

/**
 * A marker alone is not proof that the data migration finished. The previous
 * corrective audit found an environment where the code existed but the live
 * rows were still version 1. Verify the published pointer and fixed section
 * structure before treating a page as current.
 */
export function publishedArchitectureMatches(
  state: PublishedArchitectureState,
  expectedSectionKinds: readonly string[],
): boolean {
  return state.status === "published"
    && Boolean(state.publishedVersionId)
    && state.publishedState === "published"
    && state.publishedSectionKinds.length === expectedSectionKinds.length
    && state.publishedSectionKinds.every((kind, index) => kind === expectedSectionKinds[index]);
}

/** Known version-1 content that shares the same section kind as its replacement. */
export function containsRetiredMarketingContent(slug: string, sectionData: unknown): boolean {
  const serialized = JSON.stringify(sectionData ?? []);
  if (slug === "system-navigation") {
    return /Get Involved|Track 10|\/get-involved|\/programs\/track-|Find a Program/.test(serialized);
  }
  if (slug === "system-footer") {
    return /Get Involved|Track 10|\/get-involved|\/programs\/track-|FRONT OFFICE ON THE INSIDE/.test(serialized);
  }
  if (slug === "system-settings") {
    return /middle and high school|Brooklyn, New York|front office for the next generation|Find a Program/i.test(serialized);
  }
  if (slug === "podcast") {
    return /conversations behind the decisions|front-office strategy|throughout the curriculum/i.test(serialized);
  }
  return false;
}

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

export const VERIFIED_PUBLICATIONS = [
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
        SELECT p.id, p.architecture_version, p.cms_visible, p.status,
               p.published_version_id, p.draft_version_id,
               pv.state AS published_state,
               COALESCE(
                 array_agg(s.kind ORDER BY s.ordinal) FILTER (WHERE s.id IS NOT NULL),
                 ARRAY[]::text[]
               ) AS published_section_kinds,
               COALESCE(
                 jsonb_agg(s.data ORDER BY s.ordinal) FILTER (WHERE s.id IS NOT NULL),
                 '[]'::jsonb
               ) AS published_section_data
          FROM site_pages p
          LEFT JOIN site_page_versions pv ON pv.id = p.published_version_id
          LEFT JOIN site_page_sections s ON s.version_id = p.published_version_id
         WHERE p.slug = ${page.slug}
         GROUP BY p.id, p.architecture_version, p.cms_visible, p.status,
                  p.published_version_id, p.draft_version_id, pv.state
         LIMIT 1
      `;
      const existing = rows[0];

      const expectedSectionKinds = page.sections.map((section) => section.kind);
      const publishedIsCurrent = existing
        && Number(existing.architecture_version) >= MARKETING_ARCHITECTURE_VERSION
        && !containsRetiredMarketingContent(page.slug, existing.published_section_data)
        && publishedArchitectureMatches({
          status: String(existing.status ?? ""),
          publishedVersionId: existing.published_version_id ? String(existing.published_version_id) : null,
          publishedState: existing.published_state ? String(existing.published_state) : null,
          publishedSectionKinds: Array.isArray(existing.published_section_kinds)
            ? existing.published_section_kinds.map(String)
            : [],
        }, expectedSectionKinds);

      if (existing && publishedIsCurrent) {
        if (!dryRun) {
          await sql`
            UPDATE site_pages
               SET kind = ${page.kind}, path = ${page.path}, is_system = ${page.isSystem ?? false},
                   ordinal = ${page.ordinal}, architecture_version = ${MARKETING_ARCHITECTURE_VERSION},
                   cms_visible = ${page.cmsVisible}, updated_at = ${now()}
             WHERE id = ${existing.id}
          `;
        }
        skipped += 1;
        continue;
      }

      console.log(`[content] upgrading ${page.slug}${dryRun ? " (dry run)" : ""}`);
      if (dryRun) {
        upgraded += 1;
        continue;
      }

      await sql.begin(async (tx) => {
        const pageId = existing ? String(existing.id) : id("spg");
        const legacyDraftId = existing?.draft_version_id ? String(existing.draft_version_id) : null;
        let versionNo = 1;
        if (existing) {
          const maxRows = await tx`SELECT COALESCE(MAX(version_no), 0) AS n FROM site_page_versions WHERE page_id = ${pageId}`;
          versionNo = (Number(maxRows[0]?.n) || 0) + 1;
          if (existing.published_version_id) {
            await tx`UPDATE site_page_versions SET state = 'superseded' WHERE id = ${existing.published_version_id}`;
          }
          if (legacyDraftId) {
            // The old draft cannot safely remain the active editor document
            // because its section structure belongs to the retired site. Keep
            // every field and section in version history so it can be reviewed
            // or restored, but let the editor start from the new architecture.
            await tx`
              UPDATE site_page_versions
                 SET state = 'superseded',
                     note = CASE
                       WHEN COALESCE(note, '') = '' THEN 'Preserved pre-architecture owner draft'
                       ELSE note || ' · Preserved pre-architecture owner draft'
                     END
               WHERE id = ${legacyDraftId}
            `;
          }
        } else {
          await tx`
            INSERT INTO site_pages (
              id, kind, slug, path, name, description, status, is_system, ordinal,
              architecture_version, cms_visible, created_at, updated_at
            ) VALUES (
              ${pageId}, ${page.kind}, ${page.slug}, ${page.path}, ${page.name}, ${page.description},
              'published', ${page.isSystem ?? false}, ${page.ordinal}, ${MARKETING_ARCHITECTURE_VERSION}, ${page.cmsVisible}, ${now()}, ${now()}
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
            ${page.seoDescription}, false, 'Approved public copy', ${now()}, ${now()}
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
                 architecture_version = ${MARKETING_ARCHITECTURE_VERSION}, cms_visible = ${page.cmsVisible}, updated_at = ${now()}
           WHERE id = ${pageId}
        `;
      });
      upgraded += 1;
    }

    if (!dryRun) {
      await sql.begin(async (tx) => {
        await tx`UPDATE site_pages SET status = 'archived', cms_visible = false, architecture_version = ${MARKETING_ARCHITECTURE_VERSION}, updated_at = ${now()} WHERE slug IN ${tx(ARCHIVE_SLUGS)}`;
        await tx`UPDATE site_pages SET cms_visible = false, architecture_version = ${MARKETING_ARCHITECTURE_VERSION}, updated_at = ${now()} WHERE slug IN ${tx(HIDE_FROM_PRIMARY_CMS)}`;
        await tx`UPDATE site_pages SET status = 'archived', cms_visible = false, architecture_version = ${MARKETING_ARCHITECTURE_VERSION}, updated_at = ${now()} WHERE kind = 'track'`;
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

    console.log(`[content] approved public copy complete: ${upgraded} upgraded, ${skipped} already current`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}
