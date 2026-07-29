import Link from "next/link";
import ContentNotice from "@/components/site/ContentNotice";
import FaqList from "@/components/site/FaqList";
import SectionRenderer from "@/components/site/sections/SectionRenderer";
import { Button } from "@/components/ds";
import { getPublicTrackBySlug, getTrackForPreview, type PublicTrack } from "@/lib/cms/offerings";
import { getFaqsForScope, getGlobalSettings, getPageDocument, type PageDocument, type SiteFaq } from "@/lib/cms/read";
import { contentMetadata } from "@/lib/cms/metadata";
import { describe, notice, type ContentNotice as Notice } from "@/lib/cms/errors";
import { previewEnabled, staffDiagnosticsEnabled } from "@/lib/cms/preview";
import { DEFAULT_GLOBAL_SETTINGS, type GlobalSettingsData } from "@/lib/cms/sections";
import { Paragraphs } from "@/components/site/sections/shell";

/**
 * A track page — /programs/track-101 and every track after it.
 *
 * This one route replaced three hand-written pages. A track is a `curricula`
 * record with public fields plus its own section document, so the founder can
 * add a fourth track without a deployment, and a draft track 404s for the
 * public exactly like a track that never existed.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ trackSlug: string }> }) {
  const { trackSlug } = await params;
  try {
    const track = await getPublicTrackBySlug(trackSlug);
    if (!track) return contentMetadata(null, { title: "Track", noindex: true });
    return contentMetadata(`track-${trackSlug}`, {
      title: track.seoTitle || track.title,
      description: track.seoDescription || track.shortDescription,
      imageUrl: track.socialImageUrl || track.imageUrl,
      path: `/programs/${trackSlug}`,
    });
  } catch {
    return contentMetadata(null, { title: "Track", noindex: true });
  }
}

type Loaded =
  | { ok: true; track: PublicTrack; document: PageDocument | null; faqs: SiteFaq[]; settings: GlobalSettingsData }
  | { ok: false; notice: Notice };

/**
 * Data loading is kept out of the component body: a try/catch around JSX would
 * not catch a render error anyway, and separating them makes the failure state
 * a value the component renders rather than a control-flow accident.
 */
async function loadTrack(trackSlug: string): Promise<Loaded> {
  const staff = await staffDiagnosticsEnabled();
  const preview = await previewEnabled();
  try {
    const track = preview ? await getTrackForPreview(trackSlug) : await getPublicTrackBySlug(trackSlug);
    if (!track) {
      return { ok: false, notice: notice("track_not_found", { staff, detail: `track slug "${trackSlug}"` }) };
    }
    const [document, faqs, settings] = await Promise.all([
      getPageDocument(`track-${trackSlug}`, { preview }),
      getFaqsForScope("track", trackSlug),
      getGlobalSettings({ preview }).catch(() => DEFAULT_GLOBAL_SETTINGS),
    ]);
    return { ok: true, track, document, faqs, settings };
  } catch (error) {
    return { ok: false, notice: describe(error, { staff }) };
  }
}

export default async function TrackPage({ params }: { params: Promise<{ trackSlug: string }> }) {
  const { trackSlug } = await params;
  const result = await loadTrack(trackSlug);

  if (!result.ok) return <ContentNotice notice={result.notice} />;
  const { track, document, faqs, settings } = result;

  return (
    <div id="main" data-screen-label={track.title}>
      <TrackHero track={track} />
      {document && document.sections.length > 0 ? (
        <SectionRenderer
          sections={document.sections}
          context={{ pageSlug: document.slug, defaultEmptyStateText: settings.defaultEmptyStateText }}
        />
      ) : null}
      {faqs.length > 0 ? (
        <section className="bow-section bow-section-paper">
          <div className="bow-container">
            <div className="bow-section-intro" style={{ marginBottom: "clamp(28px,3.5vw,44px)" }}>
              <span className="bow-eyebrow" style={{ color: "var(--bow-blue)" }}>FAQ</span>
              <h2 className="bow-display">About this track</h2>
            </div>
            <FaqList items={faqs.map((faq) => ({ id: faq.id, q: faq.question, a: faq.answer }))} />
          </div>
        </section>
      ) : null}
    </div>
  );
}

function TrackHero({ track }: { track: PublicTrack }) {
  return (
    <section
      className="bow-section bow-section-paper"
      style={{ position: "relative", overflow: "hidden", borderBottom: "1px solid var(--border-rule)" }}
    >
      <div className="bow-ghost bow-para-upbig" aria-hidden style={{ right: -20, top: -60, fontSize: "clamp(220px,32vw,520px)" }}>
        {track.title}
      </div>
      <div className="bow-container" style={{ position: "relative" }}>
        <Link href="/programs" style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.06em", color: "var(--bow-slate)" }}>
          ← Programs
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 18, flexWrap: "wrap" }}>
          {track.kicker ? (
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-blue)" }}>
              {track.kicker}
            </span>
          ) : null}
          {track.badgeLabel ? (
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#fff", background: "var(--bow-blue)", padding: "3px 9px" }}>
              {track.badgeLabel}
            </span>
          ) : null}
          {track.gradeRange ? (
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
              {track.gradeRange}
            </span>
          ) : null}
        </div>
        <h1
          style={{
            margin: "14px 0 0",
            fontFamily: "var(--font-editorial)",
            fontWeight: 600,
            fontSize: "clamp(34px,5vw,68px)",
            lineHeight: 0.98,
            letterSpacing: "-0.015em",
            maxWidth: "18ch",
            textWrap: "balance",
          }}
        >
          {track.headline || track.title}
        </h1>
        {track.shortDescription ? (
          <Paragraphs text={track.shortDescription} className="bow-lead" style={{ marginTop: "var(--space-6)", maxWidth: "52ch" }} />
        ) : null}
        {track.ctaLabel && track.ctaHref ? (
          <div className="bow-actions" style={{ marginTop: "var(--space-6)" }}>
            <Button href={track.ctaHref} variant="primary" size="lg">{track.ctaLabel}</Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
