/* ============================================================
 * Page metadata from content.
 *
 * SEO title, description, and the social-sharing image are founder-edited
 * fields on a page's *published* version, with site-wide defaults from Global
 * Settings underneath. Metadata generation is the one place a draft could leak
 * into a public HTML response, so it reads published rows only — never the
 * preview variant — and drafts are additionally marked `noindex`.
 *
 * Every function here is failure-tolerant. A page whose database is briefly
 * unreachable still returns valid metadata built from defaults; a `<head>` is
 * not worth a 500.
 *
 * Server-only.
 * ============================================================ */

import "server-only";

import type { Metadata } from "next";
import { getGlobalSettings, getPageDocument } from "@/lib/cms/read";
import { DEFAULT_GLOBAL_SETTINGS } from "@/lib/cms/sections";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://bowsportscapital.com").replace(/\/+$/, "");

function applyPattern(pattern: string, title: string): string {
  if (!title) return pattern.replace("%s", "").replace(/^\s*[·|-]\s*/, "").trim();
  return pattern.includes("%s") ? pattern.replace("%s", title) : `${title} ${pattern}`.trim();
}

export interface MetadataOverrides {
  title?: string;
  description?: string;
  imageUrl?: string;
  /** Canonical path, e.g. `/programs/track-101`. */
  path?: string;
  noindex?: boolean;
}

/**
 * Build metadata for a content-managed page.
 *
 * `overrides` lets offering routes (a program, a track) supply their own
 * record-level SEO fields while still inheriting the site defaults.
 */
export async function contentMetadata(slug: string | null, overrides: MetadataOverrides = {}): Promise<Metadata> {
  let settings = DEFAULT_GLOBAL_SETTINGS;
  let pageTitle = "";
  let pageDescription = "";
  let pageImage = "";
  let noindex = false;

  try {
    settings = await getGlobalSettings();
  } catch {
    /* defaults already in place */
  }

  if (slug) {
    try {
      const document = await getPageDocument(slug);
      if (document) {
        pageTitle = document.seoTitle || document.title || document.name || "";
        pageDescription = document.seoDescription || "";
        pageImage = document.socialImageUrl || "";
        noindex = document.noindex;
      } else {
        // Nothing published at this slug: whatever renders is an empty state,
        // which must not be indexed as if it were the real page.
        noindex = true;
      }
    } catch {
      noindex = true;
    }
  }

  const title = overrides.title || pageTitle || settings.defaultSeoTitle || settings.organizationName;
  const description =
    overrides.description || pageDescription || settings.defaultSeoDescription || settings.organizationDescription || "";
  const image = overrides.imageUrl || pageImage || settings.defaultSocialImage || "/bow-social-preview.png";
  const url = overrides.path ? `${SITE_URL}${overrides.path}` : SITE_URL;
  const hide = overrides.noindex ?? noindex;

  return {
    title: applyPattern(settings.seoTitlePattern, title),
    description,
    alternates: overrides.path ? { canonical: url } : undefined,
    robots: hide ? { index: false, follow: false } : undefined,
    openGraph: {
      type: "website",
      siteName: settings.organizationName,
      title,
      description,
      url,
      images: [{ url: image, width: 1200, height: 630, alt: settings.organizationName }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}
