import Link from "next/link";
import ContentPage from "@/components/site/ContentPage";
import { getStandardsAlignment, buildStandardsHtml, type StandardsEntry } from "@/lib/standards";
import StandardsDownloadButton from "@/components/site/StandardsDownloadButton";
import { contentMetadata } from "@/lib/cms/metadata";

/** Intro copy is content (slug `standards`); the alignment table is live data. */
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return contentMetadata("standards", { path: "/standards" });
}

function StandardsList({ items }: { items: string[] }) {
  if (items.length === 0) return <span style={{ color: "var(--bow-slate)" }}>—</span>;
  return (
    <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((s, i) => (
        <li key={i} style={{ fontFamily: "var(--font-interface)", fontSize: 13.5, lineHeight: 1.45, color: "var(--bow-ink)" }}>{s}</li>
      ))}
    </ul>
  );
}

function ModuleCard({ e }: { e: StandardsEntry }) {
  return (
    <article style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: "22px 24px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "#fff", background: "var(--bow-ink)", padding: "3px 9px", borderRadius: 3 }}>
          Track {e.track}
        </span>
        <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, textTransform: "uppercase", letterSpacing: "-0.01em", color: "var(--bow-ink)" }}>
          {e.moduleName}
        </h3>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 18, marginTop: 16 }}>
        <div>
          <div style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)", marginBottom: 6 }}>Key Concepts</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {e.keyConcepts.map((c, i) => (
              <span key={i} style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-ink)", background: "var(--bow-paper)", border: "1px solid var(--border-rule)", borderRadius: 999, padding: "3px 10px" }}>{c}</span>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-blue)", marginBottom: 6 }}>AP Micro</div>
          <StandardsList items={e.apMicroStandards} />
        </div>
        <div>
          <div style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-positive)", marginBottom: 6 }}>AP Macro</div>
          <StandardsList items={e.apMacroStandards} />
        </div>
      </div>
    </article>
  );
}

export default function StandardsPage() {
  return <ContentPage slug="standards" screenLabel="Standards Alignment" extras={<Alignment />} />;
}

async function Alignment() {
  const entries = await getStandardsAlignment();
  const downloadHtml = buildStandardsHtml(entries);

  return (
    <section style={{ background: "var(--bow-paper)", padding: "clamp(40px,5vw,72px) clamp(18px,4vw,40px)" }}>
      <div className="bow-container-wide">
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
          <StandardsDownloadButton html={downloadHtml} />
        </div>
        {entries.length === 0 ? (
          <p style={{ fontFamily: "var(--font-interface)", fontSize: 15, color: "var(--bow-slate)" }}>
            The standards alignment is being prepared. Get in touch and we will send the current version directly.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {entries.map((e) => (
              <ModuleCard key={e.id} e={e} />
            ))}
          </div>
        )}
        <div style={{ marginTop: 36, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <StandardsDownloadButton html={downloadHtml} />
          <Link href="/contact" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14.5, letterSpacing: "0.05em", textTransform: "uppercase", padding: "13px 26px", border: "1px solid var(--border-rule)", background: "transparent", color: "var(--bow-ink)", borderRadius: 4, textDecoration: "none" }}>
            Request a Partnership →
          </Link>
        </div>
      </div>
    </section>
  );
}
