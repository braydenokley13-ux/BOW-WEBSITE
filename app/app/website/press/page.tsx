import { PageHeader } from "@/components/ds";
import PublicationManager from "@/components/admin/website/PublicationManager";
import { listAdminPublications } from "@/lib/cms/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Press Coverage" };

export default async function WebsitePressPage() {
  const publications = await listAdminPublications();
  return (
    <>
      <PageHeader
        eyebrow="Website"
        title="Press Coverage"
        context="Manage the publication names, article links, dates, and optional logos used by the Featured In section."
      />
      <PublicationManager publications={publications} />
    </>
  );
}
