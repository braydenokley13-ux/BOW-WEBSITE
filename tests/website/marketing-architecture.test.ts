import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  UPGRADE_PAGES,
  VERIFIED_PUBLICATIONS,
  containsRetiredMarketingContent,
  publishedArchitectureMatches,
} from "../../scripts/upgrade-marketing-architecture";

function page(slug: string) {
  const result = UPGRADE_PAGES.find((candidate) => candidate.slug === slug);
  assert.ok(result, `missing architecture page: ${slug}`);
  return result;
}

test("Home maps the approved copy into a concise CMS section architecture", () => {
  assert.deepEqual(page("home").sections.map((section) => section.kind), [
    "hero",
    "press",
    "text",
    "steps",
    "image_text",
    "list",
    "cta",
    "cta",
    "cta",
  ]);
  const serialized = JSON.stringify(page("home"));
  assert.doesNotMatch(serialized, /track_collection|testimonials|media_list|The Brief|STEP INTO THE FRONT OFFICE/i);
  assert.match(serialized, /Economics, taught through sports\./);
  assert.match(serialized, /Featured in/);
  assert.match(serialized, /A more concrete way to learn economics/);
  assert.match(serialized, /How a BOW lesson works/);
  assert.match(serialized, /Built around active participation/);
  assert.match(serialized, /Economics students can see/);
  assert.match(serialized, /Bring BOW to your students/);
  assert.match(serialized, /Looking for a class\?/);
  assert.match(serialized, /Bring BOW to your organization/);
});

test("Programs keeps available classes dynamic and contains no public Track catalog", () => {
  const serialized = JSON.stringify(page("programs"));
  assert.doesNotMatch(serialized, /track_collection|Track 101|Track 201|Track 301|about 30/i);
  assert.match(serialized, /Programs for Grades 5 to 8/);
  assert.match(serialized, /Classes open for registration/);
  assert.match(serialized, /No public classes are open right now/);
  assert.match(serialized, /Join the Interest List/);
  assert.match(serialized, /What happens in class/);
});

test("Partner With BOW is a required published architecture document", () => {
  assert.deepEqual(page("partner-with-bow").sections.map((section) => section.kind), [
    "hero",
    "list",
    "feature_cards",
    "list",
    "steps",
    "cta",
  ]);
});

test("navigation, footer, and new public copy do not carry the old marketing IA", () => {
  const navigation = page("system-navigation").sections[0]?.data as {
    items?: { label: string; href: string }[];
    primaryCtaLabel?: string;
    primaryCtaHref?: string;
  };
  assert.deepEqual(navigation.items?.map((item) => [item.label, item.href]), [
    ["Home", "/"],
    ["Programs", "/programs"],
    ["Partner With BOW", "/partner-with-bow"],
    ["About", "/about"],
    ["Teach", "/teach"],
  ]);
  assert.equal(navigation.primaryCtaLabel, "Bring BOW to Your Organization");
  assert.equal(navigation.primaryCtaHref, "/partner-with-bow");

  const footer = page("system-footer").sections[0]?.data as {
    tagline?: string;
    columns?: { heading: string; links: { label: string; href: string }[] }[];
  };
  assert.equal(footer.tagline, "Economics and financial literacy through sports");
  assert.deepEqual(footer.columns?.flatMap((column) =>
    column.links.map((link) => [column.heading, link.label, link.href])
  ), [
    ["Program", "Programs", "/programs"],
    ["Program", "Partner With BOW", "/partner-with-bow"],
    ["BOW", "About", "/about"],
    ["BOW", "Teach", "/teach"],
    ["BOW", "Contact", "/contact"],
    ["Account", "Sign In", "/sign-in"],
  ]);

  const serialized = JSON.stringify(UPGRADE_PAGES);
  assert.doesNotMatch(serialized, /—/);
  assert.doesNotMatch(serialized, /4 Press Mentions|AP Micro|AP Macro|grades 5 to 10|middle and high school/i);
});

test("approved page titles are stored on the CMS documents", () => {
  assert.equal(page("home").seoTitle, "BOW Sports Capital | Economics and Financial Literacy Through Sports");
  assert.equal(page("programs").seoTitle, "BOW Programs | Online Economics Programs for Grades 5 to 8");
  assert.equal(page("partner-with-bow").seoTitle, "Partner With BOW | Programs for Schools, Camps and Youth Organizations");
  assert.equal(page("about").seoTitle, "About BOW Sports Capital");
  assert.equal(page("teach").seoTitle, "Teach With BOW Sports Capital");
});

test("three verified publications seed the structure without hardcoding a visual count", () => {
  assert.deepEqual(VERIFIED_PUBLICATIONS.map((publication) => publication.name), [
    "The Jewish Link",
    "The Jewish Standard",
    "Yonkers Times",
  ]);
  assert.equal(page("home").sections.some((section) => section.kind === "press"), true);
});

test("News redirects to the anchor rendered by the Press section", () => {
  const newsRoute = readFileSync(path.join(process.cwd(), "app", "(marketing)", "news", "page.tsx"), "utf8");
  const renderer = readFileSync(path.join(process.cwd(), "components", "site", "sections", "SectionRenderer.tsx"), "utf8");
  assert.match(newsRoute, /redirect\("\/#press"\)/);
  assert.match(renderer, /<SectionSurface tone=\{data\.tone\} id="press">/);
});

test("Partner With BOW renders the existing inquiry flow below its CMS document", () => {
  const partnerRoute = readFileSync(
    path.join(process.cwd(), "app", "(marketing)", "partner-with-bow", "page.tsx"),
    "utf8",
  );
  assert.match(partnerRoute, /slug="partner-with-bow"/);
  assert.match(partnerRoute, /id="partnership-inquiry"/);
  assert.match(partnerRoute, /<PartnershipInquiryForm \/>/);
});

test("all top-level Track aliases redirect to Programs", () => {
  for (const slug of ["track-101", "track-201", "track-301"]) {
    const source = readFileSync(path.join(process.cwd(), "app", "(marketing)", slug, "page.tsx"), "utf8");
    assert.match(source, /redirect\("\/programs"\)/, slug);
  }
});

test("a marker cannot hide an incomplete or unpublished architecture", () => {
  const expected = ["hero", "press", "cta"];
  assert.equal(publishedArchitectureMatches({
    status: "published",
    publishedVersionId: "version-2",
    publishedState: "published",
    publishedSectionKinds: expected,
  }, expected), true);
  assert.equal(publishedArchitectureMatches({
    status: "draft",
    publishedVersionId: null,
    publishedState: null,
    publishedSectionKinds: [],
  }, expected), false);
  assert.equal(publishedArchitectureMatches({
    status: "published",
    publishedVersionId: "old-version",
    publishedState: "published",
    publishedSectionKinds: ["hero", "track_collection"],
  }, expected), false);
  assert.equal(containsRetiredMarketingContent("system-navigation", [{
    items: [{ label: "Get Involved", href: "/get-involved" }],
    primaryCtaLabel: "Find a Program",
  }]), true);
  assert.equal(containsRetiredMarketingContent("system-navigation", page("system-navigation").sections.map((section) => section.data)), false);
});
