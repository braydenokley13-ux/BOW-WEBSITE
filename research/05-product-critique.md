# Product Critique — Six Perspectives

**Purpose:** stress-test Bow Sports Capital as it exists today (marketing site +
analytics section with player/team pages and articles + AASV valuation engine +
full LMS with tracks, simulations, leaderboards, discussion, partners, admin) from
six adversarial points of view. Each persona answers four fixed questions so the
implementation model can scan for patterns across personas rather than treating
each critique as isolated.

---

## 1. The NBA GM

**What would impress me:** the AASV framing is legitimate — "apron-adjusted"
shows someone actually understands that under the current CBA, a dollar of cap
space means something different depending on where you sit relative to the
aprons. The fact that every assumption is a visible, adjustable knob (not a
black-box score) is the single most credible design decision on the site; a real
front office would never trust an opaque number, and neither should a serious
reader.

**What would confuse me:** whether the dollars-per-win and replacement-level
defaults are transparent about *whose* assumptions they encode. A GM's first
question about any model is "what is this calibrated to, and by whom" — if the
default assumptions read as arbitrary rather than sourced/documented, credibility
erodes fast for this specific audience.

**What I'd remove:** any verdict language that reads as more confident than the
model actually is. A real front office is allergic to false precision ("Bargain"
stated flatly reads differently than "Bargain under these assumptions, with X%
confidence") — Deliverable 1's cluster G (risk/variance) needs to visibly temper
every verdict tier, not just live in a separate article category.

**What would make me return weekly:** a live "verdict flip" feed (Deliverable 4,
#8) tracking how real transactions move the model, plus a genuine trade-machine
tool (Deliverable 4, #2) that enforces real apron rules — a GM-caliber reader
wants a tool they'd actually reach for during a live negotiation, not just
explanatory content.

---

## 2. The Yankees Executive (Baseball, Big-Market, Ownership-Facing)

**What would impress me:** that Bow's category structure (Trade Analysis,
Contract Deep Dives, Draft Economics, Cap Strategy, Model Notes) mirrors how a
real front office actually organizes its internal thinking — this isn't generic
"news" categorization, it's operational categorization. That signals the
platform was built by people who understand the job, not just people who cover
it.

**What would confuse me:** baseball-specific mechanics (CBT thresholds,
international bonus pools, arbitration) don't obviously map onto an
apron-first framework built around NBA language — if Bow expands beyond
basketball, an exec from another sport needs to see the *general* model
(surplus value, aging curves, competitive windows) clearly separated from the
NBA-specific implementation (aprons specifically), or the site will read as
"an NBA site that also mentions baseball" rather than a genuinely multi-sport
platform.

**What I'd remove:** nothing structurally — but I'd want confirmation the model
distinguishes between revenue-context differences (large-market vs. small-market
economics, Deliverable 1, #94) rather than treating all teams as facing identical
cost-of-a-win economics regardless of market size.

**What would make me return weekly:** the franchise-valuation and
media-rights-cycle content (Deliverable 1, cluster J) — an ownership-facing exec
cares as much about the business of the team as the roster, and this is the most
underbuilt cluster relative to what a business-side executive actually reads
Bloomberg/Sportico/Forbes for today.

---

## 3. The Journalist (Beat Writer / Investigative)

**What would impress me:** the "every assumption is a knob" architecture is
genuinely rare in sports media — most outlets publish a number as fact; Bow
publishing a *model* the reader can interrogate is closer to how FiveThirtyEight
built its credibility than how a typical team-beat outlet operates.

**What would confuse me:** whether there's a clear editorial voice distinguishing
reported news (what actually happened, sourced) from modeled analysis (what the
AASV engine estimates) — a journalist's trust depends on that line staying
crisp; if a modeled verdict is presented with the same authority as a reported
fact, that's a credibility risk a professional journalist would flag immediately.

**What I'd remove:** any "Model Notes" content that reads as marketing for the
model itself rather than transparent methodology — a journalist wants to see
the model's failure cases (Editorial Pattern #12, the Report Card) as
prominently as its wins, or it reads as self-serving.

**What would make me return weekly:** genuinely original data (Bow's own
proprietary framework, not just aggregated public stats) that a beat writer
could cite or build a story around — the AASV engine and its underlying
assumptions, if published with real rigor, is exactly the kind of proprietary
methodology that gets cited externally the way FanGraphs' WAR or PFF's grades
now are.

---

## 4. The College Student (Sports-Business / Econ Major)

**What would impress me:** this is the platform's single best-fit audience —
a business/econ student wants exactly the bridge Bow builds (real finance and
economics concepts, applied to a domain they already care about). The
mental-models framing (Deliverable 3) directly mirrors the vocabulary of an
intro finance/strategy course (asset management, opportunity cost, optionality,
risk-adjusted return) — recognizing the course material inside a sports context
is a genuine "oh, THIS is what that means" moment.

**What would confuse me:** if the educational scaffolding (glossary, explainers)
isn't tightly linked to the analytics content — a student reading an AASV
article needs the underlying finance concept one click away, not requiring a
separate trip to the LMS/Track 101 content, which currently appears to be a
mostly separate product surface (`/dashboard`, `/app`) from the public analytics
pages.

**What I'd remove:** nothing — but I'd tighten the seam between the marketing
analytics site and the actual LMS tracks; right now they read as two products
(a public editorial/analytics site, and a gated student LMS) rather than one
continuous learning journey.

**What would make me return weekly:** a "build your resume" angle — a shareable
credential or portfolio piece (a public profile showing quiz performance,
simulation grades, and demonstrated understanding of real front-office
frameworks) that a student could plausibly put on a resume or LinkedIn; the
existing `/profile/[id]` public shareable record is close to this already and
should be marketed toward this persona explicitly.

---

## 5. The Casual Fan

**What would impress me:** that I can get a real opinion ("is this a good
contract") without having to learn a new vocabulary first — assuming the
"explain like I'm a fan" toggle (Deliverable 4, #10) or equivalent scaffolding
exists; without it, the risk is high that a casual fan bounces at the first
unexplained term.

**What would confuse me:** apron terminology, surplus value, and AASV are all
genuinely unfamiliar to a casual fan on first contact — without inline
glossary support (Editorial Pattern #10) baked into every article, a casual
reader hits a wall of jargon in the first paragraph of most Cap Strategy or
Model Notes content.

**What I'd remove:** long methodology digressions inside news-driven pieces — a
casual fan wants the verdict first (Editorial Pattern #7, the Executive Summary)
with the model's reasoning available but not mandatory reading.

**What would make me return weekly:** the decision-challenge and trade-machine
formats (Deliverable 4, #1-#2) — a casual fan is far more likely to return for a
game/quiz/tool than for prose, and the "how did I do vs. other readers" social
comparison loop is the strongest habitual hook for this specific persona.

---

## 6. The Sports Business Professor

**What would impress me:** that this is a *rigorous*, citable teaching resource
rather than a fan blog with a finance veneer — the assumption-transparency
architecture (every AASV input adjustable and visible) is genuinely
classroom-usable in a way that most sports-media analytics content is not
(a professor can assign "change these three assumptions and explain why the
verdict flips" as a real problem set).

**What would confuse me:** whether claims are sourced/citable enough to assign
academically — a professor needs to know where the underlying assumptions
(dollars-per-win, apron multipliers) come from, whether they're calibrated to
real market transactions or stylized for teaching purposes, and whether that
distinction is disclosed.

**What I'd remove:** nothing structurally, but I'd want a visible "methodology"
page per model (not just per article) that reads like an actual academic
appendix — assumptions, data sources, known limitations — separate from the
inline "So What" and explainer content built for a general reader.

**What would make me return weekly (or, more realistically, assign every
semester):** a stable, versioned methodology a professor can build a syllabus
around without it silently changing under them, plus the "Decision Rewind"
format (Deliverable 4, #7) as a ready-made case-study assignment — restricting
students to period-accurate information before revealing the outcome is
precisely how strategy case studies are taught, and Bow could productize that
format for actual classroom licensing.

---

## Cross-Persona Patterns

| Pattern | Personas who raised it | Implication |
|---|---|---|
| **Assumption transparency is the credibility anchor** | GM, journalist, professor | Never regress toward hiding or hardcoding assumptions to "simplify" the UI — it's the single most-praised architectural decision across expert personas. |
| **Jargon without scaffolding loses casual/student readers** | Casual fan, college student | Inline glossary linking (Editorial Pattern #10) is not a nice-to-have; it's a prerequisite for two of six personas to stay engaged past paragraph one. |
| **The model needs to show its failures, not just its wins** | GM, journalist, professor | The Report Card / Retrospective pattern (Editorial Pattern #12) is the highest-leverage trust-building content Bow can produce, and is currently absent. |
| **Two product surfaces (public analytics vs. gated LMS) feel disconnected** | College student | Worth a dedicated navigation/IA pass tying `/analytics` and `/app`/`/dashboard` into one visible journey rather than two separately-branded products. |
| **Shareable, competitive, social-loop content drives return visits far more than prose** | Casual fan, GM (in tool form), college student (in credential form) | Deliverable 4's decision-challenge/leaderboard formats should be prioritized over additional long-form articles for retention purposes specifically. |
