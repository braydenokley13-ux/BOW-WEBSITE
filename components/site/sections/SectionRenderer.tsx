/* ============================================================
 * Section renderer — database content through the existing components.
 *
 * One `switch` maps a stored section `kind` onto the layout the site already
 * had. The point of this file is that moving a page into the CMS is not a
 * redesign: a hero authored in BOW HQ renders through the same classes, the
 * same grid, and the same buttons as the hand-written hero it replaced.
 *
 * Data-backed sections (programs, tracks, testimonials, FAQs, announcements)
 * fetch inside themselves as async Server Components, so a page composed of
 * ten sections is still one `await` per distinct query thanks to the request
 * memoization in lib/cms/read.ts.
 *
 * Every one of them also owns its own empty state. A section with nothing to
 * show says so in words a visitor can use; it never renders an empty grid and
 * never throws.
 * ============================================================ */

import Link from "next/link";
import { Button, DecisionCard } from "@/components/ds";
import FaqList from "@/components/site/FaqList";
import OfferingCard from "@/components/site/OfferingCard";
import { SectionSurface, SectionIntro, Paragraphs, mutedColor, accentColor } from "@/components/site/sections/shell";
import type { PageSection } from "@/lib/cms/read";
import { getFaqsForScope, getLiveAnnouncements, getPublicPublications, getPublicTestimonials } from "@/lib/cms/read";
import { listOpenPrograms, listPublicTracks } from "@/lib/cms/offerings";
import type {
  AnnouncementSectionData,
  ContactData,
  CtaData,
  DecisionDemoData,
  FaqSectionData,
  FeatureCardsData,
  HeroData,
  ImageTextData,
  ListData,
  MediaListData,
  ProgramCollectionData,
  PressData,
  StatsData,
  StepsData,
  TestimonialsData,
  TextData,
  Tone,
  TrackCollectionData,
} from "@/lib/cms/sections";

export interface SectionContext {
  /** Which page these sections belong to — FAQ placements key off it. */
  pageSlug: string;
  /** Site-wide fallback copy for empty states. */
  defaultEmptyStateText: string;
}

export default async function SectionRenderer({
  sections,
  context,
}: {
  sections: PageSection[];
  context: SectionContext;
}) {
  return (
    <>
      {sections.map((section) => (
        <Section key={section.id} section={section} context={context} />
      ))}
    </>
  );
}

async function Section({ section, context }: { section: PageSection; context: SectionContext }) {
  switch (section.kind) {
    case "hero":
      return <HeroSection data={section.data as unknown as HeroData} />;
    case "text":
      return <TextSection data={section.data as unknown as TextData} />;
    case "feature_cards":
      return <FeatureCardsSection data={section.data as unknown as FeatureCardsData} />;
    case "stats":
      return <StatsSection data={section.data as unknown as StatsData} />;
    case "program_collection":
      return <ProgramCollectionSection data={section.data as unknown as ProgramCollectionData} context={context} />;
    case "track_collection":
      return <TrackCollectionSection data={section.data as unknown as TrackCollectionData} />;
    case "testimonials":
      return <TestimonialsSection data={section.data as unknown as TestimonialsData} />;
    case "press":
      return <PressSection data={section.data as unknown as PressData} />;
    case "faq":
      return <FaqSection data={section.data as unknown as FaqSectionData} context={context} />;
    case "cta":
      return <CtaSection data={section.data as unknown as CtaData} />;
    case "announcement":
      return <AnnouncementSection data={section.data as unknown as AnnouncementSectionData} context={context} />;
    case "steps":
      return <StepsSection data={section.data as unknown as StepsData} />;
    case "image_text":
      return <ImageTextSection data={section.data as unknown as ImageTextData} />;
    case "contact":
      return <ContactSection data={section.data as unknown as ContactData} />;
    case "list":
      return <ListSection data={section.data as unknown as ListData} />;
    case "decision_demo":
      return <DecisionDemoSection data={section.data as unknown as DecisionDemoData} />;
    case "media_list":
      return <MediaListSection data={section.data as unknown as MediaListData} />;
    default:
      // nav_menu / footer_columns / global_settings render through the chrome,
      // not the page body. Anything else is a kind this build doesn't know.
      return null;
  }
}

/* ---------- presentational sections ---------- */

function Actions({ actions, tone }: { actions: CtaData["actions"]; tone: Tone }) {
  const usable = actions.filter((action) => action.label.trim() && action.href.trim());
  if (usable.length === 0) return null;
  return (
    <div className="bow-actions" style={{ marginTop: "var(--space-6)" }}>
      {usable.map((action) => (
        <Button
          key={`${action.label}-${action.href}`}
          href={action.href}
          variant={action.variant}
          size="lg"
          style={
            tone === "blue" && action.variant === "secondary"
              ? { color: "#fff", borderColor: "rgba(255,255,255,0.6)" }
              : tone === "ink" && action.variant === "secondary"
                ? { color: "#fff", borderColor: "var(--bow-dark-border)" }
                : undefined
          }
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}

function HeroSection({ data }: { data: HeroData }) {
  return (
    <SectionSurface tone={data.tone} ghostText={data.ghostText || undefined}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", maxWidth: 720 }}>
        {data.eyebrow ? (
          <span className="bow-eyebrow-data" style={{ color: accentColor(data.tone) }}>
            {data.eyebrow}
          </span>
        ) : null}
        <h1
          style={{
            fontFamily: "var(--font-editorial)",
            fontWeight: "var(--fw-semibold)",
            fontSize: "var(--type-lead)",
            lineHeight: "var(--lh-lead)",
            letterSpacing: "var(--track-editorial)",
            textWrap: "balance",
          }}
        >
          {data.headline}
        </h1>
        {data.body ? (
          <Paragraphs
            text={data.body}
            className="bow-lead"
            style={{ maxWidth: "46ch", color: data.tone === "ink" || data.tone === "blue" ? "rgba(255,255,255,0.86)" : undefined }}
          />
        ) : null}
        <Actions actions={data.actions} tone={data.tone} />
        {data.note ? (
          <p className="bow-data" style={{ fontSize: "var(--type-meta)", color: mutedColor(data.tone) }}>
            {data.note}
          </p>
        ) : null}
      </div>
    </SectionSurface>
  );
}

function TextSection({ data }: { data: TextData }) {
  return (
    <SectionSurface tone={data.tone}>
      <div className="bow-section-intro bow-section-intro-wide bow-reveal" style={{ marginBottom: 0 }}>
        {data.eyebrow ? (
          <span className="bow-eyebrow" style={{ color: accentColor(data.tone) }}>
            {data.eyebrow}
          </span>
        ) : null}
        {data.headline ? <h2 className="bow-headline">{data.headline}</h2> : null}
        {data.body ? <Paragraphs text={data.body} className="bow-lead" /> : null}
      </div>
    </SectionSurface>
  );
}

function FeatureCardsSection({ data }: { data: FeatureCardsData }) {
  const groups = data.groups.filter((group) => group.cards.length > 0);
  return (
    <SectionSurface tone={data.tone}>
      <SectionIntro eyebrow={data.eyebrow} headline={data.headline} body={data.body} tone={data.tone} />
      {groups.length === 0 ? null : (
        groups.map((group, groupIndex) => (
          <div key={group.label || groupIndex} style={{ marginBottom: groups.length > 1 ? "var(--space-12)" : 0 }}>
            {group.label ? (
              <div className="bow-eyebrow-data" style={{ color: mutedColor(data.tone), marginBottom: "var(--space-4)" }}>
                {group.label}
              </div>
            ) : null}
            <div className={`bow-grid bow-grid-${Math.min(data.columns, group.cards.length) || data.columns}`}>
              {group.cards.map((card) => {
                const body = (
                  <>
                    <span className="bow-display" style={{ fontSize: "var(--type-card)" }}>{card.title}</span>
                    {card.body ? (
                      <p style={{ fontFamily: "var(--font-interface)", fontSize: "var(--type-body-sm)", lineHeight: "var(--lh-body)", color: mutedColor(data.tone), flex: 1 }}>
                        {card.body}
                      </p>
                    ) : null}
                    {card.ctaLabel ? <span className="bow-cta-link">{card.ctaLabel}</span> : null}
                  </>
                );
                const style = {
                  background: data.tone === "ink" ? "var(--bow-dark-surface)" : "var(--bow-white)",
                  border: data.tone === "ink" ? "1px solid var(--bow-dark-border)" : "1px solid var(--border-rule)",
                  borderTop: "3px solid var(--bow-blue)",
                  padding: "24px 22px",
                  display: "flex",
                  flexDirection: "column" as const,
                  gap: "var(--space-3)",
                };
                return card.href ? (
                  <Link key={card.title} href={card.href} className="bow-card" style={style}>
                    {body}
                  </Link>
                ) : (
                  <div key={card.title} className="bow-card" style={style}>
                    {body}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </SectionSurface>
  );
}

function StatsSection({ data }: { data: StatsData }) {
  if (data.items.length === 0) return null;
  return (
    <SectionSurface tone={data.tone}>
      <SectionIntro eyebrow={data.eyebrow} headline={data.headline} body={data.body} tone={data.tone} variant="headline" />
      <div
        className="bow-grid bow-grid-ruled"
        style={{ gridTemplateColumns: `repeat(${Math.min(data.items.length, 5)}, minmax(0, 1fr))` }}
      >
        {data.items.map((item) => (
          <div
            key={item.label}
            style={{
              background: data.tone === "ink" ? "var(--bow-ink)" : "var(--bow-white)",
              padding: "26px 20px",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-2)",
            }}
          >
            <span className="bow-stat" style={{ fontSize: "clamp(28px,3.4vw,42px)", color: data.tone === "ink" ? "var(--bow-on-ink)" : undefined }}>
              {item.value}
            </span>
            <span className="bow-eyebrow" style={{ color: mutedColor(data.tone) }}>{item.label}</span>
          </div>
        ))}
      </div>
    </SectionSurface>
  );
}

function StepsSection({ data }: { data: StepsData }) {
  if (data.items.length === 0) return null;
  const columns = Math.min(data.items.length, 4);
  return (
    <SectionSurface tone={data.tone}>
      <SectionIntro eyebrow={data.eyebrow} headline={data.headline} body={data.body} tone={data.tone} />
      {data.style === "spec" ? (
        <dl style={{ margin: 0, border: "1px solid var(--border-rule)", background: "var(--bow-white)" }}>
          {data.items.map((item, index) => (
            <div
              key={item.label}
              style={{ display: "flex", alignItems: "baseline", gap: "var(--space-4)", padding: "15px 20px", borderTop: index === 0 ? "none" : "1px solid var(--border-rule)" }}
            >
              {item.number ? (
                <span className="bow-data" style={{ fontSize: "var(--type-meta)", color: "var(--bow-blue)", flex: "0 0 26px" }}>{item.number}</span>
              ) : null}
              <dt className="bow-display" style={{ fontSize: "var(--type-card)", flex: 1 }}>{item.label}</dt>
              <dd className="bow-data" style={{ margin: 0, fontSize: "var(--type-meta)", color: "var(--text-secondary)" }}>{item.detail}</dd>
            </div>
          ))}
        </dl>
      ) : data.style === "list" ? (
        <ol className="bow-grid bow-grid-ruled" style={{ gridTemplateColumns: "minmax(0,1fr)", margin: 0, padding: 0, listStyle: "none" }}>
          {data.items.map((item, index) => (
            <li
              key={item.label}
              style={{
                background: data.tone === "ink" ? "var(--bow-dark-surface)" : "var(--bow-white)",
                padding: "18px 22px",
                display: "flex",
                gap: "var(--space-4)",
                alignItems: "center",
              }}
            >
              <span className="bow-data" style={{ color: "var(--bow-blue)" }}>{item.number || String(index + 1).padStart(2, "0")}</span>
              <span className="bow-display" style={{ fontSize: "var(--type-card)" }}>{item.label}</span>
            </li>
          ))}
        </ol>
      ) : (
        <ol className={`bow-grid bow-grid-${columns}`} style={{ padding: 0, margin: 0, listStyle: "none" }}>
          {data.items.map((item, index) => (
            <li key={item.label} className="bow-reveal-sm" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <span className="bow-data" style={{ fontSize: "var(--type-meta)", color: "var(--bow-blue)", fontWeight: "var(--fw-semibold)" }}>
                {item.number || String(index + 1).padStart(2, "0")}
              </span>
              <span className="bow-display" style={{ fontSize: "var(--type-section)" }}>{item.label}</span>
              <div style={{ height: 4, background: item.emphasis ? "var(--bow-orange)" : "var(--bow-blue)", width: "100%" }} />
              {item.body ? (
                <span style={{ fontFamily: "var(--font-interface)", fontSize: "var(--type-body-sm)", color: mutedColor(data.tone), lineHeight: "var(--lh-body)" }}>
                  {item.body}
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </SectionSurface>
  );
}

function ListSection({ data }: { data: ListData }) {
  const items = data.items.filter((item) => item.trim());
  if (items.length === 0) return null;
  return (
    <SectionSurface tone={data.tone}>
      <SectionIntro eyebrow={data.eyebrow} headline={data.headline} body={data.body} tone={data.tone} marginBottom="var(--space-6)" />
      {data.style === "chips" ? (
        <ul style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", padding: 0, listStyle: "none", margin: 0 }}>
          {items.map((item) => (
            <li
              key={item}
              style={{
                fontFamily: "var(--font-interface)",
                fontWeight: "var(--fw-medium)",
                fontSize: "var(--type-body-sm)",
                padding: "7px 14px",
                border: "1px solid var(--border-rule)",
                borderRadius: "var(--radius-pill)",
                background: "var(--bow-white)",
                color: "var(--text-secondary)",
              }}
            >
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", borderTop: "1px solid var(--border-rule)" }}>
          {items.map((item, index) => (
            <div key={item} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "18px 20px 18px 0", borderBottom: "1px solid var(--border-rule)" }}>
              {data.style === "numbered" ? (
                <span className="bow-data" style={{ fontWeight: 600, fontSize: 13, color: "var(--bow-blue)" }}>{String(index + 1).padStart(2, "0")}</span>
              ) : (
                <span aria-hidden style={{ width: 4, height: 4, background: "var(--bow-blue)", display: "inline-block", marginTop: 10 }} />
              )}
              <span style={{ fontFamily: "var(--font-interface)", fontSize: 16, lineHeight: 1.45, color: mutedColor(data.tone) }}>{item}</span>
            </div>
          ))}
        </div>
      )}
    </SectionSurface>
  );
}

function ImageTextSection({ data }: { data: ImageTextData }) {
  const copy = (
    <div className="bow-section-intro">
      {data.eyebrow ? <span className="bow-eyebrow" style={{ color: accentColor(data.tone) }}>{data.eyebrow}</span> : null}
      {data.headline ? <h2 className="bow-headline">{data.headline}</h2> : null}
      {data.body ? <Paragraphs text={data.body} className="bow-lead" /> : null}
      {data.bullets.length > 0 ? (
        <ul style={{ display: "flex", flexDirection: "column", gap: 8, margin: "var(--space-4) 0 0", padding: 0, listStyle: "none" }}>
          {data.bullets.filter(Boolean).map((bullet) => (
            <li key={bullet} className="bow-data" style={{ display: "flex", alignItems: "center", gap: 9, fontSize: "var(--type-meta)", color: mutedColor(data.tone) }}>
              <span aria-hidden style={{ width: 4, height: 4, background: "var(--bow-blue)", display: "inline-block" }} />
              {bullet}
            </li>
          ))}
        </ul>
      ) : null}
      <Actions actions={data.actions} tone={data.tone} />
    </div>
  );

  const media = data.imageUrl ? (
    // Content images are arbitrary founder-supplied URLs; a plain <img> avoids
    // the optimizer's allow-list becoming a thing the founder has to configure.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={data.imageUrl}
      alt={data.imageAlt}
      style={{ width: "100%", height: "auto", display: "block", border: "1px solid var(--border-rule)" }}
    />
  ) : (
    <div
      aria-hidden
      style={{ width: "100%", aspectRatio: "4 / 3", background: "var(--bow-paper)", border: "1px dashed var(--border-rule)" }}
    />
  );

  return (
    <SectionSurface tone={data.tone}>
      <div className="bow-split bow-split-center">
        {data.imagePosition === "left" ? (
          <>
            {media}
            {copy}
          </>
        ) : (
          <>
            {copy}
            {media}
          </>
        )}
      </div>
    </SectionSurface>
  );
}

function CtaSection({ data }: { data: CtaData }) {
  return (
    <SectionSurface tone={data.tone} ghostText={data.ghostText || undefined}>
      {data.eyebrow ? (
        <span className="bow-eyebrow" style={{ color: data.tone === "blue" ? "rgba(255,255,255,0.8)" : accentColor(data.tone) }}>
          {data.eyebrow}
        </span>
      ) : null}
      <h2 className="bow-display" style={{ fontSize: "var(--type-campaign)", lineHeight: "var(--lh-campaign)" }}>
        {data.headline}
      </h2>
      {data.body ? (
        <Paragraphs
          text={data.body}
          className="bow-lead"
          style={{ color: data.tone === "blue" ? "rgba(255,255,255,0.92)" : undefined, marginTop: "var(--space-6)" }}
        />
      ) : null}
      <Actions actions={data.actions} tone={data.tone} />
    </SectionSurface>
  );
}

function ContactSection({ data }: { data: ContactData }) {
  const details = [
    data.email ? { label: "Email", value: data.email, href: `mailto:${data.email}` } : null,
    data.phone ? { label: "Phone", value: data.phone, href: `tel:${data.phone.replace(/[^\d+]/g, "")}` } : null,
    data.location ? { label: "Based in", value: data.location, href: null } : null,
  ].filter(Boolean) as { label: string; value: string; href: string | null }[];

  return (
    <SectionSurface tone={data.tone}>
      <SectionIntro eyebrow={data.eyebrow} headline={data.headline} body={data.body} tone={data.tone} />
      {details.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-8)", marginBottom: "var(--space-8)" }}>
          {details.map((detail) => (
            <div key={detail.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="bow-eyebrow-data" style={{ color: mutedColor(data.tone) }}>{detail.label}</span>
              {detail.href ? (
                <a href={detail.href} className="bow-link" style={{ fontFamily: "var(--font-interface)", fontSize: "var(--type-body)" }}>
                  {detail.value}
                </a>
              ) : (
                <span style={{ fontFamily: "var(--font-interface)", fontSize: "var(--type-body)" }}>{detail.value}</span>
              )}
            </div>
          ))}
        </div>
      ) : null}
      {data.formIntro ? <Paragraphs text={data.formIntro} className="bow-lead" style={{ marginBottom: "var(--space-6)" }} /> : null}
    </SectionSurface>
  );
}

function MediaListSection({ data }: { data: MediaListData }) {
  if (data.items.length === 0) return null;
  return (
    <SectionSurface tone={data.tone}>
      <div className="bow-split">
        <div className="bow-section-intro">
          {data.eyebrow ? <span className="bow-eyebrow" style={{ color: accentColor(data.tone) }}>{data.eyebrow}</span> : null}
          {data.headline ? <h2 className="bow-headline">{data.headline}</h2> : null}
          {data.body ? <Paragraphs text={data.body} className="bow-lead" /> : null}
          <Actions actions={data.actions} tone={data.tone} />
        </div>
        <ul style={{ display: "flex", flexDirection: "column", margin: 0, padding: 0, listStyle: "none" }}>
          {data.items.map((item, index) => {
            const inner = (
              <>
                {item.tag ? (
                  <span className="bow-data" style={{ fontWeight: "var(--fw-semibold)", fontSize: "var(--type-meta)", color: mutedColor(data.tone), flex: "0 0 44px" }}>
                    {item.tag}
                  </span>
                ) : null}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                  {item.kicker ? <span className="bow-eyebrow" style={{ color: accentColor(data.tone) }}>{item.kicker}</span> : null}
                  <h3 style={{ fontFamily: "var(--font-editorial)", fontWeight: "var(--fw-semibold)", fontSize: 18, lineHeight: 1.25 }}>{item.title}</h3>
                  {item.meta ? <span className="bow-data" style={{ fontSize: "var(--type-meta)", color: mutedColor(data.tone) }}>{item.meta}</span> : null}
                </div>
              </>
            );
            const rowStyle = {
              display: "flex",
              gap: "var(--space-4)",
              padding: "16px 0",
              alignItems: "baseline" as const,
              borderTop: index === 0 ? "none" : "1px solid var(--border-rule)",
              color: data.tone === "ink" ? "var(--bow-on-ink)" : "var(--text-primary)",
            };
            return (
              <li key={`${item.title}-${index}`}>
                {item.href ? (
                  <Link href={item.href} style={rowStyle}>
                    {inner}
                  </Link>
                ) : (
                  <div style={rowStyle}>{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </SectionSurface>
  );
}

function DecisionDemoSection({ data }: { data: DecisionDemoData }) {
  if (data.options.length === 0) return null;
  const byChoice = Object.fromEntries(
    data.outcomes.map((outcome) => [outcome.optionId, { status: outcome.status, headline: outcome.headline, body: outcome.body }]),
  );
  return (
    <SectionSurface tone={data.tone} id="decide">
      <div className="bow-split bow-split-center">
        <div className="bow-section-intro">
          {data.eyebrow ? <span className="bow-eyebrow" style={{ color: accentColor(data.tone) }}>{data.eyebrow}</span> : null}
          {data.headline ? <h2 className="bow-display" style={{ fontSize: "var(--type-page)" }}>{data.headline}</h2> : null}
          {data.body ? <Paragraphs text={data.body} className="bow-lead" /> : null}
          {data.meta.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-8)", marginTop: "var(--space-4)" }}>
              {data.meta.map((entry) => (
                <div key={entry.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span className="bow-eyebrow-data" style={{ color: mutedColor(data.tone) }}>{entry.label}</span>
                  <span style={{ fontFamily: "var(--font-interface)", fontWeight: "var(--fw-semibold)", fontSize: "var(--type-body)" }}>{entry.value}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div>
          <DecisionCard
            desk={data.desk}
            round={data.round}
            prompt={data.prompt}
            facts={data.facts.map((fact) => ({ label: fact.label, value: fact.value, tone: fact.tone === "neutral" ? undefined : fact.tone }))}
            unknowns={data.unknowns}
            options={data.options}
            consequence={{ byChoice }}
            primaryLabel={data.primaryLabel}
          />
        </div>
      </div>
    </SectionSurface>
  );
}

/* ---------- data-backed sections ---------- */

function EmptyState({ headline, body, action, tone }: { headline: string; body: string; action?: { label: string; href: string } | null; tone: Tone }) {
  return (
    <div
      style={{
        border: "1px dashed var(--border-rule)",
        borderRadius: "var(--radius-control)",
        padding: "40px 28px",
        textAlign: "center",
        background: tone === "ink" ? "var(--bow-dark-surface)" : "var(--bow-white)",
      }}
    >
      <p style={{ margin: 0, fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "var(--type-card)" }}>{headline}</p>
      {body ? (
        <p style={{ margin: "10px 0 0", fontFamily: "var(--font-interface)", fontSize: 16, color: mutedColor(tone), maxWidth: 520, marginInline: "auto" }}>{body}</p>
      ) : null}
      {action ? (
        <div style={{ marginTop: 18 }}>
          <Button href={action.href} variant="primary" size="md">{action.label}</Button>
        </div>
      ) : null}
    </div>
  );
}

async function ProgramCollectionSection({ data, context }: { data: ProgramCollectionData; context: SectionContext }) {
  const all = await listOpenPrograms();
  const picked = data.programSlugs.length > 0
    ? data.programSlugs.map((slug) => all.find((program) => program.slug === slug || program.id === slug)).filter(Boolean) as typeof all
    : data.featuredOnly
      ? all.filter((program) => program.featured)
      : all;
  const programs = data.limit > 0 ? picked.slice(0, data.limit) : picked;

  if (programs.length === 0 && data.hideWhenEmpty) return null;

  return (
    <SectionSurface tone={data.tone}>
      <SectionIntro eyebrow={data.eyebrow} headline={data.headline} body={data.body} tone={data.tone} marginBottom="clamp(24px,3vw,36px)" />
      {programs.length === 0 ? (
        <EmptyState
          tone={data.tone}
          headline={data.emptyHeadline || "No programs are open right now."}
          body={data.emptyBody || context.defaultEmptyStateText || "New sessions are added regularly — join the interest list and we’ll tell you when one opens."}
          action={data.emptyActionLabel && data.emptyActionHref ? { label: data.emptyActionLabel, href: data.emptyActionHref } : { label: "Join the interest list", href: "/sign-up" }}
        />
      ) : (
        <>
          <div className={`bow-grid bow-grid-${Math.min(3, programs.length)}`}>
            {programs.map((program) => (
              <OfferingCard key={program.id} program={program} />
            ))}
          </div>
          {data.showAllLabel && data.showAllHref ? (
            <div style={{ marginTop: "var(--space-8)" }}>
              <Button href={data.showAllHref} variant="secondary" size="md">{data.showAllLabel}</Button>
            </div>
          ) : null}
        </>
      )}
    </SectionSurface>
  );
}

async function TrackCollectionSection({ data }: { data: TrackCollectionData }) {
  const all = await listPublicTracks();
  const tracks = data.trackSlugs.length > 0
    ? data.trackSlugs.map((slug) => all.find((track) => track.slug === slug)).filter(Boolean) as typeof all
    : all;

  return (
    <SectionSurface tone={data.tone} id="tracks">
      <SectionIntro eyebrow={data.eyebrow} headline={data.headline} body={data.body} tone={data.tone} />
      {tracks.length === 0 ? (
        <EmptyState
          tone={data.tone}
          headline={data.emptyHeadline || "Tracks are on the way."}
          body={data.emptyBody || "The curriculum tracks aren’t published yet. Check back shortly."}
          action={{ label: "See programs", href: "/programs" }}
        />
      ) : (
        <div className={data.layout === "grid" ? `bow-grid bow-grid-${Math.min(3, tracks.length)} bow-grid-ruled` : "bow-grid bow-grid-2 bow-grid-ruled"}>
          {tracks.map((track) => (
            <div
              key={track.id}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-4)",
                padding: "clamp(24px,3vw,36px)",
                position: "relative",
                background: track.featured ? "var(--bow-white)" : "var(--bow-paper)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", minHeight: 22 }}>
                {track.kicker ? <span className="bow-eyebrow-data" style={{ color: "var(--text-secondary)" }}>{track.kicker}</span> : null}
                {track.badgeLabel ? (
                  <span className="bow-eyebrow-data" style={{ background: "var(--bow-blue)", color: "#fff", padding: "4px 9px" }}>{track.badgeLabel}</span>
                ) : null}
              </div>
              <span className="bow-display" style={{ fontSize: "clamp(56px,7vw,92px)", lineHeight: 0.8, letterSpacing: "-0.03em" }}>
                {track.title}
              </span>
              <div style={{ height: 4, background: "var(--bow-blue)", width: 64 }} />
              {track.headline ? (
                <h3 style={{ fontFamily: "var(--font-editorial)", fontWeight: "var(--fw-semibold)", fontSize: "var(--type-card)", lineHeight: "var(--lh-card)" }}>
                  {track.headline}
                </h3>
              ) : null}
              {track.shortDescription ? (
                <p style={{ fontFamily: "var(--font-interface)", fontSize: "var(--type-body-sm)", lineHeight: "var(--lh-body)", color: "var(--text-secondary)" }}>
                  {track.shortDescription}
                </p>
              ) : null}
              {track.gradeRange ? (
                <span className="bow-data" style={{ fontSize: "var(--type-meta)", color: "var(--text-secondary)" }}>{track.gradeRange}</span>
              ) : null}
              <div style={{ marginTop: "auto", paddingTop: "var(--space-4)" }}>
                <Button href={track.ctaHref} variant={track.featured ? "primary" : "secondary"} size="md" full>
                  {track.ctaLabel}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionSurface>
  );
}

async function TestimonialsSection({ data }: { data: TestimonialsData }) {
  const testimonials = await getPublicTestimonials(data.limit);
  if (testimonials.length === 0) return null;
  return (
    <SectionSurface tone={data.tone}>
      <SectionIntro eyebrow={data.eyebrow} headline={data.headline} body={data.body} tone={data.tone} variant="headline" />
      <div className={`bow-grid bow-grid-${Math.min(3, testimonials.length)}`} style={{ gap: "clamp(20px,3vw,40px)" }}>
        {testimonials.map((testimonial) => (
          <figure key={testimonial.id} style={{ margin: 0, display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <blockquote
              style={{
                fontFamily: "var(--font-editorial)",
                fontWeight: "var(--fw-medium)",
                fontSize: "var(--type-card)",
                lineHeight: 1.35,
                color: data.tone === "ink" ? "var(--bow-on-ink)" : undefined,
              }}
            >
              &ldquo;{testimonial.quote}&rdquo;
            </blockquote>
            <figcaption className="bow-data" style={{ fontSize: "var(--type-meta)", color: mutedColor(data.tone) }}>
              {testimonial.attribution}
            </figcaption>
          </figure>
        ))}
      </div>
    </SectionSurface>
  );
}

async function PressSection({ data }: { data: PressData }) {
  // Press is supporting credibility content, so a temporary query problem
  // degrades to the editor-authored empty state rather than taking down Home.
  const publications = await getPublicPublications().catch(() => []);
  return (
    <SectionSurface tone={data.tone} id="press">
      <SectionIntro eyebrow={data.eyebrow} headline={data.headline} body={data.body} tone={data.tone} />
      {publications.length === 0 ? (
        <p style={{ fontFamily: "var(--font-interface)", fontSize: 16, color: mutedColor(data.tone) }}>
          {data.emptyBody || "Verified coverage will appear here once it is published."}
        </p>
      ) : (
        <div className={`bow-grid bow-grid-${Math.min(3, publications.length)}`}>
          {publications.map((publication) => (
            <a
              key={publication.id}
              href={publication.articleUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="bow-card"
              style={{
                display: "flex",
                minHeight: 210,
                flexDirection: "column",
                gap: "var(--space-4)",
                padding: "24px 22px",
                border: "1px solid var(--border-rule)",
                borderTop: "3px solid var(--bow-blue)",
                background: data.tone === "ink" ? "var(--bow-dark-surface)" : "var(--bow-white)",
                color: data.tone === "ink" ? "var(--bow-on-ink)" : "var(--text-primary)",
              }}
            >
              {publication.logoUrl ? (
                // Logos are owner-supplied and may live on a publication's CDN.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={publication.logoUrl}
                  alt={`${publication.name} logo`}
                  style={{ display: "block", width: "auto", maxWidth: 180, height: 34, objectFit: "contain", objectPosition: "left center" }}
                />
              ) : (
                <span className="bow-display" style={{ fontSize: "var(--type-card)" }}>{publication.name}</span>
              )}
              <span style={{ fontFamily: "var(--font-editorial)", fontSize: 18, lineHeight: 1.35, flex: 1 }}>
                {publication.articleTitle}
              </span>
              <span className="bow-data" style={{ fontSize: "var(--type-meta)", color: mutedColor(data.tone) }}>
                {publication.publicationDate
                  ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
                      .format(new Date(`${publication.publicationDate}T00:00:00Z`))
                  : "Read coverage"}
              </span>
            </a>
          ))}
        </div>
      )}
    </SectionSurface>
  );
}

async function FaqSection({ data, context }: { data: FaqSectionData; context: SectionContext }) {
  const faqs = await getFaqsForScope("page", context.pageSlug);
  return (
    <SectionSurface tone={data.tone} id="faq">
      <SectionIntro eyebrow={data.eyebrow} headline={data.headline} body={data.body} tone={data.tone} />
      {faqs.length === 0 ? (
        <p style={{ fontFamily: "var(--font-interface)", fontSize: 16, color: mutedColor(data.tone) }}>
          {data.emptyBody || "No questions have been published for this page yet."}
        </p>
      ) : (
        <FaqList items={faqs.map((faq) => ({ id: faq.id, q: faq.question, a: faq.answer }))} />
      )}
    </SectionSurface>
  );
}

async function AnnouncementSection({ data, context }: { data: AnnouncementSectionData; context: SectionContext }) {
  const messages = data.source === "inline"
    ? (data.message ? [{ id: "inline", message: data.message, linkHref: data.linkHref || null, linkLabel: data.linkLabel || null }] : [])
    : await getLiveAnnouncements(context.pageSlug);
  if (messages.length === 0) return null;

  return (
    <SectionSurface tone={data.tone}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.map((entry) => (
          <div key={entry.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-4)" }}>
            <span style={{ fontFamily: "var(--font-interface)", fontSize: "var(--type-body)", color: data.tone === "ink" ? "var(--bow-on-ink)" : undefined }}>
              {entry.message}
            </span>
            {entry.linkHref ? (
              <Link href={entry.linkHref} className="bow-cta-link" style={{ color: data.tone === "ink" ? "#8fa4ff" : undefined }}>
                {entry.linkLabel || "Read more"}
              </Link>
            ) : null}
          </div>
        ))}
      </div>
    </SectionSurface>
  );
}
