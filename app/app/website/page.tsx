import Link from "next/link";
import { Badge, PageHeader } from "@/components/ds";
import { listAdminAnnouncements, listAdminFaqs, listAdminPages, listAdminPrograms, listAdminPublications } from "@/lib/cms/admin";

export const dynamic = "force-dynamic";

export const metadata = { title: "Website" };

/**
 * The Website overview.
 *
 * It answers the two questions a founder actually has on opening it: what is
 * live right now, and what have I started editing but not published.
 */
export default async function WebsiteOverviewPage() {
  const [pages, programs, publications, faqs, announcements] = await Promise.all([
    listAdminPages(),
    listAdminPrograms(),
    listAdminPublications(),
    listAdminFaqs(),
    listAdminAnnouncements(),
  ]);

  const contentPages = pages.filter((page) => page.kind === "page" && page.cmsVisible);
  const unpublished = pages.filter((page) => page.hasDraft);
  const stats = [
    { label: "Primary pages", value: `${contentPages.filter((p) => p.isPublished).length}/${contentPages.length}`, note: "published" },
    { label: "Programs", value: `${programs.filter((p) => p.publicationStatus === "published").length}/${programs.length}`, note: "published" },
    { label: "Press records", value: `${publications.filter((p) => p.status === "published").length}/${publications.length}`, note: "published" },
    { label: "FAQs", value: `${faqs.filter((f) => f.status === "published").length}/${faqs.length}`, note: "published" },
    { label: "Announcements", value: `${announcements.filter((a) => a.isLive).length}`, note: "showing now" },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Website"
        title="Your public site"
        context="Everything a visitor reads lives here. Edits are private until you publish them."
      />

      <section className="ops-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 1, background: "var(--border-rule)", border: "1px solid var(--border-rule)" }}>
        {stats.map((stat) => (
          <div key={stat.label} style={{ background: "var(--bow-white)", padding: "18px 16px" }}>
            <div style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-secondary)" }}>{stat.label}</div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 30, lineHeight: 1.1, marginTop: 6 }}>{stat.value}</div>
            <div style={{ fontFamily: "var(--font-interface)", fontSize: 12.5, color: "var(--text-secondary)" }}>{stat.note}</div>
          </div>
        ))}
      </section>

      <section style={{ marginTop: 26 }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 15, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
          Unpublished changes
        </h2>
        {unpublished.length === 0 ? (
          <p style={{ fontFamily: "var(--font-interface)", fontSize: 15, color: "var(--text-secondary)" }}>
            Nothing in progress — the public site matches your latest published work.
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {unpublished.map((page) => (
              <li key={page.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--border-rule)" }}>
                <Link href={`/app/website/pages/${page.id}`} className="bow-link" style={{ fontFamily: "var(--font-interface)", fontSize: 15 }}>
                  {page.name}
                </Link>
                <Badge status="info">Draft waiting</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
