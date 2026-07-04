# Article Publishing System — Gap Analysis & Research Spec

**Purpose:** this is the one deliverable that audits *existing* code rather than
proposing from scratch. The brief asked for a CMS "built or researched toward" —
research revealed Bow already has a substantially working article publishing
system. This document is a precise gap analysis against the brief's vision, plus
one critical, previously-unflagged production risk. **No application code was
modified to produce this document** — findings only.

---

## 0. Executive summary (read this first)

1. **The CMS the brief asks for already exists in large part.** Draft/published
   status, slug routing, revision history with rollback, categories, tags,
   featured flag, view counts, meta title/description, and a *live-preview
   markdown editor with 8 working data-embed shortcodes* are all implemented
   today (`lib/articles.ts`, `lib/articles-shared.ts`, `app/actions/articles.ts`,
   `lib/markdown.ts`, `app/analytics/admin/`). The implementation model's job
   here is mostly **extend and harden**, not **build from zero**.
2. **The single most important finding in this document: the persistence layer
   is a production risk on the brief's own stated target (Vercel).** The system
   runs on SQLite via Node's built-in `node:sqlite` driver, with the database
   file living at `data/bow.db` on local disk (README.md, confirmed by
   `lib/db.ts`). `vercel.json` confirms this project is deployed on Vercel
   (it configures a Vercel Cron Job). **Vercel's serverless functions run on an
   ephemeral, effectively read-only filesystem** (writes are only possible to
   `/tmp`, which is not shared across concurrent invocations and is not
   guaranteed to persist between invocations of the same function, let alone
   across deploys). A SQLite file written by one invocation will not reliably
   be visible to the next request, and every cold start risks re-seeding from
   scratch — meaning **admin-authored articles can silently vanish in
   production**, exactly the failure mode the brief is trying to avoid
   ("I should be able to log into an admin area... and have it appear
   publicly"). This is not a hypothetical edge case; it is the default,
   well-documented behavior of Vercel's serverless runtime and should be
   treated as a launch blocker for the CMS specifically, independent of any
   other roadmap work.
3. **The brief's requested stack (Next.js admin pages, Prisma/PostgreSQL,
   Server Actions, role-gated permissions, draft/published, slug routing,
   preview mode) is therefore not a stylistic preference — it is the correct
   fix for finding #2.** Server Actions and Next.js admin pages are already the
   pattern in use; the only real gap against the brief's requested stack is the
   database engine itself.

---

## 1. Current-state audit (what already exists)

| Requested capability (from the brief) | Current state | File(s) |
|---|---|---|
| Create draft article | ✅ Implemented — `saveArticle(null, input)` mints a new `art-XXXXXXXX` id and draft-status row | `app/actions/articles.ts:95-124` |
| Edit title/subtitle/author/category/tags | ✅ Implemented — `ArticleInput` covers title, dek (subtitle), author, category, tags | `app/actions/articles.ts:15-26` |
| Add hero image | ✅ Partial — `coverImage` field exists on `Article`; inline body images also supported by the markdown parser (`{ type: "image" }`) | `lib/articles-shared.ts:29`, `lib/markdown.ts:37,57` |
| Write article body | ✅ Implemented — custom lightweight markdown (headings, bold/italic, links, lists, blockquotes, code, images, HR) | `lib/markdown.ts` |
| Insert interactive analytics modules | ✅ Implemented — 8 working shortcode embeds with a **live preview that renders any embed as the author types**, no round-trip | `lib/markdown.ts:40-48`, `app/analytics/admin/editor/[id]/page.tsx` |
| Preview article before publishing | ⚠️ Partial — the editor has a live in-page preview of the rendered body, but there is no distinct "preview as a public reader would see it, before it's published" mode (e.g., Next.js Draft Mode with a shareable preview link) | `app/analytics/admin/editor/[id]/page.tsx` |
| Publish / unpublish | ✅ Implemented — `setArticleStatus(id, publish)` toggles status and stamps `published_at` on first publish only | `app/actions/articles.ts:126-143` |
| Schedule publishing | ❌ Not implemented — no `scheduled_at` column or cron check; publishing is immediate/manual only | — |
| Edit published articles | ✅ Implemented — `saveArticle` on an existing id; published slugs are deliberately frozen so URLs never break while everything else stays editable | `app/actions/articles.ts:103-114` |
| Feature articles on homepage | ⚠️ Partial — a `featured` boolean and `setArticleFeatured` action exist and are used to sort the publication list (`ORDER BY featured DESC...`), but it is not confirmed that the **site homepage** (as opposed to the `/analytics` index) surfaces featured articles | `lib/articles.ts:56-58`, `app/actions/articles.ts:145-153` |
| Connect articles to players/teams/contracts/concepts | ✅ Implemented, and further along than the brief assumes — the embed shortcode system *is* this connection, resolved live against real player/team data (`getAnalyticsPlayers`, `getAllPlayerSeasonHistories`) rather than static links | `app/analytics/admin/editor/[id]/page.tsx:19-27` |
| Draft/published status | ✅ Implemented — `ArticleStatus = "draft" \| "published"` | `lib/articles-shared.ts:17` |
| Article slug routing | ✅ Implemented — `/analytics/articles/[slug]`, slug uniquified and frozen on first publish | `app/(marketing)/analytics/articles/[slug]/page.tsx`, `app/actions/articles.ts:61-71` |
| Role-gated permissions | ⚠️ Partial — every mutation calls `requireRole("admin")`, which gates *who can touch articles at all* but has no finer-grained model (e.g., a "writer" role that can draft but not publish, or per-author ownership) | `app/actions/articles.ts` (every exported function) |
| Server Actions | ✅ Implemented — the entire mutation surface is `"use server"` functions | `app/actions/articles.ts:1` |
| Next.js admin pages | ✅ Implemented — `/analytics/admin` (list) and `/analytics/admin/editor/[id]` (editor) | `app/analytics/admin/` |
| Prisma/PostgreSQL | ❌ Not implemented — currently `node:sqlite` against a local file; this is finding #2 above | `lib/db.ts` |
| Revision history (not explicitly requested, but present and valuable) | ✅ Implemented — every save snapshots the *previous* state first (never loses work), capped at 25 revisions per article, with one-click restore that itself snapshots first | `app/actions/articles.ts:73-86,170-190` |

**Bottom line:** of the brief's explicit checklist, roughly two-thirds is already
done well. The three genuine gaps are **scheduled publishing**, **a true preview
mode distinct from the live editor**, and **finer-grained roles** — all Tier 1/2
scale problems, not architectural ones. The one gap that *is* architectural is the
database engine, and it's the one that actually threatens the "publish and have
it reliably appear" promise the whole brief is built around.

---

## 2. The persistence risk, in more detail

- `getDb()` (per README) creates/opens `data/bow.db` on first access and seeds it
  if empty. On a traditional always-on server (a VM, a container with a mounted
  volume, a `next start` process kept alive), this works fine — the file persists
  for the life of the process/disk.
- On Vercel's default Node.js serverless functions, each invocation may run in a
  fresh execution environment. The project filesystem outside `/tmp` is
  **read-only** at runtime; `/tmp` is writable but is **not guaranteed to persist
  across invocations** and is **never shared across concurrent instances**. In
  practice this means: an admin saves a draft → the write may succeed against
  that invocation's ephemeral `/tmp` copy → the next reader's request, served by
  a different (or recycled) instance, reads a fresh, re-seeded, empty-of-that-draft
  copy of the database. This isn't a rare race condition — it's the expected
  steady-state behavior.
- The existing code is aware persistence is fragile in spirit — note the comment
  at `lib/db.ts:1269-1271`: *"the demo articles only seed an empty publication so
  owner edits survive reboots."* That comment is true for a **single persistent
  disk**; it does not hold once the disk itself is not persistent across
  invocations, which is the Vercel serverless default.
- **This is very likely why the brief explicitly calls for Prisma/PostgreSQL** —
  whoever wrote the brief may already sense the current setup is fragile in
  production even without naming the mechanism. This document confirms the
  instinct is correct and gives the implementation model the specific technical
  reason.

### Recommended fix (research-level, not implemented here)

Migrate the articles subsystem (and, ideally, the rest of `lib/db.ts`'s schema
over time) from `node:sqlite`/local file to a managed Postgres instance
(Vercel Postgres, Neon, or Supabase all integrate natively with Vercel) accessed
via Prisma, exactly as the brief requests. Concretely, this means:

- A Prisma schema modeling `Article` and `ArticleRevision` 1:1 with the existing
  `articles` / `article_revisions` tables (same fields — the data model itself
  doesn't need to change, only where it lives).
- Server Actions (`app/actions/articles.ts`) stay Server Actions — swap the
  `db.prepare(...).run(...)` calls for `prisma.article.update(...)` etc.; the
  function signatures and calling code elsewhere in the app do not need to
  change.
- A one-time migration script reading the existing SQLite rows (in whatever
  environment currently holds real data) and writing them into Postgres —
  cheap, since the row counts here are small (editorial content, not
  transactional data at scale).
- This same migration removes the underlying risk for every *other* SQLite-backed
  subsystem too (accounts, sessions, LMS, discussion, simulations) — the articles
  table is simply the most urgent instance of a platform-wide risk, since it's
  the one the user directly interacts with as a hands-on publisher.

---

## 3. Embed library — mapping the brief's wishlist to what exists

The brief asks for these reusable embeds: **Player Investment Memo, Team GM
Brief, Contract Verdict, Surplus Value Chart, Payroll Timeline, Championship
Window, Decision Tree, Scenario Module, Comparison Table.**

The existing shortcode system already implements 8 embeds
(`lib/markdown.ts:40-48`): `PlayerCard`, `AASVChart`, `AASVTable`,
`TeamCapSheet`, `TrendChart`, `ContractVerdict`, `TeamFlex`, `ScenarioBand`.

| Brief's requested embed | Maps to existing shortcode | Gap |
|---|---|---|
| Contract Verdict | `<ContractVerdict player="..." />` — exact match, already wraps `lib/intelligence.ts`'s verdict tiers | None — ship as-is |
| Surplus Value Chart | `<AASVChart players="..." />` — exact match | None — ship as-is |
| Scenario Module | `<ScenarioBand player="..." />` — close match, already wraps the intelligence engine's scenario range | Confirm it reads as a full "stress test" (Deliverable 4, #3) or extend it to show the boom/bust range explicitly if it doesn't already |
| Comparison Table | `<AASVTable players="..." />` — partial match, currently player-to-player | Extend to support contracts/teams, not just players (Deliverable 2, Pattern #5) |
| Team GM Brief | `<TeamCapSheet team="..." />` / `<TeamFlex team="..." />` — partial, two separate embeds cover cap sheet and flexibility | Consider whether these should be *composed into* a single "GM Brief" memo-formatted embed (Editorial Pattern #7 — "TO/FROM/RE/VERDICT" framing) rather than requiring an author to place two shortcodes |
| Player Investment Memo | `<PlayerCard player="..." />` — partial, currently a card not a memo | Needs the memo framing (Editorial Pattern #7) layered on top — likely the same underlying data, different presentation component |
| Payroll Timeline | **No existing shortcode** | Net-new — this is Deliverable 1 #12's "front/back-loaded contract" visualization and Deliverable 4's "championship window" foundation; likely the single highest-value net-new embed given how many other concepts (aging curve overlay, two-lane asset timeline, dead-cap visualization) hang off a payroll-over-time chart |
| Championship Window | **No existing shortcode** | Net-new — Deliverable 1 #51, already named as a MVP-tier roadmap item (Tier 1, #14/#22 in Deliverable 6) |
| Decision Tree | **No existing shortcode** | Net-new — Deliverable 1 #54, Editorial Pattern #6; likely the most structurally different of the three net-new embeds (branching UI, not a chart) |

**Net-new build is smaller than the brief implies:** 6 of 9 requested embeds
already exist or are near-exact matches; the true net-new work is **Payroll
Timeline, Championship Window, and Decision Tree** — all three already appear
independently in Deliverables 1, 2, 4, and 6, which corroborates them as the
right next build targets from multiple angles, not just this audit.

---

## 4. Workflow gaps, precisely scoped

1. **Scheduled publishing** — add a nullable `scheduled_at` column; a cron check
   (the project already runs a Vercel Cron for `nba-ingest`, `vercel.json:3-8` —
   the same mechanism can drive a `publish-scheduled` cron hitting
   `setArticleStatus` for any article whose `scheduled_at` has passed). Small,
   self-contained addition; no architectural change needed once the persistence
   risk (§2) is resolved.
2. **True preview mode** — Next.js Draft Mode (`draftMode()` API) is the
   idiomatic fit: a signed preview cookie lets an admin view a draft at its
   would-be public URL, styled exactly as a reader would see it, without
   publishing — distinct from the editor's live-typing preview, which is
   necessarily a simplified render, not the actual page template.
3. **Finer-grained roles** — the brief's "role-gated permissions" is already
   half-true (every mutation requires the `admin` role via `requireRole`,
   `lib/dal.ts`). If the goal is specifically "I should be able to log in and
   publish myself" (singular "I" in the brief), the current single-admin-role
   model may already be sufficient — only add a "writer/editor" distinction if
   Bow expects multiple people authoring articles with different publish
   authority, which the brief doesn't explicitly ask for. **Recommendation:
   don't build multi-role authoring until there's a second real author** — this
   is a case where the brief's aspirational language ("role-gated permissions")
   slightly outruns the brief's actual stated need ("I should be able to...").
4. **Homepage featuring** — confirm whether `app/(marketing)`'s homepage
   (`lib/home.ts`) already reads from `getPublishedArticles({ featured: true })`
   or an equivalent; if not, this is a small, contained wiring task, not a new
   feature.

---

## 5. What NOT to change

- **Don't replace the custom markdown parser with a heavier library** (MDX, a
  rich-text WYSIWYG framework) purely for its own sake. The current parser's
  entire value proposition is that it's a small, dependency-free, isomorphic
  (server + client) implementation whose shortcode embeds are first-class
  citizens, not a plugin bolted onto a general-purpose renderer. Any migration
  should preserve "the live preview renders any embed as the author types,
  with real data, no round-trip" — that property is rare and valuable, and easy
  to accidentally lose by adopting a heavier, more generic editor framework.
- **Don't rebuild the revision-history/rollback system** — it's already correct
  (snapshot-before-every-write, capped history, rollback-is-itself-undoable) and
  should simply move databases underneath it, not be redesigned.
- **Don't treat this as "build a CMS from scratch"** — the implementation
  model's actual task, per this audit, is: (1) fix the persistence layer, (2)
  add the three net-new embeds, (3) add scheduling + true preview mode, in
  roughly that priority order, since #1 is the only item that threatens data
  the user will have already created using the current system.
