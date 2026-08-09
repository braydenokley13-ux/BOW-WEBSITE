import Link from "next/link";
import { Badge, Button, PageHeader } from "@/components/ds";
import { listAdminPages } from "@/lib/cms/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pages" };

function when(value: number): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function WebsitePagesPage() {
  const pages = (await listAdminPages()).filter((page) => page.kind === "page" && page.cmsVisible);

  return (
    <>
      <PageHeader
        eyebrow="Website"
        title="Pages"
        context="The primary public pages: Home, Programs, Partner With BOW, About, Teach, and Contact. Edit one, save a draft, preview it, then publish."
      />

      {pages.length === 0 ? (
        <p style={{ fontFamily: "var(--font-interface)", fontSize: 15, color: "var(--text-secondary)" }}>
          No pages yet. Run <code>npm run content:bootstrap</code> to load the existing website into the editor.
        </p>
      ) : (
        <div style={{ border: "1px solid var(--border-rule)", background: "var(--bow-white)" }}>
          {pages.map((page) => (
            <div
              key={page.id}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr) auto auto",
                gap: 14,
                alignItems: "center",
                padding: "14px 16px",
                borderBottom: "1px solid var(--border-rule)",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <Link href={`/app/website/pages/${page.id}`} className="bow-link" style={{ fontFamily: "var(--font-editorial)", fontSize: 17 }}>
                  {page.name}
                </Link>
                <div style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                  {page.path ?? "—"} · {page.sectionCount} section{page.sectionCount === 1 ? "" : "s"} · updated {when(page.updatedAt)}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Badge status={page.isPublished ? "positive" : page.status === "archived" ? "neutral" : "warning"}>
                  {page.isPublished ? "Published" : page.status === "archived" ? "Archived" : "Draft"}
                </Badge>
                {page.hasDraft && page.isPublished ? <Badge status="info">Changes pending</Badge> : null}
              </div>
              <Button href={`/app/website/pages/${page.id}`} variant="secondary" size="sm">Edit</Button>
              {page.path ? (
                <Button href={`/api/website/preview?path=${encodeURIComponent(page.path)}`} variant="secondary" size="sm">Preview</Button>
              ) : <span />}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
