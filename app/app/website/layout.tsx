import Link from "next/link";
import { requireWebsiteEditor } from "@/lib/cms/admin";

/**
 * BOW HQ → Website.
 *
 * The guard is here rather than only on each page: every screen under this
 * segment is founder-only, and `requireWebsiteEditor` is the same check the
 * data layer applies to every write, so the UI and the enforcement cannot
 * drift apart.
 */
export const dynamic = "force-dynamic";

const TABS = [
  { href: "/app/website", label: "Overview" },
  { href: "/app/website/pages", label: "Pages" },
  { href: "/app/website/programs", label: "Programs" },
  { href: "/app/website/tracks", label: "Tracks" },
  { href: "/app/website/navigation", label: "Navigation" },
  { href: "/app/website/faqs", label: "FAQs" },
  { href: "/app/website/announcements", label: "Announcements" },
  { href: "/app/website/settings", label: "Global Settings" },
];

export default async function WebsiteLayout({ children }: { children: React.ReactNode }) {
  await requireWebsiteEditor();
  return (
    <div className="ops-page" data-accent="blue">
      <nav
        aria-label="Website sections"
        style={{ display: "flex", flexWrap: "wrap", gap: 6, borderBottom: "1px solid var(--border-rule)", paddingBottom: 12 }}
      >
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              padding: "8px 12px",
              borderRadius: "var(--radius-control)",
              color: "var(--text-primary)",
            }}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
