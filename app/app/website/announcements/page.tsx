import { PageHeader } from "@/components/ds";
import AnnouncementManager from "@/components/admin/website/AnnouncementManager";
import { listAdminAnnouncements, listAdminPages } from "@/lib/cms/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Announcements" };

export default async function AnnouncementsScreen() {
  const [announcements, pages] = await Promise.all([listAdminAnnouncements(), listAdminPages("page")]);

  return (
    <>
      <PageHeader
        eyebrow="Website"
        title="Announcements"
        context="A message bar across the site, or on one page. Set an end date and it retires itself."
      />
      <AnnouncementManager
        announcements={announcements}
        pageOptions={pages.map((page) => ({ value: page.slug, label: page.name }))}
      />
    </>
  );
}
