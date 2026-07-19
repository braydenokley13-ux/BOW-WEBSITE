import type { Metadata } from "next";
import { CapLine } from "@/components/ds";
import { getCurrentUser } from "@/lib/dal";
import { getActiveNewsItems } from "@/lib/content";
import { conceptLabel } from "@/lib/daily-question";
import NewsSubmitForm from "@/components/site/NewsSubmitForm";

const TITLE = "In the News — BOW Sports Capital";
const DESCRIPTION =
  "Real sports-business headlines, tied to the economic concepts BOW teaches. See the front office at work in the news.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { type: "website", title: TITLE, description: DESCRIPTION, url: "/news" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

// Reflect admin edits / approvals without a rebuild.
export const dynamic = "force-dynamic";

export default async function NewsPage() {
  const items = (await getActiveNewsItems());
  const me = await getCurrentUser();
  const isStudent = me?.role === "student";

  return (
    <div data-screen-label="News">
      <section style={{ background: "var(--bow-ink)", color: "#fff", padding: "clamp(44px,6vw,88px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--bow-dark-border)" }}>
        <div className="bow-container-wide">
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
            In the News
          </span>
          <h1 style={{ margin: "14px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(34px,5vw,64px)", lineHeight: 1.0, letterSpacing: "-0.015em", maxWidth: "16ch", textWrap: "balance" }}>
            The front office, in real time.
          </h1>
          <p style={{ margin: "20px 0 0", maxWidth: 700, fontFamily: "var(--font-interface)", fontSize: "clamp(16px,1.6vw,19px)", lineHeight: 1.6, color: "#c8cad0" }}>
            Real sports-business stories, each tagged with the BOW concept it illustrates. The economics you learn is happening in the headlines right now.
          </p>
          <CapLine weight={6} step={14} stepAt={0.42} style={{ maxWidth: 240, marginTop: 28 }} />
        </div>
      </section>

      <section style={{ background: "var(--bow-paper)", padding: "clamp(40px,5vw,72px) clamp(18px,4vw,40px)" }}>
        <div className="bow-container-wide" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 16 }}>
          {items.length === 0 ? (
            <p style={{ fontFamily: "var(--font-interface)", fontSize: 15, color: "var(--bow-slate)" }}>No stories yet — check back soon.</p>
          ) : (
            items.map((n) => (
              <article key={n.id} style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderLeft: "4px solid var(--bow-orange)", borderRadius: 6, padding: "20px 22px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                  {n.conceptTag && (
                    <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "#fff", background: "var(--bow-ink)", borderRadius: 999, padding: "3px 10px" }}>
                      {conceptLabel(n.conceptTag)}
                    </span>
                  )}
                  {n.publishedDate && <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)" }}>{n.publishedDate}</span>}
                  {n.sourceName && <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)" }}>· {n.sourceName}</span>}
                </div>
                <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(19px,2.4vw,24px)", textTransform: "uppercase", letterSpacing: "-0.01em", color: "var(--bow-ink)" }}>
                  {n.headline}
                </h2>
                <p style={{ margin: "8px 0 0", fontFamily: "var(--font-interface)", fontSize: 14.5, lineHeight: 1.6, color: "var(--bow-ink)" }}>{n.summary}</p>
                {n.sourceUrl && (
                  <a href={n.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 10, fontFamily: "var(--font-data)", fontSize: 11.5, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--bow-blue)", textDecoration: "none" }}>
                    Read the source →
                  </a>
                )}
              </article>
            ))
          )}

          {isStudent && (
            <div style={{ marginTop: 16, background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 8, padding: "clamp(20px,3vw,28px)" }}>
              <h2 style={{ margin: "0 0 6px", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, textTransform: "uppercase", color: "var(--bow-ink)" }}>
                Spotted a story?
              </h2>
              <p style={{ margin: "0 0 16px", fontFamily: "var(--font-interface)", fontSize: 14.5, lineHeight: 1.6, color: "var(--bow-slate)" }}>
                Submit a sports-business story you found and the concept it shows. An admin reviews submissions before they appear here.
              </p>
              <NewsSubmitForm />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
