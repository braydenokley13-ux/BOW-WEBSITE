# The Future Roadmap

**Purpose:** 78 forward-looking ideas organized into four tiers — **MVP** (ship in
the next build cycle, low-to-medium effort, reuses existing infrastructure),
**Next** (the following 1-2 cycles, medium effort, may need new data/schema),
**Future** (real investment, new subsystems), and **Moonshot** (high risk/high
reward, may need data partnerships, licensing, or a full product line). Every
item is rated **Impact**, **Difficulty**, **Educational Value**, and
**Uniqueness** on a Low/Med/High scale, plus a one-line note tying it back to
earlier deliverables where relevant.

Ratings are directional judgment calls for planning purposes, not measured data —
treat ties as "roughly equal, sequence by dependency" rather than a strict
ranking.

---

## Tier 1 — MVP (ship next; reuses existing infrastructure)

| # | Idea | Impact | Difficulty | Edu. Value | Uniqueness | Note |
|---|---|---|---|---|---|---|
| 1 | Inline glossary auto-linking in article bodies | High | Low | High | Med | Editorial Pattern #10 — `lib/glossary.ts` already exists, just needs wiring into article render |
| 2 | Verdict-flip notifications | High | Low | Med | High | Magic Feature #8 — reuses `lib/notifications.ts` + `app/api/cron` |
| 3 | "So What" sidebar as a first-class embed type | Med | Low | High | Med | Editorial Pattern #9 |
| 4 | Executive-summary ("The Memo") component for articles | Med | Low | High | Med | Editorial Pattern #7 |
| 5 | Annotation layer on existing chart embeds | Med | Low | Med | Med | Editorial Pattern #8 |
| 6 | Comparison Table embed (2-4 players/contracts side by side) | High | Low | High | Med | Deliverable 7 embed spec; extends existing `/analytics/players`, `/teams` |
| 7 | Article scheduling (publish-at-date) | Med | Low | Low | Low | Explicitly requested in the CMS brief; small addition to existing draft/published model |
| 8 | Preview mode for unpublished articles | High | Low | Low | Low | Explicitly requested in the CMS brief; Next.js draft mode is a natural fit |
| 9 | Featured-article homepage slot(s) | Med | Low | Low | Low | Explicitly requested; `featured` boolean already exists on the Article type |
| 10 | Player/team/concept linking from article body | High | Low | High | Med | Explicitly requested ("connect articles to players, teams, contracts, concepts") |
| 11 | Annual AASV Report Card | High | Low | High | High | Editorial Pattern #12 — pure content + light tooling, high trust payoff |
| 12 | "Forget what you paid" sunk-cost toggle on player/contract cards | Med | Low | High | High | Deliverable 1 #25, Deliverable 3 #11 |
| 13 | Replacement-level dotted-line on all valuation charts | Med | Low | Med | Low | Deliverable 1 #2 — small chart-config change, applies everywhere |
| 14 | Aging-curve hill overlay on contract timelines | High | Med | High | Med | Deliverable 1 #3 |
| 15 | "What else this could buy" opportunity-cost callout | Med | Low | High | Med | Deliverable 1 #26, Deliverable 3 #2 |
| 16 | Sample-size badge on hot/cold stat call-outs | Med | Low | High | Med | Deliverable 1 #65 |
| 17 | Saveable/named assumption sets for Live Assumptions embed | High | Med | Med | High | Extends existing `LiveAssumptions.tsx` |
| 18 | "What this model can't see" disclosure component | Med | Low | High | High | Deliverable 1 #67 — trust-building, cheap to build |
| 19 | Rotating "verdict of the week" in the Data Ribbon | Med | Low | Low | Med | Editorial Pattern #11 |
| 20 | Model-track-record badge on projection tools | Med | Low | High | High | Deliverable 1 #89 — practices what it teaches |

## Tier 2 — Next (1-2 cycles out; new schema/data likely needed)

| # | Idea | Impact | Difficulty | Edu. Value | Uniqueness | Note |
|---|---|---|---|---|---|---|
| 21 | Full article-embed library (Investment Memo, GM Brief, Contract Verdict, Surplus Chart, Payroll Timeline, Championship Window, Decision Tree, Scenario Module, Comparison Table) | High | Med | High | High | Core of Deliverable 7 |
| 22 | Championship Window embed as a standalone reusable component | High | Med | High | Med | Deliverable 1 #51 |
| 23 | Decision-tree renderer (rebuild/retool/reload framework) | High | Med | High | High | Deliverable 1 #54, Editorial Pattern #6 |
| 24 | "What Would You Do?" decision-challenge format + scoring | High | Med | High | High | Magic Feature #1 |
| 25 | Trade-fit finder (constraint-matching trade partner suggester) | High | Med | Med | High | Magic Feature #9 |
| 26 | Contract stress-test scenario simulator | High | Med | High | High | Magic Feature #3 |
| 27 | "Explain like I'm a GM / fan" reading-level toggle | High | Med | High | High | Magic Feature #10 |
| 28 | Article revision diff view in admin (see what changed between drafts) | Med | Low | Low | Low | Extends existing `article_revisions` table |
| 29 | Role-gated article authoring (multiple admin authors, not just one) | Med | Med | Low | Low | Explicitly requested ("role-gated permissions") |
| 30 | Draft-slot value chart + trade calculator | High | Med | High | High | Deliverable 1 #31 |
| 31 | Positional-premium overlay on prospect grades | Med | Med | Med | Med | Deliverable 1 #35 |
| 32 | Floor/ceiling range bars on prospect cards | Med | Med | Med | Med | Deliverable 1 #34 |
| 33 | Buy-or-sell deadline calculator | High | Med | High | High | Deliverable 1 #57 |
| 34 | Title-equity number (odds × value) alongside playoff odds | Med | Med | Med | Med | Deliverable 1 #56 |
| 35 | Team status badge (contend/sustain/reload/rebuild) | High | Med | High | High | Deliverable 1 #52 |
| 36 | Two-lane asset timeline (win-now vs. future assets) | Med | Med | High | Med | Deliverable 1 #24 |
| 37 | Correlated-risk flag across a roster (shared age/injury profile) | Med | Med | High | High | Deliverable 1 #22/#66 |
| 38 | Payroll simulator ("build your own team" under real cap rules) | High | High | High | High | Magic Feature #4 |
| 39 | Interactive trade machine enforcing real apron/matching rules | High | High | High | High | Magic Feature #2 |
| 40 | Championship-probability explorer with draggable what-ifs | High | High | High | High | Magic Feature #5 |
| 41 | Retention rights / exceptions "toolbox" inventory per team | Med | Med | Med | Med | Deliverable 1 #17 |
| 42 | Trade-exception countdown badges | Low | Low | Med | Med | Deliverable 1 #20 |
| 43 | Revenue-mix (gate vs. media) chart per league, over time | Med | Med | High | Med | Deliverable 1 #95 |
| 44 | Cap-growth vs. league-revenue-growth overlay chart | Med | Med | High | Med | Deliverable 1 #98 |
| 45 | Market-size-adjusted spending-efficiency metric | Low | Med | Med | High | Deliverable 1 #94 |
| 46 | Multi-sport model abstraction (surplus value engine generalized beyond NBA aprons) | High | High | Med | High | Raised in Deliverable 5's Yankees-exec persona critique |
| 47 | Public methodology/appendix page per model (academic-grade) | Med | Low | High | High | Deliverable 5's professor persona critique |
| 48 | Classroom licensing mode for Decision Rewind case studies | Med | Med | High | High | Deliverable 5's professor persona critique |
| 49 | Shareable "credential" profile tying LMS performance to analytics literacy | Med | Med | High | Med | Deliverable 5's college-student persona critique |
| 50 | Tighter IA between public `/analytics` and gated `/app`/`/dashboard` | High | Med | Med | Low | Deliverable 5 cross-persona finding |

## Tier 3 — Future (real investment; new subsystems)

| # | Idea | Impact | Difficulty | Edu. Value | Uniqueness | Note |
|---|---|---|---|---|---|---|
| 51 | Decision Rewind format (period-accurate info, step through outcome) | High | High | High | High | Magic Feature #7 — most original format on the whole list |
| 52 | Timed deadline-day simulation (real-time pressure decision game) | High | High | High | High | Magic Feature #6 — reuses `sim-eastfield.ts`/`sim-game.ts` patterns |
| 53 | Scrollytelling production pipeline (pinned-graphic long-form) | Med | High | Med | Med | Editorial Pattern #2 — reserve for flagship pieces only |
| 54 | Live combinatorial trade-matching sandbox (multi-team) | Med | High | High | High | Deliverable 1 #46 |
| 55 | Injury-risk actuarial tables by age/position/history | High | High | High | High | Deliverable 1 #61 — needs real injury data partnership |
| 56 | Regression-to-mean "how much of this is real" tool | Med | High | High | High | Deliverable 1 #64 |
| 57 | Play-type efficiency breakdown (Synergy-style radar chart) | Med | High | Med | Med | Deliverable 1 #75 — needs tracking-level data access |
| 58 | Tracking-data-derived metrics (speed/distance/closeout quality) | Med | High | Med | Med | Deliverable 1 #74 — needs optical/radar tracking data partnership |
| 59 | Defensive matchup-quality metric | Med | High | Low | High | Deliverable 1 #78 — genuinely hard, name the limitation honestly |
| 60 | Franchise-valuation explainer with real transaction comps | Med | Med | High | Med | Deliverable 1 #93 |
| 61 | Expansion-fee / ownership-economics tracker | Low | Med | Med | High | Deliverable 1 #97/#99 |
| 62 | CBA "family tree" diagram (revenue split cascading into cap rules) | Med | Med | High | High | Deliverable 1 #100 — strong capstone explainer |
| 63 | Herd-behavior "market heat" indicator during free agency | Low | Med | Med | High | Deliverable 1 #83 |
| 64 | Incentive-misalignment case-study series (coach vs. front office) | Med | Low | High | High | Deliverable 1 #82, Deliverable 3 #10 |
| 65 | War-room process simulation (roles, veto power, ticking clock) | Med | High | High | High | Deliverable 1 #86 |
| 66 | Cross-league comparative economics dashboard | Med | High | Med | Med | Extension of cluster J across NBA/NFL/MLB simultaneously |
| 67 | User-generated trade proposals with community voting/grading | Med | Med | Med | Low | Social layer on top of Magic Feature #2 |
| 68 | API/data licensing for third-party classroom or media use | Low | High | Med | High | Monetization angle tied to #47/#48 |
| 69 | Native mobile app (push alerts, offline reading) | Med | High | Low | Low | Standard scale-out; low uniqueness, still worth planning for |
| 70 | Multi-language / international-market localization | Low | High | Low | Low | Only relevant once international sports (soccer, etc.) are in scope |

## Tier 4 — Moonshots (high risk / high reward; new product lines or partnerships)

| # | Idea | Impact | Difficulty | Edu. Value | Uniqueness | Note |
|---|---|---|---|---|---|---|
| 71 | Real contract-insurance data partnership (actual underwriting terms) | High | High | High | High | Deliverable 1 #63 — would require industry relationships, not just data |
| 72 | Licensed real-time tracking data (Second Spectrum/NGS-caliber) | High | High | Med | High | Would elevate #57/#58/#74 from "explainer" to "genuinely proprietary tool" |
| 73 | Front-office "shadow GM" credentialing program (paid, certificate-bearing) | High | High | High | High | Extends #48; a real B2B/B2C education product line, not just a feature |
| 74 | Team/league partnership: Bow model used in an actual front-office context | High | High | Med | High | The ultimate credibility signal; requires trust built by #47/#11 first |
| 75 | Prediction-market-style "title odds" trading game (points, not money) | Med | High | Med | High | Combines Magic Feature #5 with a persistent competitive economy |
| 76 | AI-assisted "ask the model" conversational interface over the AASV engine | High | High | Med | High | A natural-language front end over existing structured data — high novelty risk, needs careful scoping to avoid hallucinated verdicts |
| 77 | Multi-sport unified platform (NBA + NFL + MLB + soccer) under one valuation grammar | High | High | Med | High | The long-run ambition implied by Deliverable 1's cross-sport framing; a multi-year bet, not a feature |
| 78 | Bow-branded broadcast/media product (a "Bow take" segment for existing sports media partners) | Med | High | Low | Med | Distribution moonshot rather than a product moonshot — extends brand beyond owned platform |

---

### Sequencing notes

- **Tier 1 is disproportionately cheap relative to impact** because so much of
  it is wiring existing infrastructure (`lib/glossary.ts`, `lib/notifications.ts`,
  `article_revisions`, `featured` flag, `LiveAssumptions.tsx`) into new surfaces,
  rather than building new systems — the implementation model should treat Tier 1
  as close to a "should already be done" backlog, not a stretch goal.
- **Tier 2 is where the CMS/embed-library work (Deliverable 7) and the
  Magic Features (Deliverable 4) converge** — most Tier 2 items are UI/embed
  work on top of the *existing* AASV/intelligence engine, not new modeling work.
- **Tier 3 is gated primarily by data access**, not by engineering difficulty —
  items #55, #57, #58, #59 all require licensed or partnered data sources Bow
  likely doesn't have today; sequence planning conversations with data-partnership
  conversations, not just sprint planning.
- **Tier 4 items are optionality, not commitments** — the point of naming them is
  to make sure no Tier 1-3 architectural decision accidentally forecloses them
  (e.g., building the AASV engine in a way that's genuinely single-sport would
  make #77 much harder later; keep the core valuation math sport-agnostic even
  while only NBA is shipped, per the Yankees-exec critique in Deliverable 5).
