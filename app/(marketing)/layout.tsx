import Masthead from "@/components/site/Masthead";
import Footer from "@/components/site/Footer";
import AnnouncementBar from "@/components/site/AnnouncementBar";
import PreviewBanner from "@/components/site/PreviewBanner";
import { getChromeContent, getChromeAnnouncements } from "@/lib/cms/read";
import { previewEnabled } from "@/lib/cms/preview";

/**
 * The public shell.
 *
 * Navigation, footer, announcements, and the organisation name are content,
 * so this layout reads them per request. `getChromeContent` never throws — a
 * database problem degrades the chrome to its built-in defaults rather than
 * taking down every public route at once, while the page body below still
 * renders its own specific error state.
 */
/**
 * Applies to every public route, including the ones whose own body is static
 * (sign-in, sign-up, redirects). Without it those pages would be prerendered
 * at build time with whatever navigation and footer existed then — or, in a CI
 * build with no database, with the built-in fallbacks — and a founder's
 * published menu change would never reach them.
 */
export const dynamic = "force-dynamic";

export default async function MarketingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const preview = await previewEnabled();
  const { navigation, footer, settings } = await getChromeContent(preview);
  const announcements = await getChromeAnnouncements(null);

  return (
    <div style={{ background: "var(--bow-paper)", minHeight: "100vh", overflowX: "clip" }}>
      {preview ? <PreviewBanner pageLabel="this page" editHref="/app/website" /> : null}
      <AnnouncementBar announcements={announcements} />
      <Masthead
        nav={navigation}
        siteName={settings.organizationName}
        tagline={footer.tagline || "Sports Capital"}
      />
      <main>{children}</main>
      <Footer footer={footer} organizationName={settings.organizationName} />
    </div>
  );
}
