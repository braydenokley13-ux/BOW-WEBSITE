import Link from "next/link";
import { Badge, Button } from "@/components/ds";
import ContentNotice from "@/components/site/ContentNotice";
import FaqList from "@/components/site/FaqList";
import SectionRenderer from "@/components/site/sections/SectionRenderer";
import { Paragraphs } from "@/components/site/sections/shell";
import { formatDeliveryFormat } from "@/components/site/OfferingCard";
import { getProgramForPreview, getPublicProgramBySlug, type PublicProgram } from "@/lib/cms/offerings";
import { getFaqsForScope, getGlobalSettings, getPageDocument, type PageDocument, type SiteFaq } from "@/lib/cms/read";
import { contentMetadata } from "@/lib/cms/metadata";
import { describe, notice, type ContentNotice as Notice } from "@/lib/cms/errors";
import { previewEnabled, staffDiagnosticsEnabled } from "@/lib/cms/preview";
import { REGISTRATION_STATUS_LABELS } from "@/lib/cms/status";
import { DEFAULT_GLOBAL_SETTINGS, type GlobalSettingsData } from "@/lib/cms/sections";

/**
 * A program's public page.
 *
 * Every fact on it — grades, format, dates, price, what students do, what the
 * button says — is a field on the program record, edited at
 * /app/website/programs. The call to action is derived from the program's
 * registration status rather than written by hand, so the words and the
 * behaviour cannot disagree.
 *
 * The `[id]` segment accepts either the founder-set public slug or the
 * program's internal id, so links shared before slugs existed keep working.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const program = await getPublicProgramBySlug(id);
    if (!program) return contentMetadata(null, { title: "Program", noindex: true });
    return contentMetadata(`program-${program.slug}`, {
      title: program.seoTitle || program.title,
      description: program.seoDescription || program.shortDescription,
      imageUrl: program.socialImageUrl || program.imageUrl,
      path: `/programs/p/${program.slug}`,
    });
  } catch {
    return contentMetadata(null, { title: "Program", noindex: true });
  }
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function formatTime(value: string | null): string | null {
  if (!value) return null;
  const [hourStr, minuteStr] = value.split(":");
  const hour = Number(hourStr);
  if (!Number.isFinite(hour)) return null;
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}${minuteStr && minuteStr !== "00" ? `:${minuteStr}` : ""} ${suffix}`;
}

type Loaded =
  | { ok: true; program: PublicProgram; document: PageDocument | null; faqs: SiteFaq[]; settings: GlobalSettingsData }
  | { ok: false; notice: Notice };

async function loadProgram(idOrSlug: string): Promise<Loaded> {
  const staff = await staffDiagnosticsEnabled();
  const preview = await previewEnabled();
  try {
    const program = preview ? await getProgramForPreview(idOrSlug) : await getPublicProgramBySlug(idOrSlug);
    if (!program) {
      return { ok: false, notice: notice("program_not_found", { staff, detail: `program "${idOrSlug}"` }) };
    }
    const [document, faqs, settings] = await Promise.all([
      getPageDocument(`program-${program.slug}`, { preview }),
      getFaqsForScope("program", program.slug),
      getGlobalSettings({ preview }).catch(() => DEFAULT_GLOBAL_SETTINGS),
    ]);
    return { ok: true, program, document, faqs, settings };
  } catch (error) {
    return { ok: false, notice: describe(error, { staff }) };
  }
}

/** The facts panel — everything a family needs before deciding, in one grid. */
function programFacts(program: PublicProgram): { label: string; value: string }[] {
  const facts: { label: string; value: string }[] = [];
  if (program.gradeRange) facts.push({ label: "Grades", value: program.gradeRange });
  if (program.deliveryFormat) facts.push({ label: "Format", value: formatDeliveryFormat(program.deliveryFormat) });
  if (program.locationLabel) facts.push({ label: "Where", value: program.locationLabel });

  const start = formatDate(program.startDate);
  const end = formatDate(program.endDate);
  const startTime = formatTime(program.startTime);
  const endTime = formatTime(program.endTime);
  const schedule = [
    start ? (end && end !== start ? `${start} \u2013 ${end}` : start) : "",
    program.scheduleLabel,
    startTime
      ? [endTime ? `${startTime} \u2013 ${endTime}` : startTime, program.timezone].filter(Boolean).join(" ")
      : "",
  ].filter(Boolean).join(" \u00b7 ");
  if (schedule) {
    facts.push({
      label: "Schedule",
      value: schedule,
    });
  }
  if (program.sessionCount) {
    facts.push({
      label: "Sessions",
      value: program.sessionLengthMinutes
        ? `${program.sessionCount} sessions \u00b7 ${program.sessionLengthMinutes} min each`
        : `${program.sessionCount} sessions`,
    });
  }
  if (program.isFree) facts.push({ label: "Cost", value: program.priceNote || "Free" });
  else if (program.priceLabel) facts.push({ label: "Cost", value: [program.priceLabel, program.priceNote].filter(Boolean).join(" \u00b7 ") });
  if (program.capacity !== null) {
    facts.push({
      label: "Capacity",
      value: program.seatsRemaining !== null && program.registrationStatus === "registration_open"
        ? `${program.capacity} students \u00b7 ${program.seatsRemaining} left`
        : `${program.capacity} students`,
    });
  }
  return facts;
}

export default async function PublicProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadProgram(id);

  if (!result.ok) return <ContentNotice notice={result.notice} />;
  const { program, document, faqs, settings } = result;
  const facts = programFacts(program);
  const { cta } = program;

  return (
    <div id="main" data-screen-label={program.title}>
      <section className="bow-section bow-section-paper" style={{ borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container">
          <Link href="/programs" style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
            ← All Programs
          </Link>
          <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <Badge
              status={
                program.registrationStatus === "registration_open"
                  ? "positive"
                  : program.registrationStatus === "full"
                    ? "warning"
                    : "info"
              }
            >
              {REGISTRATION_STATUS_LABELS[program.registrationStatus]}
            </Badge>
          </div>
          <h1
            style={{
              margin: "14px 0 0",
              fontFamily: "var(--font-editorial)",
              fontWeight: 600,
              fontSize: "clamp(32px,4.6vw,60px)",
              lineHeight: 1,
              letterSpacing: "-0.015em",
              maxWidth: "20ch",
              textWrap: "balance",
            }}
          >
            {program.title}
          </h1>
          <p className="bow-lead" style={{ margin: "var(--space-6) 0 0", maxWidth: "56ch" }}>
            A live online BOW program for students in Grades {program.gradeRange || "the listed grade range"}.
          </p>

          <div className="bow-actions" style={{ marginTop: "var(--space-8)" }}>
            {cta.behavior === "disabled" ? (
              <Button variant="secondary" size="lg" disabled>{cta.label}</Button>
            ) : cta.href ? (
              <Button href={cta.href} variant={cta.behavior === "register" ? "primary" : "secondary"} size="lg">
                {cta.label}
              </Button>
            ) : null}
            {cta.secondary ? (
              <Button href={cta.secondary.href} variant="secondary" size="lg">{cta.secondary.label}</Button>
            ) : null}
          </div>
          {cta.explanation ? (
            <p style={{ margin: "14px 0 0", fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.6, color: "var(--text-secondary)", maxWidth: "60ch" }}>
              {cta.explanation}
            </p>
          ) : null}
        </div>
      </section>

      {facts.length > 0 ? (
        <section className="bow-section bow-section-tight">
          <div className="bow-container">
            <div className="bow-grid bow-grid-ruled" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
              {facts.map((fact) => (
                <div key={fact.label} style={{ background: "var(--bow-white)", padding: "20px 18px", display: "flex", flexDirection: "column", gap: 6 }}>
                  <span className="bow-eyebrow-data" style={{ color: "var(--text-secondary)" }}>{fact.label}</span>
                  <span style={{ fontFamily: "var(--font-interface)", fontWeight: "var(--fw-semibold)", fontSize: "var(--type-body)" }}>{fact.value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {[
        { heading: "What students will do", body: program.longDescription || program.shortDescription },
        { heading: "What students will study", body: program.curriculumSummary },
        { heading: "What students take away", body: program.learningGoals },
        { heading: "What a session looks like", body: program.studentExperience },
      ]
        .filter((block) => block.body.trim())
        .map((block, index) => (
          <section key={block.heading} className={index % 2 === 0 ? "bow-section" : "bow-section bow-section-paper"}>
            <div className="bow-container">
              <div className="bow-section-intro bow-section-intro-wide" style={{ marginBottom: 0 }}>
                <h2 className="bow-headline">{block.heading}</h2>
                <Paragraphs text={block.body} className="bow-lead" />
              </div>
            </div>
          </section>
        ))}

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
              <h2 className="bow-display">About this program</h2>
            </div>
            <FaqList items={faqs.map((faq) => ({ id: faq.id, q: faq.question, a: faq.answer }))} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
