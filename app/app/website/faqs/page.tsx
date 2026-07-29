import { PageHeader } from "@/components/ds";
import FaqManager from "@/components/admin/website/FaqManager";
import { listAdminFaqs, listAdminPages, listAdminPrograms, listAdminTracks } from "@/lib/cms/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "FAQs" };

export default async function FaqsScreen() {
  const [faqs, pages, tracks, programs] = await Promise.all([
    listAdminFaqs(),
    listAdminPages("page"),
    listAdminTracks(),
    listAdminPrograms(),
  ]);

  const scopes = [
    ...pages.map((page) => ({ scopeKind: "page" as const, scopeKey: page.slug, label: page.name })),
    ...tracks.map((track) => ({ scopeKind: "track" as const, scopeKey: track.slug, label: `Track: ${track.title || track.internalTitle}` })),
    ...programs
      .filter((program) => program.slug)
      .map((program) => ({ scopeKind: "program" as const, scopeKey: program.slug, label: `Program: ${program.title || program.internalName}` })),
  ];

  return (
    <>
      <PageHeader
        eyebrow="Website"
        title="FAQs"
        context="Write a question once, then show it on as many pages, tracks, or programs as it belongs on."
      />
      <FaqManager faqs={faqs} scopes={scopes} />
    </>
  );
}
