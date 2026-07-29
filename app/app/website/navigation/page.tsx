import PageEditor from "@/components/admin/website/PageEditor";
import { getEditablePage, listVersions } from "@/lib/cms/admin";
import { FOOTER_SLUG, NAVIGATION_SLUG } from "@/lib/cms/read";

export const dynamic = "force-dynamic";
export const metadata = { title: "Navigation" };

/**
 * Navigation and footer share the publishing machinery with pages, so a
 * founder can reorder the menu, preview it, and publish it in the same way —
 * and roll it back the same way if a link turns out wrong.
 */
export default async function NavigationScreen() {
  const [nav, footer] = await Promise.all([getEditablePage(NAVIGATION_SLUG), getEditablePage(FOOTER_SLUG)]);

  if (!nav || !footer) {
    return (
      <p style={{ fontFamily: "var(--font-interface)", fontSize: 15, color: "var(--text-secondary)", padding: "40px 0" }}>
        Navigation content hasn’t been set up yet. Run <code>npm run content:bootstrap</code> to load the current
        menu and footer into the editor.
      </p>
    );
  }

  const [navVersions, footerVersions] = await Promise.all([listVersions(nav.page.id), listVersions(footer.page.id)]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
      <PageEditor page={nav} versions={navVersions} faqPageSlug={nav.page.slug} />
      <PageEditor page={footer} versions={footerVersions} faqPageSlug={footer.page.slug} />
    </div>
  );
}
