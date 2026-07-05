# Features That Feel Like Magic

**Purpose:** concrete, shareable features — the kind a reader screenshots and
sends to a group chat, not gimmicks. Each entry states the mechanic, the specific
"aha" moment it's built around, and the real value it delivers (not just novelty).
Ordered roughly by build cost, cheapest/highest-leverage first — this list is
meant to feed directly into Deliverable 6's roadmap tiers, not replace it.

---

## 1. "What Would You Do?" Decision Challenges

**Mechanic:** present a real, dated front-office decision stripped of its known
outcome ("it's July 2023. This player has one year left. Extend, trade, or let
him walk?"). Reader picks, sees the reasoning behind each option, then the actual
outcome and how their pick would have graded.

**The aha:** the reader discovers whether their gut instinct matches front-office
logic *before* being told the answer — makes the whole platform feel like a test
of skill, not a lecture.

**Why it's real value, not a gimmick:** it's graded against Deliverable 3's
process-over-outcome principle — the challenge should reward good reasoning even
when the dice landed badly, teaching the actual skill rather than rewarding
lucky guesses.

**Shareability:** a results card ("You'd have made the Bargain-tier call 7/10
times — better than 82% of readers") is inherently screenshot-bait, the same
mechanic that made Wordle/NYT games viral.

---

## 2. Interactive Trade Machine (Real Rules, Real Consequences)

**Mechanic:** a drag-and-drop trade builder that enforces actual salary-matching
and apron rules live, and immediately shows the AASV swing for both rosters.

**The aha:** the moment a reader's "obviously fair" trade gets rejected by the
real cap rules — teaches Deliverable 1's contract-mechanics cluster (#11-20)
through friction, not exposition.

**Why it's real value:** it's the tool actual front-office staffers and hardcore
fans already use unofficially (spreadsheets, third-party trade machines) — Bow
doing it natively, tied to its own valuation engine, is a strict upgrade over
existing tools that stop at "is this legal" without also answering "is this good."

**Shareability:** a generated trade-proposal card with both teams' logos, the
swap, and the verdict — built to be posted, exactly like fan-made trade graphics
already are on social media, but with real math behind it.

---

## 3. Contract Stress Test

**Mechanic:** take any real contract and simulate it forward under adjustable
scenarios (player ages on-curve / ages badly / gets hurt / breaks out) — show the
range of surplus-value outcomes, not one projection.

**The aha:** seeing the *same* contract labeled "smart bet" in one scenario and
"albatross" in another, with the same starting assumptions, teaches risk
(Deliverable 1, cluster G) more viscerally than any explainer paragraph.

**Why it's real value:** this is functionally the same exercise real front
offices and cap analysts run before signing off on a deal — Bow exposing it
directly is a rare "you get to do the actual job" feature.

**Shareability:** "I stress-tested [contract] and it breaks even in 73% of
scenarios" is an inherently arguable, postable claim.

---

## 4. Payroll/Roster Simulator ("Build Your Own Team")

**Mechanic:** start from a real team's actual cap sheet, make moves (sign, trade,
extend, waive) within real rules, and watch the roster's AASV total, cap
compliance, and championship-window status update live.

**The aha:** discovering just how *few* good moves are actually available under
real constraints — most fans' armchair GM instincts ("just sign everyone good")
break immediately against real cap math.

**Why it's real value:** this is the single most requested "let me actually be
the GM" feature category in the sports-fan space (see: Front Office Football,
EA's franchise modes, real fantasy-GM communities) — Bow's differentiator is
tying it to *real, current* rosters and cap sheets rather than a generic game
engine.

**Shareability:** a shareable "final roster" card with the reader's total
AASV score vs. the real team's actual score — natural leaderboard/competitive
loop.

---

## 5. Championship Probability Explorer

**Mechanic:** a live model showing a team's title odds, decomposed into the
factors driving it (health, remaining schedule, competitive-window stage) —
draggable to test "what if we made this trade" or "what if this player gets
hurt" scenarios.

**The aha:** watching title odds swing by a specific, quantified amount from a
single hypothetical injury or trade — makes an abstract "this changes
everything" sports-talk claim into an actual number.

**Why it's real value:** ties directly to Deliverable 1's #56/#57 (title equity,
buy-or-sell calculus) — gives those concepts a home as a living tool rather than
a static explainer.

**Shareability:** "our title odds dropped 9 points the moment he got hurt" is
exactly the kind of specific, debatable number sports media thrives on
amplifying.

---

## 6. Front-Office Quiz / Draft Simulator

**Mechanic:** a timed, deadline-day-style simulation forcing rapid-fire decisions
under real constraints (a ticking clock, incomplete information, a rival team
making a move mid-simulation) — scored against both outcome and process quality.

**The aha:** the time pressure itself is the lesson (Deliverable 3, #12 — process
under pressure) — most analytics content is untimed and reflective; this format
recreates the actual stress of the job.

**Why it's real value:** directly reusable inside Bow's existing LMS/simulation
infrastructure (`sim-eastfield.ts`, `sim-game.ts` already exist) — this is more
"connect an existing capability to the analytics side" than "build from
scratch."

**Shareability:** leaderboard integration with Bow's existing BOW Score/rank
system (already documented in the README) — a natural extension, not a new
system.

---

## 7. Decision Rewind

**Mechanic:** pick any real, consequential front-office decision from the past
and "rewind" to the moment right before it was made — see only the information
available then, make your own call, then step forward chronologically through
what actually happened, checkpoint by checkpoint.

**The aha:** hindsight bias made visceral — a decision that looks obviously wrong
in retrospect ("why did they ever sign that deal") often looks completely
reasonable once you're restricted to the information available at the time.

**Why it's real value:** this is a rare, genuinely original format — most sports
media either covers the present or looks back with full hindsight; almost none
deliberately restrict the reader's information to recreate the original
epistemic position, which is *the* core skill (process over outcome) Bow is
trying to teach.

**Shareability:** "I would have made the exact same mistake they did" is a
disarming, highly shareable admission format — more compelling than "I would
have been smarter than them."

---

## 8. The Verdict Flip Alert

**Mechanic:** an opt-in notification/feed item that fires when a real-world event
(injury, trade, extension) flips a contract's verdict tier in Bow's live model —
"the Smith contract just flipped from Fair to Bargain."

**The aha:** the platform feels alive and responsive to real news, not a static
reference site — the model visibly reacting to the world in real time is the
single strongest signal that "this isn't just a stats page, it's a live opinion
that updates."

**Why it's real value:** directly reuses existing infrastructure
(`lib/notifications.ts`, `app/api/cron`) — likely the cheapest build on this
entire list relative to its impact, since the compute (AASV recalculation) and
delivery (notifications) both already exist; the net-new work is mostly a
trigger/threshold layer.

**Shareability:** individual verdict-flip cards are natural social posts,
functioning like a "stock price alert" for sports contracts.

---

## 9. Two-Team Trade Fit Finder

**Mechanic:** pick any team, and the tool surfaces realistic trade partners based
on complementary needs (cap situation, timeline, asset surplus/deficit) rather
than requiring the reader to already have a specific trade in mind.

**The aha:** discovering a plausible trade partner the reader hadn't considered,
generated from actual constraint-matching rather than fan speculation — reframes
"who should we trade for" from a guessing game into a search problem with a
real answer space.

**Why it's real value:** most fan trade speculation starts from "I want player
X" and works backward, often into cap-illegal fantasy; this tool starts from
real constraints and works forward into what's actually possible, directly
teaching Deliverable 1's trade-liquidity concepts (#41-50).

**Shareability:** "surprising trade partner" discoveries are classic sports-talk
content, but here backed by an actual matching engine instead of a take.

---

## 10. The "Explain Like I'm a GM" / "Explain Like I'm a Fan" Toggle

**Mechanic:** a reading-level toggle on any article or embed that rewrites the
same underlying content at two registers — a terse, jargon-fluent GM-memo
version and a plainer, more explanatory fan version — same data, same verdict,
different vocabulary density.

**The aha:** readers self-select their own fluency level without feeling talked
down to *or* lost — directly solves the dual-audience problem named across
Deliverables 2 and 5 without maintaining two separate content pipelines.

**Why it's real value:** this is a genuinely differentiated, low-gimmick feature
— few sports-analytics sites let the *same* piece serve both a beginner and an
expert without picking one audience to disappoint.

**Shareability:** less inherently viral than the others, but high retention
value — likely the single best lever for the "returns every week" test in
Deliverable 5's persona critique, since it removes the single biggest reason a
casual reader stops coming back (feeling out of their depth).

---

### Selection notes for the implementation model

- **#8 (Verdict Flip Alert)** and **#10 (reading-level toggle)** are the two
  highest ratio of impact-to-build-cost, since both are thin layers over
  infrastructure that already exists (notifications/cron, and the
  articles/AASV content model respectively) — strong MVP candidates.
- **#2 (Trade Machine)** and **#4 (Roster Simulator)** are the most technically
  demanding (real cap-rule engines, live recomputation) but also the most
  "magic" in the literal sense — reserve for a dedicated build phase, not a
  quick add-on.
- **#1, #6, #7** all reuse the same underlying primitive — a "decision at a
  point in time, graded on process not outcome" — and could share a single
  content/data model even though they present differently (deadline sim vs.
  slow-reflective rewind vs. quiz format). Worth building that shared primitive
  once rather than three separate one-offs.
