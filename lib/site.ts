/**
 * Site-wide navigation and identity. Centralised so the masthead, footer,
 * sitemap, and (later) the authenticated shell stay in sync.
 */

export const SITE = {
  name: "BOW Sports Capital",
  tagline: "Sports Capital",
  description:
    "BOW Sports Capital helps middle and high school students learn economics, finance, leadership, and strategy by making the same decisions that shape teams, leagues, and the business of sports.",
  blurb: "The front office for the next generation. Read the game. Run the business. Make the decision.",
  // Canonical site origin. Override per-environment with NEXT_PUBLIC_SITE_URL.
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://bowsportscapital.com",
} as const;

export interface NavItem {
  label: string;
  href: string;
}

/** Primary masthead navigation. */
export const NAV: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Programs", href: "/programs" },
  { label: "Concept Map", href: "/concept-map" },
  { label: "Glossary", href: "/glossary" },
  { label: "Standards", href: "/standards" },
  { label: "Lessons", href: "/lessons" },
  { label: "Analytics", href: "/analytics" },
  { label: "Simulations", href: "/simulation" },
  { label: "Podcast", href: "/podcast" },
  { label: "Get Involved", href: "/get-involved" },
  { label: "Teach", href: "/teach" },
  { label: "About", href: "/about" },
];

export interface FooterCol {
  head: string;
  links: NavItem[];
}

export const FOOTER_COLS: FooterCol[] = [
  {
    head: "Programs",
    links: [
      { label: "Programs Overview", href: "/programs" },
      { label: "Track 101", href: "/programs/track-101" },
      { label: "Track 201", href: "/programs/track-201" },
      { label: "Track 301 — Coming", href: "/programs/track-301" },
    ],
  },
  {
    head: "Explore",
    links: [
      { label: "Lessons", href: "/lessons" },
      { label: "NBA Analytics", href: "/analytics" },
      { label: "Analytics Articles", href: "/analytics/articles" },
      { label: "The Open Docket", href: "/analytics/questions" },
      { label: "Research Notebook", href: "/analytics/notebook" },
      { label: "Simulations", href: "/simulation" },
      { label: "Podcast", href: "/podcast" },
      { label: "Highway World", href: "/highway-world" },
    ],
  },
  {
    head: "Curriculum",
    links: [
      { label: "Concept Map", href: "/concept-map" },
      { label: "Glossary", href: "/glossary" },
      { label: "Standards Alignment", href: "/standards" },
      { label: "In the News", href: "/news" },
    ],
  },
  {
    head: "For Groups",
    links: [
      { label: "Schools", href: "/get-involved/schools" },
      { label: "Camps", href: "/get-involved/camps" },
      { label: "Youth Organizations", href: "/get-involved/youth-organizations" },
      { label: "Families & Students", href: "/get-involved/families" },
      { label: "Partners", href: "/get-involved/partners" },
    ],
  },
  {
    head: "Connect",
    links: [
      { label: "Get Involved", href: "/get-involved" },
      { label: "Contact / Partnerships", href: "/contact" },
      { label: "Partner Demo", href: "/demo" },
      { label: "About BOW", href: "/about" },
      { label: "FAQ", href: "/#faq" },
    ],
  },
];
