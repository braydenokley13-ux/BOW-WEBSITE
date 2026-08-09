# The site content system

Everything a public visitor reads is a database record the founder edits at
**BOW HQ → Website**. This document is the operator's guide: how to deploy it,
how publishing works, and what to do when a page misbehaves.

## Deploying

Two commands, in this order, both safe to re-run:

```bash
# 1. Schema. Forward-only, transactional, tracked in `schema_migrations`.
#    Uses POSTGRES_URL_NON_POOLING (Supabase's direct/session URL, port 5432)
#    because DDL through the transaction pooler is unreliable.
npm run migrate

# 2. Content. Seeds missing records, then performs the one-time partner-site
#    architecture upgrade. Re-running does not replace founder edits.
npm run content:bootstrap
```

`npm run db:deploy` runs both.

Against production, pull the real credentials first and run from a machine that
can reach the database directly:

```bash
vercel env pull .env.local          # provides POSTGRES_URL_NON_POOLING
npm run migrate
npm run content:bootstrap
```

Neither command drops, truncates, or resets anything. There is no destructive
path in either one; `npm run db:setup` (which does build a database from empty)
refuses to run against a non-loopback host unless `ALLOW_REMOTE_DB_SETUP=1` is
set explicitly.

To see what the content step would do without writing:

```bash
npm run content:bootstrap -- --dry-run
```

## How publishing works

A document — a page, a track page, a program page, or one of the three
singletons (navigation, footer, global settings) — has at most one **published**
version and at most one **draft**.

| Action | What happens |
| --- | --- |
| Open the editor | Reads the existing draft, or the published version when no draft exists. Opening a page never writes to the database |
| Change a field | Keeps the change in the browser and marks the page **Unsaved**. The public site is unchanged |
| Save draft | Validates the whole page, creates a draft on the first save if needed, then writes all editable fields together |
| Preview | Renders the saved draft with the real public route and components, behind two gates (see below) |
| Publish | The draft becomes the published version; the previous one is marked `superseded` and kept |
| Discard draft | Deletes the working copy. The published version was never touched, so this is instant and lossless |
| Restore a version | Copies an earlier version into a new draft to review, then publish |
| Unpublish | Sets the page's status to `draft`. It disappears publicly. Every version survives |

Because publishing is a pointer move rather than an overwrite, rollback never
depends on a backup.

## Preview is gated twice

1. Next's Draft Mode cookie must be set. Only `/api/website/preview` can set it,
   and that route checks the caller is an admin **before** calling `enable()`.
2. The request must still carry an admin session.

A preview link copied to a signed-out browser therefore shows the published
site, not the draft. There is a test for exactly this.

## What is editable, and what stays in code

Editable: marketing copy, headings, buttons and their destinations, navigation,
footer, FAQs, announcements, SEO titles and descriptions, social-sharing
images, empty-state wording, registration and interest-list explanations. The
Press editor also controls publication name, logo, article title, article URL,
date, status, and display order.

Not editable, on purpose:

- **Layout, spacing, colour, and component choice.** React owns every pixel.
  Presentation fields are filtered out of the owner editor, and there is no
  free-form HTML or raw JSON control.
- **Page section structure.** The submitted section count, order, and kinds must
  exactly match the code-backed page document. Direct Server Action requests
  cannot add, remove, hide, reorder, or restyle public sections.
- **Shared functional labels** — "Save", "Cancel", "Sign in".
- **Anything secret.** Global Settings holds public contact details and default
  copy. API keys, connection strings, and mail credentials stay in the
  deployment environment and are never surfaced in this system.

## Statuses

Publication status (page, track, program): **Draft**, **Published**,
**Archived**. Only `Published` is publicly readable, and that filter is applied
in SQL — draft content cannot reach a page, a sitemap, or page metadata.

The primary marketing architecture is Home, Programs, Partner With BOW, About,
Teach, and Contact. The Podcast record is retained honestly but hidden from the
primary Website list while complete audio is unavailable. Old track marketing
documents and superseded lead-generation pages remain preserved for history,
but are hidden from the public sitemap and primary editor. Their public routes
redirect to Programs or Partner With BOW. Internal curriculum publication is a
separate system and is not changed by this marketing cutover.

Registration status (program) drives the call to action. The founder never
writes the button behaviour by hand:

| Status | Public button |
| --- | --- |
| Coming Soon | No signup. Interest list offered if enabled |
| Registration Open | Active **Register** |
| Interest List | Active **Join the Interest List** |
| Full | Disabled **Program Full**, plus the interest list if enabled |
| Registration Closed | Disabled **Registration Closed** |
| Completed | No call to action at all |

A program whose confirmed registrations reach its capacity presents as **Full**
even if nobody has updated its status. The wording of any of these can be
overridden per program; the behaviour underneath does not change, and the
registration route re-checks the status server-side before accepting a
submission.

`programs.is_public` / `programs.public_status` (the pre-existing pair) are kept
in step with the two explicit columns by a database trigger, so older admin
screens and the registration engine keep working unchanged.

## When something looks wrong

Public pages never show a generic apology. Each situation has its own state —
"no programs are open", "we couldn't find that track", "this page isn't
published yet", "registration isn't open for this one", and so on.

Signed-in staff additionally see a **diagnostic line** on fault states carrying
the reason code and, for a Postgres error, its SQLSTATE and the relation
involved. The most common one:

> `schema_out_of_date · SQLSTATE 42P01 · waitlist_offers`
> The database is missing a table or column this build expects. Apply pending
> migrations with `npm run migrate`.

That line is built from a fixed allow-list of fields, so it can never contain a
connection string, a credential, SQL text, or row data. Visitors see the same
title and body with no diagnostic.

## Row Level Security

The application connects as the database owner and is not subject to RLS;
authorization for every write lives in `lib/cms/admin.ts` behind
`requireWebsiteEditor()`. The RLS policies govern the other door — Supabase's
PostgREST endpoint, reachable from any browser with the publishable anon key:

- `anon` and `authenticated` may `SELECT` **published** rows only, from
  `site_pages`, `site_page_versions`, `site_page_sections`, `site_faqs`,
  `site_faq_placements`, `site_announcements`, `site_publications`,
  `testimonials`, and `news_items`.
- No write policy exists for either role, and `INSERT`/`UPDATE`/`DELETE` are
  revoked outright, so a future policy mistake cannot open a write path.

## Adding a page or section

1. Define or extend its typed public shape in `lib/cms/sections.ts`.
2. Add the owner-facing editorial fields in `lib/cms/fields.ts`. Mark design-only
   fields as `presentation: true` so the editor cannot expose them.
3. Render the section in `components/site/sections/SectionRenderer.tsx`.
4. Add the page document to `scripts/upgrade-marketing-architecture.ts`, or use
   the existing create-page workflow for a genuinely new public route.
5. Load published content at the route boundary with `lib/cms/read.ts`. Preview
   mode may select a draft only after both authorization gates pass.
6. Add parsing, validation, and workflow tests in
   `tests/website/content-system.test.ts`, then run typecheck, tests, lint, and a
   production build.
