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
  { label: "Lessons", href: "/lessons" },
  { label: "Simulations", href: "/simulation" },
  { label: "Podcast", href: "/podcast" },
  { label: "Highway World", href: "/highway-world" },
  { label: "Get Involved", href: "/get-involved" },
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
      { label: "Simulations", href: "/simulation" },
      { label: "Podcast", href: "/podcast" },
      { label: "Highway World", href: "/highway-world" },
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
      { label: "About BOW", href: "/about" },
      { label: "FAQ", href: "/#faq" },
    ],
  },
];
