# Bow Sports Capital — Product Research Pass

**Role:** this directory is a research and strategy deliverable, produced
alongside (not inside) the implementation work another Claude instance is doing
on this repo. Nothing here changes application behavior — it's the "strategy
deck" the implementation model can pull from when making product and design
decisions. See each document's own header for scope.

## Grounding

Before writing anything, this pass audited the repo as it actually exists today
— not a blank slate. Findings that shaped every document below:

- Bow already ships a real analytics engine: **AASV** (Apron-Adjusted Surplus
  Value, `lib/aasv.ts`) and an "intelligence" layer (`lib/intelligence.ts`,
  `lib/intelligence-types.ts`) that turns AASV numbers into contract verdicts,
  risk factors, and team rollups.
- Bow already ships a real article publishing system — drafts, revisions with
  rollback, categories, tags, a `featured` flag, and a live-preview markdown
  editor with **8 working data-embed shortcodes** (`lib/markdown.ts`,
  `app/actions/articles.ts`, `app/analytics/admin/`).
- Bow already ships a full LMS (tracks, simulations, leaderboards, discussion,
  partners, admin) sitting alongside the public marketing/analytics site.
- The whole platform runs on SQLite via `node:sqlite` against a local file,
  deployed on Vercel (confirmed by `vercel.json`'s cron config) — a real
  production risk flagged in detail in **07**.

Because of this, several deliverables below are framed as *"deepen and connect
what exists"* rather than *"build from zero."* Treat that framing as a finding,
not a hedge — it changes where the highest-leverage build effort actually is.

## Documents

| File | Deliverable | One-line takeaway |
|---|---|---|
| [`01-hundred-best-analytics-ideas.md`](./01-hundred-best-analytics-ideas.md) | The 100 Best Analytics Ideas | 100 concepts in 10 clusters, ordered so clusters A-C map onto what Bow already ships (deepen first) and clusters D-J are the underbuilt frontier. |
| [`02-editorial-patterns.md`](./02-editorial-patterns.md) | Great Editorial Patterns | 12 storytelling/interaction patterns (Live Assumptions is already one of them — extend, don't reinvent); closes with 4 cross-cutting rules. |
| [`03-front-office-mental-models.md`](./03-front-office-mental-models.md) | Front Office Mental Models | 12 models that chain into one sequence — asset management → opportunity cost/marginal thinking → windows/optionality → diversification/risk/leverage → discipline/incentives → sunk cost/process-over-outcome. Strong candidate for a single flagship "how to think like a front office" piece. |
| [`04-magic-features.md`](./04-magic-features.md) | Features That Feel Like Magic | 10 shareable features, ordered cheapest/highest-leverage first; flags which 3 share one underlying "decision at a point in time, graded on process" primitive worth building once. |
| [`05-product-critique.md`](./05-product-critique.md) | Product Critique | 6 personas (GM, Yankees exec, journalist, college student, casual fan, professor) each answering 4 fixed questions, plus a cross-persona pattern table at the end — read that table first if short on time. |
| [`06-future-roadmap.md`](./06-future-roadmap.md) | The Future Roadmap | 78 ideas across MVP/Next/Future/Moonshot, each rated impact/difficulty/educational value/uniqueness, with sequencing notes (Tier 1 is mostly wiring existing infra; Tier 3 is gated by data access, not engineering). |
| [`07-article-publishing-system.md`](./07-article-publishing-system.md) | Article Publishing System | Gap analysis against the CMS brief. ~2/3 of the brief is already built. The one launch-blocking issue: SQLite doesn't survive Vercel's serverless filesystem — migrate to Postgres/Prisma before anything else in this area. |

## How to read this as an implementation backlog

1. Start with **07** — it contains the one finding with a hard deadline
   quality to it (data loss risk), independent of any feature prioritization.
2. Use **06** as the actual sequencing document — it cross-references **01**,
   **02**, **04**, and **05** by item number, so it doubles as an index into
   the rest of this research.
3. Use **01** and **03** as the vocabulary/framework layer — pull definitions
   and "Bow's Edge" framings directly into UI copy and article templates rather
   than re-deriving them.
4. Use **02** as the component-design layer — each pattern names a specific
   reusable embed/component shape, several of which map directly onto **07**'s
   embed-library gap analysis (Payroll Timeline, Championship Window, Decision
   Tree are named in both).
5. Use **05** as a pre-launch checklist — run any major new surface past the
   six personas' four fixed questions before shipping it.
