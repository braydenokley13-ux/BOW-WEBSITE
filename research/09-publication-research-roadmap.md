# BOW SPORTS CAPITAL — ANALYTICS PUBLICATION & RESEARCH ROADMAP

**Role of this document:** the definitive strategy for Bow's article and research
operation. Written after a full audit of the repo (see "Grounding" below). It is
a thinking document, not an implementation ticket — but every recommendation is
anchored to something that already exists in `lib/` or deliberately refuses to.

**Companion docs:** `research/07` (persistence risk — still the one hard
prerequisite), `research/08` (the built research loop and its invariants). This
document assumes both and does not repeat them.

---

## Grounding: what the audit found

The prompt asked "what should the article side of Bow become?" The audit's
answer changes the question. Bow does not need an article strategy bolted onto
an analytics platform, because the platform already *is* a research machine
with a publishing organ attached:

- **A real model** — AASV (`lib/aasv.ts`): pure, deterministic, with four
  explicitly adjustable assumptions and slider bounds.
- **Five analytical lenses** (`lib/lenses.ts`) that produce *contested*
  verdicts when worldviews disagree.
- **A question engine** (`lib/tensions.ts`) — seven detectors that mine the
  model's own outputs for what it cannot settle, ranked by heat, published as
  the Open Docket with stable URLs.
- **An Open Ledger** (`lib/ledger.ts`) — nightly snapshots, diffed into dated
  events: verdict flips, questions opened/settled/reopened. The model is on
  the record.
- **A notebook → draft pipeline** (`lib/notebook-draft.ts`) that compiles
  clipped evidence into publication-ready markdown with live embeds and an
  assumptions-disclosure section.
- **A CMS with live data embeds** — nine shortcodes that re-run the actual
  engines at render time, so a number quoted in prose is always the model's
  current number, and can re-render under the reader's own assumptions.

Almost no publication on earth has this. FiveThirtyEight had models but static
articles. FanGraphs has live stats but articles that rot. Academic papers have
methodology but no interactivity. Bow has, in code, the thing the others
describe in mission statements: **articles that are live views into a model
that argues with itself in public.**

So the strategic question is not "what should Bow publish?" It is: **how does
one person exploit this machine without drowning in it?**

---

## 1. Executive Thesis

Bow Sports Capital should become **the first sports publication where the model
is the author of record and the human is the editor-in-chief of the model.**

Concretely:

1. **The publication and the platform are one product.** An article is the
   narrative face of a live analytical object (a question, a verdict, a trade,
   a ledger event). It never exists apart from the machine that produced it.
2. **Bow publishes disagreement, not conclusions.** The signature Bow move is
   showing *under which assumptions* a conclusion holds and where it flips.
   Everyone else sells certainty; Bow sells calibrated uncertainty — and that
   is precisely what front offices actually buy.
3. **Every piece leaves infrastructure behind.** A new detector, a new embed,
   a new dataset column, a reusable method. The rule is absolute: if an
   investigation produces only prose, it wasn't a Bow investigation.
4. **One writer, small portfolio, ruthless sequencing.** Four formats, one
   sport, one intellectual beachhead (the apron-era economics of NBA
   contracts), expanding only after the flywheel demonstrably spins.

## 2. The Opportunity

Three gaps exist simultaneously, and Bow's existing code sits at their
intersection:

- **The credibility gap.** Post-FiveThirtyEight, there is no mass-legible
  publication doing transparent, inspectable sports modeling. FanGraphs and
  Baseball Prospectus are baseball-only and methodologically opaque to
  outsiders. Substack analysts are unfalsifiable — nobody keeps score on them.
  Bow's Ledger *is* a scorekeeping mechanism; no one else has one.
- **The apron gap.** The NBA's second-apron CBA regime is the most
  economically interesting rule change in American sports in a decade, it is
  young enough that no publication owns it, and Bow's core model is literally
  named after it. This is a land grab with a deadline: the territory is open
  for maybe two more seasons.
- **The interactivity gap.** "Interactive journalism" died at most outlets
  because each interactive was a bespoke engineering project. Bow's embeds
  make interactivity *marginal-cost-zero*: every article gets live charts,
  adjustable assumptions, and permanent tools for free, because they all run
  the same pure engines.

The audience math also works in Bow's favor: the founder is a student, and
"a young researcher building a transparent model in public and putting it on
the record" is itself a story that earns attention no content calendar can buy.

## 3. What Bow Should Become

**A public research desk.** The mental model is not "blog," "stats site," or
"newsletter." It is a small quantitative research desk that happens to publish
its work product:

- The **Docket** is the desk's list of open investigations.
- The **Ledger** is the desk's track record.
- **Articles** are the desk's published findings.
- **Tools** (trade machine, lens switcher, dashboards) are the desk's
  instruments, which readers are allowed to touch.
- The **Methods** page is the desk's charter.

After reading five articles, a reader should believe: *"Bow is the place that
asks what sports conclusions actually depend on — and shows you, live."*

## 4. What Bow Should Not Become

Refuse these explicitly, in writing, on the Methods page:

- **Not a news reactor.** No same-day takes on trades or signings *unless* the
  model has something non-obvious to say (the trade machine often will — that
  is the test: "does a detector fire?").
- **Not a predictions shop.** Bow does not publish "X will win the title."
  It publishes "X's window is priced as if..." — conditional claims with
  stated assumptions. Predictions without assumptions are banned.
- **Not a volume content operation.** No SEO listicles, no rankings-for-
  rankings'-sake, no "10 best trades." Volume is what the Ledger's automated
  strips are for; human words are reserved for arguments.
- **Not a stats reference.** Basketball-Reference exists. Bow's player pages
  exist to host *verdicts and disagreements*, not exhaustive stat lines.
- **Not multi-sport yet.** NFL/MLB expansion before the NBA flywheel is
  self-sustaining would triple the data burden and halve the identity.
- **Not AI-authored prose.** The codebase already enforces this instinct
  ("the site never asserts something the model didn't compute"). Agents draft
  scaffolding, humans write claims. This is a trust asset — advertise it.

## 5. Editorial Identity

**The questions Bow becomes known for asking:**

- *What does this conclusion depend on?* (assumption-sensitivity as a genre)
- *Where does the consensus flip?* (knife-edge verdicts)
- *Who disagrees, and why?* (lens splits as protagonists)
- *What did the model get wrong, and what did we change?* (retrospectives)
- *What is the price of certainty?* (risk, optionality, flexibility as assets)

**What separates a Bow article** from the reference points:

| Publication | Their move | Bow's counter-move |
|---|---|---|
| ESPN | Narrative + access | No access, no narrative-first; the model is the source |
| The Ringer | Voice + culture | Bow's voice is the *disclosure* — showing work is the style |
| FiveThirtyEight | Model → static article | Model → **live** article that updates and can be re-run by the reader |
| FanGraphs | Metrics as product | Assumptions as product; metrics are downstream |
| Baseball Prospectus | Proprietary black-box models | Radical transparency; the model's internals are the content |
| Substack analysts | Personality, no accountability | The Ledger — Bow is on the record and diffs itself nightly |
| Academic research | Rigor, no reach, dead PDFs | Same rigor standards, but every paper is an interactive tool |

**What Bow refuses to publish:** anything whose central claim cannot be
reproduced by a reader moving sliders on the same page; anything the Ledger
cannot later grade; anything that requires trusting the author rather than
inspecting the work.

**Voice:** plain, declarative, unafraid of "we don't know." The house style
sentence is: *"Under consensus assumptions X; under the Rebuilder's lens Y;
the verdict flips at $Z per win — here's the slider."*

## 6. The Research Flywheel

The prompt proposed: Observation → Tension → Question → Investigation →
Finding → Argument → Article → Tool → New Questions. The improvement is that
in Bow's architecture **the first three steps are already automated**, and the
last step must be made mechanical rather than aspirational. The real flywheel:

```
        ┌─────────────────────────────────────────────────┐
        │                                                 │
        ▼                                                 │
  DETECTORS (lib/tensions.ts)                             │
   model mines its own output for tensions                │
        │                                                 │
        ▼                                                 │
  OPEN DOCKET — ranked, dated, public question queue      │
        │  (heat score = editorial priority, for free)    │
        ▼                                                 │
  TRIAGE (human, weekly, 30 min)                          │
   kill / watch / investigate — recorded on the docket    │
        │                                                 │
        ▼                                                 │
  INVESTIGATION (notebook: clip evidence under            │
   multiple lenses; agents fetch data & run checks)       │
        │                                                 │
        ▼                                                 │
  FINDING → one of three exits:                           │
   a) settles the question → Ledger event + short piece   │
   b) sharpens it → Docket File (mid-length article)      │
   c) breaks the model → Method Memo + model change       │
        │                                                 │
        ▼                                                 │
  ARTICLE ships with live embeds (already free)           │
        │                                                 │
        ▼                                                 │
  RESIDUE RULE: every piece must deposit ≥1 of:           │
   • a new detector  • a new embed  • a new data column   │
   • a new lens      • a model revision                   │
        │                                                 │
        └───── residue expands what detectors can see ────┘
```

Two design changes to the current system make this a true flywheel:

1. **Close the loop at the top.** Today detectors see AASV outputs. Each
   article's residue (new data columns, new detectors) widens the sensor
   field, so the docket gets *smarter after every piece*. This is the
   mechanism behind "every investigation makes the machine smarter" — it is a
   rule about residue, not an emergent hope.
2. **Make triage a first-class public act.** A weekly 30-minute triage that
   marks docket questions investigate/watch/killed — visible on the site — is
   itself content ("this week the desk chose to chase X because Y") and
   forces the discipline of *not* investigating everything.

**The hierarchy of epistemic states** (answering the prompt's taxonomy):

- **Observation** — anything a detector or human notices. Lives nowhere
  public. Free.
- **Tension** — an observation the model *cannot resolve internally* (two
  lenses disagree; a verdict sits on a knife edge). Detectors formalize this.
- **Question** — a tension phrased falsifiably, with stated evidence and a
  suggested method. Admission to the Docket requires all three.
- **Finding** — an answer robust across the assumption bounds, or an explicit
  map of where it flips. Findings without robustness checks stay in the
  notebook.
- **Article** — a finding that changes what a reader would *do or believe*,
  wrapped in argument. Findings that don't clear that bar become Ledger notes.
- **Product** — an article whose interactive core got used enough (or is
  general enough) to be promoted to a permanent tool page. Promotion is
  deliberate and rare — roughly one per quarter.

## 7. Article Portfolio

Four formats. Not fourteen. The prompt's longer list collapses into these —
"model updates," "methodology pieces," and "decision retrospectives" are all
Method Memos; "rapid analysis," "model-driven findings," and "public research
notebook" entries are all Ledger Notes; "data essays," "contrarian arguments,"
and "interactive articles" are all Docket Files with different postures.

### F1 — Ledger Notes (the heartbeat)
- **Purpose:** keep the desk visibly alive; convert automated Ledger events
  into two paragraphs of human judgment.
- **Audience:** returning readers, RSS/newsletter.
- **Depth/length:** minimal; 150–400 words atop auto-generated evidence
  embeds. 30–60 minutes each.
- **Frequency:** ~1/week during season (a "The Week on the Ledger" recap),
  opportunistically after big verdict flips.
- **Data/viz:** entirely existing embeds; zero new work per piece.
- **Interactive:** inherits live embeds; nothing bespoke.
- **Distinctly Bow:** it is the model's diary, annotated. No other outlet has
  a model that keeps a diary.

### F2 — Docket Files (the workhorse)
- **Purpose:** the canonical Bow piece — take one Open Docket question,
  investigate it, publish the finding *at the question's URL lineage* so the
  question page links to its resolution.
- **Audience:** the serious fan and the analytics-literate reader; this is
  the format that builds the reputation.
- **Depth/length:** 1,200–2,500 words; real robustness checks; 6–15 hours.
- **Frequency:** 2/month in season, 1/month off-season. This is the realistic
  ceiling for a student founder and it is enough.
- **Data:** usually existing data; occasionally one new hand-curated column
  in `data-seeds/`.
- **Viz/interactive:** 2–4 live embeds; one slider moment ("here is where it
  flips") is mandatory — it is the format's signature.
- **Distinctly Bow:** the question was machine-generated, publicly dated, and
  the article settles or sharpens it on the record.

### F3 — Flagship Investigations (the reputation makers)
- **Purpose:** the pieces a front-office person forwards to a colleague.
  Original research on a Territory question (§8), heavy on method.
- **Audience:** all five audiences at once — layered so the fan reads the
  story, the analyst reads the appendix, the executive reads the memo box.
- **Depth/length:** 2,500–5,000 words + methods appendix; 30–60 hours across
  4–8 weeks (background-processed, not sprinted).
- **Frequency:** quarterly. Four per year. No more.
- **Data:** typically requires a new dataset or a substantive model extension
  — this is where the big residue gets deposited.
- **Interactive:** ships with a promotable tool candidate by design.
- **Distinctly Bow:** each flagship *changes the model* — a new lens,
  detector, or assumption dimension exists afterward that didn't before.

### F4 — Method Memos (the trust engine)
- **Purpose:** model changes, assumption audits, decision retrospectives
  ("the model said trade him in November; here's what happened"), and honest
  post-mortems. Written to the standard of "an analyst at a team could audit
  this."
- **Audience:** the analytics community and future-employer types; low
  traffic, maximal credibility per reader.
- **Depth/length:** 800–1,500 words; 3–6 hours; frequency: whenever the model
  changes, plus one scheduled retrospective per season quarter.
- **Distinctly Bow:** publications hide model changes; Bow versions them in
  public. The Ledger makes retrospectives *computable* rather than anecdotal.

**Answer to "how many kinds should I realistically write?" Four.** Weekly
heartbeat (F1), biweekly workhorse (F2), quarterly flagship (F3), as-needed
memos (F4). Total: roughly 60–70 published items/year, of which only ~28 are
"real writing," of which only 4 are heavy. Reader-submitted papers (already
built) run alongside as a fifth, zero-marginal-cost stream.

**Cut from the prompt's candidate list, deliberately:** recurring statistical
franchises decoupled from the docket (they become obligations, not
investigations), rapid news reaction as a standing commitment (only when a
detector fires), and "experiments" as a separate public format (experiments
live in the notebook until they earn an exit).

## 8. Major Research Territories

Five territories, one beachhead. Each is an intellectual position, not a
topic; each can generate years of Docket Files and roughly one flagship per
year; each maps onto existing or near-existing model capabilities.

### T1 — The Apron as a Natural Experiment *(the beachhead — own this first)*
The 2023 CBA turned the NBA into a laboratory: identical production is worth
different amounts to different teams because of where they sit against the
aprons. Bow's model is *built* on this (`apronMultipliers` is a core
assumption). Program questions: Does the same contract create value on one
team and destroy it on another — and do front offices act like they know?
Are mutual-gain trades (the model's "free lunches") real inefficiencies or
model artifacts? Is the second apron functioning as a hard cap in behavior
before it is one in law? **No publication owns this territory. Claim it in
the first three months.**

### T2 — The Price of Certainty
How organizations pay premiums to avoid variance: proven-veteran premiums,
the discount on volatile young players, the option value of expiring
contracts and roster flexibility (the Franchise Index's `optionality` and
`capFlexibility` scores are the instrumentation). Program spine: "safe"
decisions have hidden costs, and the model can price them.

### T3 — Where Consensus Breaks
The lens architecture made disagreement computable. Program questions: which
*kinds* of players are systematically contested (the CONTESTED badge as a
research subject, not just UI)? When the lenses agree, are they more likely
to be right — or collectively blind? Do markets (actual contracts signed)
track any one lens? This territory turns Bow's UI primitives into findings.

### T4 — The Epistemics of Sports Models *(the meta-territory)*
How much do conclusions depend on analytical assumptions — and what should a
reader do about it? Knife-edge analysis, metric disagreement (EPM vs BPM is
already a detector), assumption-sensitivity as a first-class result. This is
the territory that makes students and professors cite Bow, and it's the one
Bow is architecturally unique in being able to demonstrate *live*.

### T5 — Timelines and Windows
Championship-window economics: how a team's temporal position should reprice
every asset it holds (the `championshipWindow` score and window-contradiction
detector are the seeds). Program questions: do teams behave consistently with
their stated timelines? What does a year of a star's prime cost at each
window state? When is punting a season the value-maximizing move?

**How articles nest into programs:** every Docket File is tagged to a
territory; each territory accumulates a living "what we know so far" program
page (a new, cheap page type: a curated list of findings + open questions).
Flagships are the annual synthesis of a territory's accumulated files. This
is how five articles stop being five articles and start being a research
agenda.

## 9. Article-to-Product Architecture

The bridge already exists; the work is making crossings mandatory and
bidirectional. Answers to the prompt's specific questions:

- **Can an article create a new model?** Yes — via the Residue Rule (§6):
  flagships must deposit a model revision, lens, or detector. E.g., a
  flagship on veteran risk premiums deposits a `riskPremium` assumption
  dimension; every future verdict inherits it.
- **Can a model generate article ideas?** It already does — that is the
  Docket. Extension: new detectors *are* the idea-generation investment, and
  they cost hours, not weeks (invariant-compliant pure functions).
- **Can reader disagreement become structured input?** Yes, without comments:
  shareable lenses (research/08 §4.3) let a reader publish their assumption
  set as a URL. Aggregate anonymized slider positions become a "reader
  consensus lens" — a sixth preset that is itself a data source and an
  article subject ("the crowd prices wins at $4.1M; the market says $3.5M").
  This is structured disagreement with zero moderation burden.
- **Can an article's assumptions become adjustable?** Built
  (`LiveAssumptions.tsx`); the roadmap item is making the reader-lens
  re-render of embeds the default, with a visible "you're reading this under
  {lens}" banner. That banner is the brand.
- **Can old articles update automatically?** Yes — embeds already re-run
  live. Add one honesty primitive: a **claim-drift flag**. Each article
  stores the verdict values at publication (the notebook already freezes
  assumptions in clips); when live values diverge past a threshold, the
  article auto-displays "the model has moved since this was published →
  see the Ledger." Articles that age *visibly and honestly* are a feature no
  competitor has.
- **Can an investigation become a permanent tool?** The promotion path:
  article embed → parameterized embed reused by later articles → standalone
  tool page. Rule of thumb: promoted when a third article wants it.
- **Does every piece make the next one easier?** Enforced by residue + the
  program pages: each territory accumulates cited findings, so later pieces
  link claims instead of re-proving them — exactly how a literature works.

Connective tissue per surface: articles auto-appear on player pages
(`getArticlesMentioningPlayer` — extend to teams and questions); question
pages link their resolving article and vice versa; the Ledger cites articles
in its event stream when a piece settled a question; memos embed in articles
via a new `<PlayerMemo/>` shortcode.

## 10. Editorial and Research Workflow

The pipeline for one person, tuned so each stage has a *decision*, a
*timebox*, and a *tool that already exists*:

1. **Capture (continuous, 0 min overhead).** Ideas enter as docket questions
   (machine) or notebook clips (human). No separate idea tracker — the
   docket + notebook *are* the tracker. A human-noticed idea that can't be
   phrased as a falsifiable question with evidence refs doesn't get captured;
   that filter is the point.
2. **Triage (weekly, 30 min, Sunday).** Scan docket by heat. Pick: kill /
   watch / investigate. Hard WIP limit: **2 active investigations + 1
   flagship in background.** Write the one-line "why chased / why killed"
   note — it later becomes Ledger-recap material.
3. **Scope (per investigation, 30 min).** Before touching data, write three
   sentences: the question, the finding that would be publishable, the
   finding that would kill the piece. If the kill condition can't be stated,
   the question isn't ready.
4. **Investigate (2–8 hrs).** Notebook-first: clip evidence under at least
   three lenses. Agents do data pulls, joins, and chart drafts; the human
   decides what counts as evidence.
5. **Robustness gate (1 hr, non-negotiable).** Sweep the full
   `ASSUMPTION_BOUNDS`. Every piece must report where (or whether) the
   conclusion flips. This single habit is 80% of the "serious analytics
   people respect it" goal — and the codebase makes it a one-liner.
6. **Draft (2–4 hrs).** `draftFromNotebook()` produces the scaffold with
   embeds and the assumptions disclosure. Human writes the argument around
   it. The lede states the finding *and* its strongest caveat.
7. **Edit + methodology review (1–2 hrs, next day).** Self-review checklist:
   Is every quantitative claim an embed or linked to one? Is the flip point
   shown? Could a hostile analyst reproduce this? Then an adversarial-agent
   pass: instruct an agent to attack the piece as a skeptical reviewer;
   answer or concede each attack in the text.
8. **Publish.** Via the existing editor. Tag territory + question ID. The
   question page gets its resolution link; the Ledger records the settle.
9. **Distribute (30 min).** One thread/newsletter unit built around the
   piece's *interactive moment* ("move this slider and the verdict flips") —
   the shareable object is the tool, not the take.
10. **Residue (30–60 min, same week).** Deposit the artifact (§6). Update the
    territory program page. Log the retrospective date if the piece made a
    gradeable call.

Total cost of a Docket File: ~8–15 hours. At 2/month plus the weekly Ledger
note, this is ~12 hours/week in season — tight but real for a student, and it
degrades gracefully (drop to 1 File/month in exam months; the automated
Ledger keeps the site alive).

## 11. AI and Agent Workflow

The dividing line, stated once and kept: **agents produce evidence and
scaffolding; the human produces questions, judgments, and claims.** The
codebase already embodies this ("no AI-generated prose" as a trust asset).

**Agents should do:** data acquisition and cleaning (extending
`nba-ingest`, curating `contracts.csv` updates against sources); exploratory
sweeps ("run this question across all 30 teams and flag outliers");
robustness sweeps across assumption bounds; chart/embed drafting; detector
prototyping (spec the tension in English → agent writes the pure function →
human reviews against the invariants in research/08 §3); adversarial review
(step 7 above); retrospective bookkeeping ("what did we publish that is now
gradeable?"); territory program-page upkeep.

**The human must do:** triage (what is worth Bow's name); the kill-condition
sentence; deciding what counts as evidence; every causal or evaluative claim
in prose; the model's assumption choices; the concession paragraphs. These
are exactly the tasks where taste compounds into reputation — outsourcing
them would make Bow faster and worthless.

**One process artifact worth building:** a `RESEARCH.md` playbook in-repo
that encodes steps 3–7 as agent-runnable checklists, so "investigate docket
question X" becomes a repeatable agent workflow with the human at the two
decision gates. That file is infrastructure — it makes every future
investigation cheaper, which is the flywheel applied to the workflow itself.

## 12. The First 10 Pieces

Sequenced to (a) establish identity before cadence, (b) exploit only
existing data/models for the first six, (c) leave residue that later pieces
consume. Formats in brackets.

**1. "Show Your Work: Why Bow Publishes Its Assumptions" [F4, launch
manifesto]** — Central question: what should it take to trust a sports
model? Why it matters: it defines the brand and pre-answers every future
methodology attack. Tension: transparency vs authority — showing sliders
admits the model is contestable. Data: none new; AASV itself. Method:
expository, with live demonstrations. Viz: the lens switcher inline; a
verdict flipping as the reader moves $-per-win. Interactive: the article IS
the tool demo. Difficulty: low (analysis) / high (writing stakes). Time:
~10 hrs. Teaches readers: how to read everything Bow will ever publish.
Teaches Bow: the house voice. Unlocks: everything — every later piece links
here instead of re-justifying itself.

**2. "The Same Contract, Four Different Prices" [F2, T1]** — Question: how
can one contract be a bargain in Miami and an albatross in Phoenix? Why:
the apron thesis in its most concrete, shareable form. Tension: fans price
players; the CBA prices *situations*. Data: existing contracts + apron
status. Method: `buildTradeAnalysis` repricing across all 30 team contexts
for 3–4 case-study contracts. Viz: a 30-team repricing strip per player.
Interactive: pick-a-player, see-the-spread. Difficulty: low. Time: ~8 hrs.
Teaches readers: the platform's core insight. Teaches Bow: which case
studies resonate. Unlocks: the mutual-gain-trade piece (#6) and the
repricing-strip embed (residue).

**3. "The Most Contested Player in the League" [F2, T3]** — Question: whom
do the five lenses disagree about most, and what *kind* of player is he? Why:
turns the CONTESTED badge into a finding; introduces the lenses as
characters. Hypothesis: contested players cluster — high-price, high-age, or
knife-edge production. Data: existing; `buildLensSplit` across the pool.
Method: rank by lens span; profile the cluster. Viz: a league-wide
contestedness leaderboard. Interactive: reader's own lens added as a sixth
row. Difficulty: low-medium. Time: ~8 hrs. Teaches Bow: whether contestedness
correlates with anything (a T3 program seed). Unlocks: piece #9 and a
`contestedness` data column (residue).

**4. "The Week the Model Changed Its Mind" [F1 → template]** — Question:
what moved on the Ledger this week and why? Why: establishes the heartbeat
format and demonstrates the on-the-record claim. Data: `diffSnapshots`
output. Method: annotate 2–3 events with causes (stat drift vs assumption
sensitivity). Viz: existing ledger strips. Difficulty: trivial by design.
Time: 2 hrs, then ≤1 hr weekly forever. Teaches Bow: the recap voice.
Unlocks: the standing franchise; residue is the recap template itself.

**5. "What Is a Win Worth? An Audit of Our Most Important Number" [F4,
T4]** — Question: the entire model hinges on `dollarsPerWin` — where does
that number come from and how wrong could it be? Why: preempts the single
most obvious methodological attack; models intellectual honesty. Method:
derive bounds from total league salary vs available wins; show every verdict
that flips inside the plausible range. Data: existing + one hand-curated
league-financials table (residue). Viz: verdict-flip counts along the
$/win axis. Interactive: the slider, but now the article *about* the slider.
Difficulty: medium. Time: ~12 hrs. Teaches readers: assumption-sensitivity
as a concept. Unlocks: T4 as a territory; the flip-count-along-an-axis embed.

**6. "Free Lunches: When a Trade Helps Both Teams" [F2, T1]** — Question:
the model detects mutual-gain trades — are they real inefficiencies or
artifacts? Why: it is the most counterintuitive standing output the machine
produces. Hypothesis: most "free lunches" are apron-relief transfers, i.e.,
real but bounded. Data: existing; enumerate pairwise trade space with agents.
Method: classify the mutual-gain population; robustness-sweep. Viz: a
mutual-gain matrix. Interactive: link every cell into the Trade Machine.
Difficulty: medium. Time: ~12 hrs. Teaches Bow: whether the trade detector
needs repair (honest possible outcome → Method Memo instead — say so in the
piece). Unlocks: a trade-space detector upgrade (residue).

**7. "The Rebuilder's Paradox" [F2, T5]** — Question: under the Rebuilder
lens, which contending-team assets become liabilities — and do rebuilding
teams actually behave as if they price this way? Why: first piece testing
*teams' revealed behavior* against a lens, the T5 program opener. Data:
existing + a small hand-curated table of actual recent transactions by
rebuilding teams (residue). Method: compare lens-implied valuations to
transaction behavior. Difficulty: medium-high. Time: ~15 hrs. Teaches
readers: timelines reprice everything. Unlocks: the revealed-preference
method used by #9 and the T5 flagship.

**8. "One Slider, Twelve Verdicts: The Knife-Edge League" [F2, T4]** —
Question: how many league verdicts sit within a nudge of flipping, and is
knife-edge status *predictive* of future contestedness? Why: converts the
knife-edge detector into a league-level finding. Data: existing + the
`contestedness` column from #3. Viz: the league on a stability spectrum.
Interactive: "break the model" — find the smallest assumption change that
flips each player. Difficulty: medium. Time: ~10 hrs. Unlocks: a
verdict-stability score worth adding to player pages (residue).

**9. "Do the Lenses Know Something the Market Doesn't?" [F3, flagship #1,
T3]** — Question: across actual contracts signed this offseason, which lens
best predicted the market — and where did *all* lenses miss? Why: the first
piece with a gradeable, external validity claim; the reputation-maker. Data:
new — a curated offseason-signings dataset (major residue). Method: score
each lens's implied valuations against signed contracts; decompose misses.
Viz: lens-vs-market scatter with miss annotations. Interactive: the reader's
lens scored against the market too. Difficulty: high. Time: 30–40 hrs over
6 weeks in background. Teaches Bow: whether the lens architecture has
external validity — the most important fact the desk can learn about itself.
Unlocks: a market-implied lens (a sixth preset — residue), and the annual
"Lens vs Market" franchise.

**10. "The Report Card: Grading Our First Season on the Record" [F4,
retrospective]** — Question: what did Bow publish that turned out wrong?
Why: no sports publication grades itself; doing it once makes the Ledger's
promise credible forever. Data: the Ledger + pieces #1–9's gradeable calls.
Method: computed retrospective via snapshot diffs. Difficulty: low mechanics,
high candor. Time: ~8 hrs. Teaches readers: what accountability looks like.
Unlocks: the annual accountability franchise, and — because it will surface
model failures — the next season's Method Memo agenda.

**Publication order = numbered order.** #1–4 in the first six weeks
(identity), #5–8 across the next three months (cadence + territories), #9
lands at the offseason signings window, #10 closes the season. Weekly #4-type
Ledger notes run continuously underneath from week three onward.

## 13. The 12-Month Roadmap

Sequenced by dependency, not calendar. Phases assume ~10–14 hrs/week in
normal weeks, less during exams (the design degrades to the automated Ledger
+ triage-only during crunch).

### Phase 0 — Make the Ground Solid *(≈ month 1; gate for everything)*
- **Objective:** eliminate the ways the platform can silently lose or
  misstate data. A publication betting its identity on "on the record"
  cannot run its record on ephemeral storage.
- **Build:** the Postgres migration (research/07's launch-blocker — articles,
  revisions, ledger snapshots first); claim-drift storage primitive (freeze
  publish-time values per article); the `RESEARCH.md` agent playbook.
- **Research:** none published; dry-run the workflow (§10) end-to-end on one
  docket question as a rehearsal.
- **Deliberately wait:** all publishing, all new detectors, all audience
  building.
- **Success:** a ledger snapshot and an article survive a redeploy; the
  rehearsal produced a publishable-quality draft.
- **Unlocks:** the right to make on-the-record claims.

### Phase 1 — Identity *(≈ months 2–3)*
- **Objective:** after this phase, a first-time visitor can articulate what
  Bow is.
- **Publish:** pieces #1–4; the weekly Ledger note starts.
- **Build:** territory program pages (simple curated lists); the repricing
  strip embed (residue of #2); question→article resolution links.
- **Research:** triage discipline starts (weekly, logged).
- **Wait:** flagships, new data acquisition, distribution experiments beyond
  a simple newsletter.
- **Success:** 4 pieces live, each with a working interactive moment; the
  Methods manifesto is the most-linked page; the weekly note has shipped 6+
  times without breaking the schedule.
- **Unlocks:** a body of work to point at; the cadence habit.

### Phase 2 — Cadence and Territories *(≈ months 4–7)*
- **Objective:** prove the flywheel — questions in, findings out, residue
  deposited, docket smarter.
- **Publish:** #5–8; ledger notes continue; first reader papers solicited
  through the existing submission flow.
- **Build:** residue from each piece (2–3 new detectors, `contestedness` and
  stability columns, flip-count embed); shareable lenses (URL-serialized
  assumption sets); claim-drift flags rendered on articles.
- **Research:** begin flagship #9's dataset curation in background.
- **Wait:** multi-sport anything; tool-page promotions (let embeds prove
  reuse first); any paid/growth mechanics.
- **Success:** ≥2 published pieces originated from *detectors that didn't
  exist at launch* — the flywheel's existence proof. Cadence held ≥80% of
  weeks.
- **Unlocks:** enough accumulated findings that program pages read as
  research programs.

### Phase 3 — External Validity *(≈ months 8–10)*
- **Objective:** land the first flagship and the first claim the outside
  world can grade.
- **Publish:** #9 (flagship); 2–3 supporting Docket Files from its
  by-products; Method Memo for whatever #9 breaks in the model.
- **Build:** the market-implied lens (residue of #9); first tool-page
  promotion (whichever embed hit third reuse — likely the repricing strip →
  a standalone "Reprice Any Contract" page); reader-lens aggregation if
  shareable-lens usage justifies it.
- **Wait:** still single-sport; resist the urge to cover news cycles the
  detectors don't flag.
- **Success:** the flagship is cited/linked by at least a few people Bow
  doesn't know; at least one methodological critique arrives from a stranger
  (being attacked by serious people is the success metric — it means serious
  people read it).
- **Unlocks:** the accountability piece, and credibility to approach data
  partnerships or a first collaborator.

### Phase 4 — On the Record *(≈ months 11–12)*
- **Objective:** close the season's loop in public and decide the second
  year from evidence.
- **Publish:** #10 (the self-grading retrospective); season-wrap territory
  syntheses on the program pages.
- **Build:** the year-2 decision memo — with the Ledger's own data answering:
  which formats earned their hours? which territories produced findings vs
  noise? is a second sport, a collaborator, or deeper NBA the right
  expansion?
- **Success:** the retrospective honestly reports ≥1 model failure and the
  fix; year-2 plan is grounded in the Ledger, not vibes.
- **Unlocks:** era two — with a machine that is demonstrably smarter than it
  was at month 1, which was the entire point.

## 14. Success Metrics

Ranked; the top three are the real ones. Explicitly *not* pageviews-first —
a desk whose KPI is traffic becomes a content farm within a year.

1. **Flywheel proof:** # of published pieces originating from detectors/data
   that didn't exist at launch (target: 2 by month 7, 5 by month 12).
2. **Residue count:** artifacts deposited per quarter (detectors, embeds,
   columns, lenses, model revisions). Target ≥4/quarter.
3. **Credibility events:** unsolicited citations, methodological critiques
   from strangers, inbound from analytics-community/front-office-adjacent
   people. Target: any by month 10 — these cannot be forced, only earned.
4. **Cadence integrity:** % of weeks the heartbeat shipped (target ≥80%).
5. **Interactive engagement:** % of article readers who touch a slider/lens
   (instrument once, early — it is the thesis's direct test).
6. **Accountability:** gradeable calls made and later graded (target: 100%
   of gradeable calls actually graded — the number that must be perfect).
7. Returning readers / newsletter growth — watched, not optimized.

## 15. Major Risks

1. **Founder time collapse** (likelihood: high). Mitigation is built in: the
   automated Ledger keeps the site alive at zero writing cost; the WIP limit
   and degradation plan are explicit; flagships are background-processed.
2. **Data fragility** (high). `contracts.csv` is hand-maintained and
   stats.nba.com is an unofficial endpoint that breaks without notice. The
   snapshot-CSV floor is the right design; the mitigation is scheduled
   monthly curation and treating a broken ingest as a Ledger-visible event,
   not a silent failure.
3. **Model wrongness in public** (certain, eventually). This is only a risk
   if handled defensively. The entire architecture (Ledger, Method Memos,
   piece #10) converts being wrong into content. The real risk is *silent*
   wrongness — hence claim-drift flags and the graded-calls metric.
4. **Single-model monoculture** (medium). Everything derives from AASV; if
   its core framing is off, everything inherits the error. Mitigation: piece
   #5 (audit the load-bearing number), piece #9 (external validity test),
   and the standing rule that metric disagreement (EPM vs BPM) stays a
   published tension rather than being averaged away.
5. **Identity drift toward news reaction** (medium). The detector-fires test
   (§4) is the guardrail; triage notes create an audit trail of temptations
   resisted.
6. **Apron territory gets crowded** (medium, 12–24 months). Bow's moat is
   not the topic but the machine — ledger, lenses, live embeds. Speed matters
   anyway: Phase 1–2 must plant the flag.
7. **Legal/ToS caution** (low but real): unofficial NBA stats endpoints and
   hand-transcribed contract data are fine at current scale; revisit before
   any commercialization.

## 16. What to Do Next

In order, nothing skipped:

1. Migrate persistence (Postgres) — articles, revisions, ledger. (Phase 0.)
2. Run one full workflow rehearsal on a live docket question; fix whatever
   grinds.
3. Write and publish piece #1, the Methods manifesto.
4. Start the weekly triage ritual and the weekly Ledger note.
5. Publish #2–4; deposit their residue; open the T1 program page.
6. Only then: look up and consider distribution.

## 17. The Single Most Important First Move

**Publish the manifesto — "Show Your Work" (piece #1) — with the Ledger
running durably beneath it.**

Not because it is the best article, but because it performs the strategy's
one irreversible act: it puts Bow *on the record*, in public, with the model
inspectable and the accountability mechanism visibly running. Every
subsequent piece inherits credibility from that act; no amount of later
volume can substitute for it. (Its hard prerequisite is the Phase 0
persistence fix — a publication that promises "we keep score on ourselves"
cannot lose its scorebook on a redeploy.)

Everything else in this roadmap is a consequence of taking that one move
seriously: if the record is real, the questions must be falsifiable, the
assumptions must be shown, the failures must be graded, and every
investigation must leave the machine smarter — because the machine is the
publication, and the publication is now on the record.
