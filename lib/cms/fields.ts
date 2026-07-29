/* ============================================================
 * Editor field descriptors — how each section is presented to the founder.
 *
 * `lib/cms/sections.ts` says what a section *is*; this file says what it looks
 * like to edit. The two are deliberately separate: the schema protects the
 * database, these descriptors protect the person.
 *
 * The rule this file exists to enforce: the founder never sees a key name, a
 * JSON blob, a colour value, or a component name. They see "Headline",
 * "Kicker (small label above the headline)", and a dropdown of named surfaces.
 * If a field cannot be expressed that way, it does not belong in the editor.
 *
 * Browser-safe.
 * ============================================================ */

import { TONES, type SectionKind } from "@/lib/cms/sections";

export type FieldType =
  | "text"
  | "textarea"
  | "richtext"
  | "select"
  | "boolean"
  | "number"
  | "image"
  | "strings"
  | "repeater";

export interface FieldSpec {
  name: string;
  label: string;
  type: FieldType;
  help?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  /** For `repeater`: the shape of one row. */
  itemFields?: FieldSpec[];
  /** For `repeater`: what one row is called, e.g. "card". */
  itemNoun?: string;
}

const toneField: FieldSpec = {
  name: "tone",
  label: "Background",
  type: "select",
  help: "Which surface this section sits on.",
  options: [
    { value: "paper", label: "Paper (light grey)" },
    { value: "white", label: "White" },
    { value: "raised", label: "Raised" },
    { value: "ink", label: "Ink (dark)" },
    { value: "blue", label: "Blue (campaign)" },
  ].filter((option) => (TONES as readonly string[]).includes(option.value)),
};

const eyebrow: FieldSpec = {
  name: "eyebrow",
  label: "Kicker",
  type: "text",
  help: "The small label above the heading. Optional.",
};

const headline = (label = "Heading"): FieldSpec => ({ name: "headline", label, type: "text" });

const body: FieldSpec = {
  name: "body",
  label: "Paragraph",
  type: "richtext",
  help: "Leave a blank line between paragraphs.",
};

const actionsField: FieldSpec = {
  name: "actions",
  label: "Buttons",
  type: "repeater",
  itemNoun: "button",
  itemFields: [
    { name: "label", label: "Button text", type: "text" },
    { name: "href", label: "Goes to", type: "text", placeholder: "/programs", help: "A page on this site (starts with /) or a full web address." },
    {
      name: "variant",
      label: "Style",
      type: "select",
      options: [
        { value: "primary", label: "Primary" },
        { value: "secondary", label: "Secondary" },
        { value: "ink", label: "Dark" },
      ],
    },
  ],
};

const linkRepeater = (name: string, label: string, noun: string): FieldSpec => ({
  name,
  label,
  type: "repeater",
  itemNoun: noun,
  itemFields: [
    { name: "label", label: "Text", type: "text" },
    { name: "href", label: "Goes to", type: "text", placeholder: "/about" },
  ],
});

const FIELDS: Record<SectionKind, FieldSpec[]> = {
  hero: [
    eyebrow,
    headline(),
    body,
    toneField,
    { name: "ghostText", label: "Watermark text", type: "text", help: "Large faded text behind the section. Optional — keep it short." },
    { name: "note", label: "Small print", type: "text", help: "One line under the buttons. Optional." },
    actionsField,
  ],
  text: [eyebrow, headline(), body, toneField],
  feature_cards: [
    eyebrow,
    headline(),
    body,
    toneField,
    { name: "columns", label: "Cards per row", type: "number", help: "2, 3, or 4." },
    {
      name: "groups",
      label: "Card groups",
      type: "repeater",
      itemNoun: "group",
      itemFields: [
        { name: "label", label: "Group label", type: "text", help: "Optional heading above this group of cards." },
        {
          name: "cards",
          label: "Cards",
          type: "repeater",
          itemNoun: "card",
          itemFields: [
            { name: "title", label: "Card title", type: "text" },
            { name: "body", label: "Card text", type: "textarea" },
            { name: "ctaLabel", label: "Link text", type: "text" },
            { name: "href", label: "Goes to", type: "text", placeholder: "/programs" },
          ],
        },
      ],
    },
  ],
  stats: [
    eyebrow,
    headline(),
    body,
    toneField,
    {
      name: "items",
      label: "Numbers",
      type: "repeater",
      itemNoun: "number",
      itemFields: [
        { name: "value", label: "Number", type: "text", placeholder: "30" },
        { name: "label", label: "What it counts", type: "text", placeholder: "Students in current programs" },
      ],
    },
  ],
  program_collection: [
    eyebrow,
    headline(),
    body,
    toneField,
    { name: "limit", label: "How many to show", type: "number", help: "0 shows every published program." },
    { name: "featuredOnly", label: "Featured programs only", type: "boolean" },
    { name: "programSlugs", label: "Or pick specific programs", type: "strings", help: "Program web addresses, one per line. Leave empty to show them automatically." },
    { name: "showAllLabel", label: "“See all” button text", type: "text" },
    { name: "showAllHref", label: "“See all” goes to", type: "text", placeholder: "/programs" },
    { name: "hideWhenEmpty", label: "Hide this section when no programs are open", type: "boolean" },
    { name: "emptyHeadline", label: "Empty state heading", type: "text", help: "Shown when nothing is open." },
    { name: "emptyBody", label: "Empty state text", type: "textarea" },
    { name: "emptyActionLabel", label: "Empty state button text", type: "text" },
    { name: "emptyActionHref", label: "Empty state button goes to", type: "text" },
  ],
  track_collection: [
    eyebrow,
    headline(),
    body,
    toneField,
    {
      name: "layout",
      label: "Layout",
      type: "select",
      options: [
        { value: "compare", label: "Side-by-side comparison" },
        { value: "grid", label: "Grid" },
      ],
    },
    { name: "trackSlugs", label: "Which tracks", type: "strings", help: "Track web addresses, one per line (e.g. track-101). Leave empty for all published tracks." },
    { name: "emptyHeadline", label: "Empty state heading", type: "text" },
    { name: "emptyBody", label: "Empty state text", type: "textarea" },
  ],
  testimonials: [eyebrow, headline(), body, toneField, { name: "limit", label: "How many quotes", type: "number" }],
  faq: [
    eyebrow,
    headline(),
    body,
    toneField,
    { name: "emptyBody", label: "Text when no questions are assigned", type: "textarea", help: "Assign questions to this page under Website → FAQs." },
  ],
  cta: [
    eyebrow,
    headline(),
    body,
    toneField,
    { name: "ghostText", label: "Watermark text", type: "text" },
    actionsField,
  ],
  announcement: [
    {
      name: "source",
      label: "Where the message comes from",
      type: "select",
      options: [
        { value: "live", label: "The live announcements list" },
        { value: "inline", label: "A one-off message on this page" },
      ],
    },
    { name: "message", label: "Message", type: "textarea", help: "Only used for a one-off message." },
    { name: "linkLabel", label: "Link text", type: "text" },
    { name: "linkHref", label: "Link goes to", type: "text" },
    toneField,
  ],
  steps: [
    eyebrow,
    headline(),
    body,
    toneField,
    {
      name: "style",
      label: "Layout",
      type: "select",
      options: [
        { value: "grid", label: "Grid of steps" },
        { value: "list", label: "Stacked list" },
        { value: "spec", label: "Specification table" },
      ],
    },
    {
      name: "items",
      label: "Steps",
      type: "repeater",
      itemNoun: "step",
      itemFields: [
        { name: "number", label: "Number", type: "text", placeholder: "01" },
        { name: "label", label: "Step name", type: "text" },
        { name: "body", label: "Description", type: "textarea" },
        { name: "detail", label: "Right-hand detail", type: "text", help: "Used by the specification layout." },
        { name: "emphasis", label: "Highlight this step", type: "boolean" },
      ],
    },
  ],
  image_text: [
    eyebrow,
    headline(),
    body,
    toneField,
    { name: "imageUrl", label: "Image", type: "image" },
    { name: "imageAlt", label: "Image description", type: "text", help: "Describes the image for screen readers." },
    {
      name: "imagePosition",
      label: "Image position",
      type: "select",
      options: [
        { value: "right", label: "Right of the text" },
        { value: "left", label: "Left of the text" },
      ],
    },
    { name: "bullets", label: "Bullet points", type: "strings", help: "One per line." },
    actionsField,
  ],
  contact: [
    eyebrow,
    headline(),
    body,
    toneField,
    { name: "email", label: "Email address", type: "text" },
    { name: "phone", label: "Phone", type: "text" },
    { name: "location", label: "Based in", type: "text" },
    { name: "formIntro", label: "Text above the form", type: "textarea" },
    { name: "showForm", label: "Show the contact form", type: "boolean" },
  ],
  list: [
    eyebrow,
    headline(),
    body,
    toneField,
    {
      name: "style",
      label: "Layout",
      type: "select",
      options: [
        { value: "chips", label: "Pills" },
        { value: "rows", label: "Bulleted rows" },
        { value: "numbered", label: "Numbered rows" },
      ],
    },
    { name: "items", label: "Items", type: "strings", help: "One per line." },
  ],
  decision_demo: [
    eyebrow,
    headline(),
    body,
    toneField,
    { name: "desk", label: "Panel label", type: "text", placeholder: "Decision Desk" },
    { name: "round", label: "Round label", type: "text", placeholder: "Round 03 · The Extension" },
    { name: "prompt", label: "The situation", type: "textarea" },
    { name: "primaryLabel", label: "Button text", type: "text" },
    {
      name: "meta",
      label: "Side facts",
      type: "repeater",
      itemNoun: "fact",
      itemFields: [
        { name: "label", label: "Label", type: "text" },
        { name: "value", label: "Value", type: "text" },
      ],
    },
    {
      name: "facts",
      label: "Data panel",
      type: "repeater",
      itemNoun: "row",
      itemFields: [
        { name: "label", label: "Label", type: "text" },
        { name: "value", label: "Value", type: "text" },
        {
          name: "tone",
          label: "Emphasis",
          type: "select",
          options: [
            { value: "neutral", label: "Neutral" },
            { value: "positive", label: "Good" },
            { value: "warning", label: "Caution" },
            { value: "negative", label: "Bad" },
          ],
        },
      ],
    },
    { name: "unknowns", label: "Unknowns", type: "strings", help: "One per line." },
    {
      name: "options",
      label: "Choices",
      type: "repeater",
      itemNoun: "choice",
      itemFields: [
        { name: "id", label: "Reference", type: "text", help: "A short word used to match this choice to its outcome, e.g. trade." },
        { name: "label", label: "Choice", type: "text" },
        { name: "detail", label: "Detail", type: "textarea" },
      ],
    },
    {
      name: "outcomes",
      label: "Outcomes",
      type: "repeater",
      itemNoun: "outcome",
      itemFields: [
        { name: "optionId", label: "For which choice", type: "text", help: "Must match a choice reference above." },
        {
          name: "status",
          label: "How it went",
          type: "select",
          options: [
            { value: "positive", label: "Well" },
            { value: "warning", label: "Mixed" },
            { value: "negative", label: "Badly" },
          ],
        },
        { name: "headline", label: "Result heading", type: "text" },
        { name: "body", label: "What happened", type: "textarea" },
      ],
    },
  ],
  media_list: [
    eyebrow,
    headline(),
    body,
    toneField,
    actionsField,
    {
      name: "items",
      label: "Entries",
      type: "repeater",
      itemNoun: "entry",
      itemFields: [
        { name: "tag", label: "Tag", type: "text", placeholder: "EP 07" },
        { name: "kicker", label: "Category", type: "text" },
        { name: "title", label: "Title", type: "text" },
        { name: "meta", label: "Detail line", type: "text" },
        { name: "href", label: "Goes to", type: "text" },
      ],
    },
  ],
  nav_menu: [
    {
      name: "items",
      label: "Menu items",
      type: "repeater",
      itemNoun: "menu item",
      itemFields: [
        { name: "label", label: "Text", type: "text" },
        { name: "href", label: "Goes to", type: "text", placeholder: "/programs" },
        { name: "visible", label: "Show in the menu", type: "boolean" },
        {
          name: "children",
          label: "Dropdown links",
          type: "repeater",
          itemNoun: "dropdown link",
          itemFields: [
            { name: "label", label: "Text", type: "text" },
            { name: "href", label: "Goes to", type: "text" },
            { name: "visible", label: "Show", type: "boolean" },
          ],
        },
      ],
    },
    { name: "signInLabel", label: "Sign-in link text", type: "text" },
    { name: "signInHref", label: "Sign-in link goes to", type: "text" },
    { name: "primaryCtaLabel", label: "Main button text", type: "text" },
    { name: "primaryCtaHref", label: "Main button goes to", type: "text" },
    { name: "secondaryCtaLabel", label: "Second button text (mobile menu)", type: "text" },
    { name: "secondaryCtaHref", label: "Second button goes to", type: "text" },
  ],
  footer_columns: [
    { name: "tagline", label: "Wordmark subtitle", type: "text" },
    { name: "description", label: "Footer description", type: "textarea" },
    { name: "contactText", label: "Contact line", type: "text" },
    {
      name: "columns",
      label: "Link columns",
      type: "repeater",
      itemNoun: "column",
      itemFields: [
        { name: "heading", label: "Column heading", type: "text" },
        linkRepeater("links", "Links", "link"),
      ],
    },
    linkRepeater("socialLinks", "Social links", "social link"),
    linkRepeater("legalLinks", "Legal links", "legal link"),
    { name: "baseNote", label: "Bottom line", type: "text" },
  ],
  global_settings: [
    { name: "organizationName", label: "Organisation name", type: "text" },
    { name: "organizationDescription", label: "Short description", type: "textarea", help: "Used as the default description for search and social sharing." },
    { name: "primaryAnnouncement", label: "Primary announcement", type: "text", help: "Optional one-liner. For scheduled announcements use Website → Announcements." },
    { name: "primaryAnnouncementHref", label: "Announcement links to", type: "text" },
    { name: "defaultSocialImage", label: "Default sharing image", type: "image" },
    { name: "supportEmail", label: "Support email shown publicly", type: "text" },
    { name: "defaultRegistrationExplanation", label: "Default registration explanation", type: "textarea", help: "Shown on a program that has no explanation of its own." },
    { name: "defaultInterestListExplanation", label: "Default interest-list explanation", type: "textarea" },
    { name: "defaultEmptyStateText", label: "Default empty-state text", type: "textarea", help: "Shown when a list of programs has nothing in it." },
    { name: "seoTitlePattern", label: "Page title pattern", type: "text", help: "Use %s where the page name should appear." },
    { name: "defaultSeoTitle", label: "Default page title", type: "text" },
    { name: "defaultSeoDescription", label: "Default page description", type: "textarea" },
    { name: "primaryCtaLabel", label: "Site-wide button text", type: "text" },
    { name: "primaryCtaHref", label: "Site-wide button goes to", type: "text" },
    { name: "contactEmail", label: "Public contact email", type: "text" },
    { name: "contactPhone", label: "Public contact phone", type: "text" },
    { name: "contactLocation", label: "Public location", type: "text" },
  ],
};

export function sectionFields(kind: SectionKind): FieldSpec[] {
  return FIELDS[kind] ?? [];
}
