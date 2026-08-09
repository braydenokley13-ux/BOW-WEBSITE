import Link from "next/link";
import PageEditor from "@/components/admin/website/PageEditor";
import { getEditablePage, listVersions } from "@/lib/cms/admin";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const page = await getEditablePage(id);
  return { title: page ? `Edit — ${page.page.name}` : "Edit page" };
}

export default async function EditPageScreen({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const page = await getEditablePage(id);

  if (!page) {
    return (
      <div style={{ padding: "40px 0" }}>
        <h1 style={{ fontFamily: "var(--font-editorial)", fontSize: 26 }}>That page doesn’t exist any more.</h1>
        <p style={{ fontFamily: "var(--font-interface)", fontSize: 15, color: "var(--text-secondary)" }}>
          It may have been removed. <Link href="/app/website/pages" className="bow-link">Back to Pages</Link>
        </p>
      </div>
    );
  }

  const versions = await listVersions(page.page.id);
  return (
    <PageEditor
      key={`${page.versionId}:${page.page.status}:${page.page.hasDraft}:${page.page.updatedAt}`}
      page={page}
      versions={versions}
      faqPageSlug={page.page.slug}
    />
  );
}
