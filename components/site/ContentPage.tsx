import ContentNotice from "@/components/site/ContentNotice";
import SectionRenderer from "@/components/site/sections/SectionRenderer";
import { getGlobalSettings, getPageDocument, type PageDocument } from "@/lib/cms/read";
import { describe, notice, type ContentNotice as Notice } from "@/lib/cms/errors";
import { previewEnabled, staffDiagnosticsEnabled } from "@/lib/cms/preview";
import { DEFAULT_GLOBAL_SETTINGS, type GlobalSettingsData } from "@/lib/cms/sections";
import type { ReactNode } from "react";

/**
 * Render a content-managed page by slug.
 *
 * This is the whole public rendering path: resolve the document (published, or
 * the draft when an authorized founder is in preview), then hand its sections
 * to the renderer. Three outcomes, none of which is a crash:
 *
 *   - sections exist            → the page
 *   - nothing published yet     → a "not published" state, not a 500
 *   - the read failed           → the specific reason, from `classifyError`
 *
 * The load is deliberately separated from the markup: catching around JSX
 * would not catch anything anyway (React renders it later), and it would hide
 * a genuine render bug behind a "content unavailable" message.
 *
 * `extras` lets a route append a hand-built region that isn't (yet) modelled
 * as a section — a live form, for example — beneath the managed sections.
 */
type Loaded =
  | { ok: true; document: PageDocument; settings: GlobalSettingsData }
  | { ok: false; notice: Notice };

async function loadPage(slug: string): Promise<Loaded> {
  const staff = await staffDiagnosticsEnabled();
  const preview = await previewEnabled();

  let settings = DEFAULT_GLOBAL_SETTINGS;
  try {
    settings = await getGlobalSettings({ preview });
  } catch {
    /* fall through with defaults; the page body below reports the real failure */
  }

  try {
    const document = await getPageDocument(slug, { preview });
    if (!document) {
      return { ok: false, notice: notice("no_published_content", { staff, detail: `page slug "${slug}"` }) };
    }
    if (document.sections.length === 0) {
      return {
        ok: false,
        notice: notice("no_published_content", {
          staff,
          detail: `page "${slug}" has no visible sections`,
          overrides: {
            title: "This page is still being written.",
            body: "There’s nothing to show here yet — check back shortly.",
          },
        }),
      };
    }
    return { ok: true, document, settings };
  } catch (error) {
    return { ok: false, notice: describe(error, { staff }) };
  }
}

export default async function ContentPage({
  slug,
  screenLabel,
  extras,
}: {
  slug: string;
  screenLabel?: string;
  extras?: ReactNode;
}) {
  const result = await loadPage(slug);

  if (!result.ok) {
    return (
      <div id="main" data-screen-label={screenLabel ?? slug}>
        <ContentNotice notice={result.notice} />
      </div>
    );
  }

  return (
    <div id="main" data-screen-label={screenLabel ?? result.document.name}>
      <SectionRenderer
        sections={result.document.sections}
        context={{ pageSlug: result.document.slug, defaultEmptyStateText: result.settings.defaultEmptyStateText }}
      />
      {extras}
    </div>
  );
}
