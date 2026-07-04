# Great Editorial Patterns

**Purpose:** the storytelling and interaction patterns that make analytics writing
*readable* rather than merely *accurate*. Bow's editorial voice already leans
front-office/serious (see the AASV embed's philosophy: "every assumption is a
user-controlled knob"); this deliverable catalogs the proven patterns worth
extending, and explains the mechanism of *why* each one works — not just that it
looks good.

---

## 1. Live Assumptions (already in Bow — extend, don't reinvent)

**What it is:** instead of publishing a single verdict number, the article exposes
the model's inputs as sliders/toggles the reader can move, and the verdict
recomputes live. Bow already has this exact pattern (`components/analytics/embeds/LiveAssumptions.tsx`,
`lib/aasv.ts`'s "every assumption is a user-controlled knob" philosophy).

**Why it works:** it converts a claim ("this contract is an albatross") into a
falsifiable model ("this contract is an albatross *if* you believe wins cost $2.1M
and this team is taxed at the second-apron rate — try your own numbers"). Readers
who disagree with the verdict don't bounce; they argue *with the model*, which is
stickier than agreeing or disagreeing with a paragraph. It also inoculates Bow
against "your numbers are wrong" criticism — the numbers are never fixed, they're
the reader's own inputs reflected back.

**Where the pattern under-delivers if done poorly:** if the defaults are hidden or
unlabeled, readers can't tell what they changed from. Always show the delta
("verdict flips from Bargain to Fair once dollars-per-win drops below $2.3M") not
just the new state.

**Extend it:** let a reader *save* a named assumption set ("my 2027 cap-growth
scenario") and re-apply it across every article/embed on the site — turns a
one-off toy into a persistent point of view the reader owns.

---

## 2. Scrollytelling (step-triggered graphic reveals)

**What it is:** as the reader scrolls through prose, a pinned graphic
(chart/map/diagram) transforms in sync with the text passing by — pioneered by
NYT's "Snow Fall," refined by The Pudding, FiveThirtyEight, and The Athletic's
longer investigative pieces.

**Why it works:** it solves the fundamental problem of data journalism — a static
chart with 8 annotations is unreadable, but 8 separate charts break the reading
flow. Scrollytelling lets one chart *become* 8 charts over time, so complexity is
revealed serially instead of all at once. It also creates a strong sense of
authorial control: the writer decides exactly what the reader sees at each moment,
which is why it works best for a linear argument ("here's how this trade evolved
over 4 seasons") and poorly for open-ended exploration.

**Bow application:** the aging-curve-under-a-contract idea (Deliverable 1, #3) is a
natural scrollytelling candidate — pin the payroll timeline, scroll through years,
watch the "team is buying the descending part of the curve" argument build
year-by-year instead of dumping the whole chart at once.

**Caution:** scrollytelling is expensive to build and unforgiving on mobile
(pinned-element math breaks easily at small viewports) — reserve it for 3-4
flagship pieces a year, not routine coverage.

---

## 3. Embedded Calculators / "Build Your Own Verdict"

**What it is:** a self-contained tool inside an article body that lets the reader
input their own scenario and get a personalized output — distinct from Live
Assumptions in that it usually starts from a blank/reader-chosen state rather than
a pre-set verdict the reader perturbs.

**Why it works:** readers trust a number they generated far more than a number they
were handed. It also gives an article a second life as a reference tool — a
"championship window calculator" gets bookmarked and reused long after the
original news event fades, which raw news coverage never does.

**Bow application:** a payroll/cap-space calculator embedded directly in Cap
Strategy category articles — "enter your own dollars-per-win assumption and see
what your team's actual cap sheet implies" — reusing the AASV engine as the
compute layer behind an article-embedded tool rather than only a standalone page.

---

## 4. Before/After Modules

**What it is:** a single component showing a state transition — roster before a
trade vs. after, cap sheet before vs. after an extension, a team's title odds
before vs. after an injury — usually as a synchronized side-by-side or a toggle
switch, not two separate charts the reader has to mentally diff.

**Why it works:** the human eye is extremely good at spotting *difference*, poor at
holding two separate numbers in working memory and subtracting them. A before/after
module does the subtraction visually, which is exactly what "surplus value" and
"verdict tier" analytics are conceptually doing under the hood — the pattern and
the underlying math are the same idea in two forms.

**Bow application:** a "trade grade" module that shows both rosters' AASV totals
before and after a proposed trade, with the *delta* (not just the two totals) as
the headline number.

---

## 5. Side-by-Side / Split-Screen Comparisons

**What it is:** two (or more) entities — players, contracts, teams, draft classes —
rendered in mirrored layout with shared axes, so any single row is directly
comparable across columns without the reader re-reading labels.

**Why it works:** comparison is the single most common reason a reader clicks into
a sports-analytics piece ("is X better than Y," "should we have signed X instead
of Y") — a shared-axis layout answers the question the reader actually came with,
rather than forcing them to hold two separate articles' numbers in their head.

**Bow application:** already implicit in `app/(marketing)/analytics/players` and
`teams` — extend into an explicit "compare" mode with 2-4 players/contracts
side-by-side, reusable as an embed inside articles (Deliverable 7's Comparison
Table embed).

---

## 6. Decision Trees / Choose-Your-Path Explainers

**What it is:** a branching structure ("if the team is under the first apron, then
X; if over, then Y") rendered as an actual visual tree or a click-through
choose-your-own-path, rather than described in prose.

**Why it works:** front-office logic is *conditional* by nature ("it depends on
the situation") — prose struggles to hold more than 2-3 conditions before becoming
unreadable, while a tree structure scales to real complexity without losing the
reader. It also converts a reader from passive audience to active
decision-maker, which is the single biggest lever for engagement (see
Deliverable 4).

**Bow application:** the rebuild/retool/reload/reload framework (Deliverable 1,
#54) is a decision tree by nature — render it as one, with the reader's own
answers about their team routing them to a specific verdict.

---

## 7. Executive Summaries ("The Memo")

**What it is:** a tight, front-loaded 3-5 bullet synopsis at the top of a
long-form piece, written in the register of an actual internal memo a GM might
receive — not a marketing teaser, a genuine compression of the argument.

**Why it works:** it respects two very different reading modes simultaneously —
the skimmer who wants the verdict in 15 seconds, and the deep reader who wants the
full argument. Bloomberg Terminal analyst notes and McKinsey decks both lead with
this because executives are time-constrained skimmers by profession; modeling the
same convention signals "this is written by and for people who think like
executives," which is exactly Bow's brand promise.

**Bow application:** the proposed "Player Investment Memo" and "Team GM Brief"
embeds (Deliverable 7) should *be* this pattern as a reusable component — literally
titled like an internal memo (TO / FROM / RE / VERDICT), not styled like a blog
teaser.

---

## 8. Annotated Charts (the chart *is* the argument)

**What it is:** a chart where the key insight is pointed to directly with a
callout/annotation layer, rather than requiring the reader to find it themselves
and rather than explaining it only in surrounding prose.

**Why it works:** FiveThirtyEight and FT graphics both built their reputations on
this — an unannotated scatter plot asks the reader to do the analysis;
an annotated one delivers the analysis while still showing the underlying
evidence, which is more persuasive than a claim with no visible data and more
efficient than raw data with no claim.

**Bow application:** every embed in Deliverable 7's list (Surplus Value Chart,
Payroll Timeline, Championship Window) should ship with a default annotation layer
highlighting the single most important data point, editable by the article author
at publish time — not merely a generic chart component the writer has to caption
manually every time.

---

## 9. The "So What" Sidebar

**What it is:** a persistent, visually distinct sidebar or pull-quote box that
translates a stats-heavy paragraph into its plain-language consequence — "so
what this means: the team can't offer more than the mid-level exception without
hard-capping itself."

**Why it works:** it lets a piece serve both an analytics-fluent reader (who reads
the main text) and a casual reader (who reads only the sidebars) without writing
two separate articles — a proven technique in financial journalism (FT, WSJ) for
exactly this dual-audience problem, which maps directly onto Bow's stated personas
(GM-minded reader vs. casual fan, Deliverable 5).

**Bow application:** a standard "So What" component authors can insert at will in
the article editor (Deliverable 7) — should be a first-class embed type, not a
manually bolded paragraph.

---

## 10. The Rolling Explainer / Glossary-in-Context

**What it is:** the first time a piece uses a term of art (apron, surplus value,
AASV), the term is visually marked and expandable inline (tooltip, footnote, or
expandable definition) rather than requiring the reader to leave the page to look
it up — Wikipedia's hover-preview pattern applied to jargon, not just proper nouns.

**Why it works:** it removes the single biggest friction point in analytics
writing — the reader who doesn't know what "AASV" means either bounces or
skims past the whole argument. Bow already has a `lib/glossary.ts` and a
`/glossary` page; the missed opportunity is that the glossary isn't *woven into*
article bodies automatically.

**Bow application:** auto-link the first occurrence of any glossary term in
published article bodies to a hover/tap definition sourced from the existing
glossary content — a mechanical win, not a design one, and arguably the single
highest-ROI item in this document given the infrastructure already exists.

---

## 11. The Live Ticker / Data Ribbon (already in Bow)

**What it is:** a persistent strip of live or frequently-updated numbers
(`components/site/DataRibbon` presumably fills this role already) that signals
"this platform tracks real, current numbers," borrowed from Bloomberg Terminal's
market-data ribbon and ESPN's scoreboard strip.

**Why it works:** it's an ambient trust signal — even a reader who never
interacts with the ribbon subconsciously registers "this site is current," which
matters enormously for a platform whose core claim is being a serious analytical
source rather than a static blog.

**Bow application:** extend the ribbon to surface a rotating single "surplus value
swing of the week" or "verdict flip of the week" pulled from the AASV engine —
turns ambient chrome into a discovery surface for the deeper tools.

---

## 12. The Retrospective / Report Card

**What it is:** revisiting a past prediction, trade, or contract on a fixed
cadence (one year later, at the trade deadline anniversary) and grading it against
what actually happened — Baseball Prospectus and FiveThirtyEight both built
long-term credibility on publicly grading their own forecasts.

**Why it works:** it's the single strongest trust-building device available to a
model-driven publication, because it's the one editorial pattern that can't be
faked — a report card that only ever confirms the model looks curated; a report
card that sometimes shows the model was wrong is what makes the other 95% of
content credible.

**Bow application:** an annual "AASV report card" — pull verdicts issued a year
ago, show what actually happened, and be honest about misses. Directly supports
Deliverable 1, #89 (overconfidence in proprietary models) by practicing the
discipline it teaches.

---

### Cross-cutting principles

1. **The chart should do work prose can't, and vice versa** — never duplicate the
   same information in both forms; use prose for causal narrative, charts for
   magnitude/comparison/trend.
2. **Every interactive should have a legible static fallback** (a default state
   that reads correctly even if the reader never touches a slider) — interactivity
   is a bonus layer, not a requirement to understand the piece.
3. **Show the model's uncertainty, not just its point estimate** — ranges, sample
   sizes, and "here's what this model doesn't know" disclosures (Deliverable 1,
   #67) are themselves an editorial pattern, and one that differentiates Bow from
   lower-rigor competitors.
4. **Reuse compute, vary presentation** — Live Assumptions, embedded calculators,
   before/after modules, and annotated charts can and should all be thin
   presentation layers over the *same* AASV/intelligence engine, not separate
   one-off calculations per article (a direct tie to Deliverable 7's embed
   architecture).
