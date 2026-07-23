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
  { label: "Get Involved", href: "/get-involved" },
  { label: "Teach", href: "/teach" },
];

export interface FooterCol {
  head: string;
  links: NavItem[];
}

export const FOOTER_COLS: FooterCol[] = [
  {
    head: "Programs",
    links: [{ label: "Programs Overview", href: "/programs" }],
  },
  {
    head: "Get Involved",
    links: [{ label: "Get Involved", href: "/get-involved" }],
  },
  {
    head: "Teach",
    links: [{ label: "Become an Instructor", href: "/teach" }],
  },
  {
    head: "Contact",
    links: [{ label: "Contact / Partnerships", href: "/contact" }],
  },
  {
    head: "Account",
    links: [{ label: "Sign In", href: "/sign-in" }],
  },
];
