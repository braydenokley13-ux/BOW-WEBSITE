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

# 2. Content. Inserts the existing website into the editor, and only ever
#    inserts: a page/track/FAQ that already exists is left exactly as it is,
#    so re-running after the founder has edited something changes nothing.
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
| Open the editor | A draft is created as a copy of the published version, if one isn't already open |
| Edit a section | Writes to the draft only. The public site is unchanged |
| Preview | Renders the draft, behind two gates (see below) |
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

Editable: marketing copy, headings, buttons and their destinations, program and
track facts, navigation, footer, FAQs, announcements, SEO titles and
descriptions, social-sharing images, empty-state wording, registration and
interest-list explanations.

Not editable, on purpose:

- **Layout, spacing, colour, and component choice.** A section carries words and
  a named surface (`paper`, `ink`, `blue`, …); the React component owns every
  pixel. There is no free-form HTML section.
- **Shared functional labels** — "Save", "Cancel", "Sign in".
- **Anything secret.** Global Settings holds public contact details and default
  copy. API keys, connection strings, and mail credentials stay in the
  deployment environment and are never surfaced in this system.

## Statuses

Publication status (page, track, program): **Draft**, **Published**,
**Archived**. Only `Published` is publicly readable, and that filter is applied
in SQL — draft content cannot reach a page, a sitemap, or page metadata.

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
  `site_faq_placements`, `site_announcements`, `testimonials`, and `news_items`.
- No write policy exists for either role, and `INSERT`/`UPDATE`/`DELETE` are
  revoked outright, so a future policy mistake cannot open a write path.
