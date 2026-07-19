# BOW OS — Growth-Stage Operating Model

## Decision

BOW's next constraint is not another marketing dashboard. It is the absence of
one canonical chain connecting acquisition effort to verified student
participation, retention, referrals, contributor ownership, market capacity,
and reusable learning.

The growth operating layer therefore extends the existing model instead of
copying it:

- **People** remain the persistent human identity.
- **Students** remain the persistent learner identity.
- **Programs and Classes** remain the plan and delivery records.
- **Finalized session attendance** is the source of truth for verified service.
- **Work** remains the owner/next-action/deadline layer.
- **Regions and Locations** remain the market hierarchy.
- New growth records explain how a person reached BOW, who contributed, what
  tactic was being tested, and whether that effort led to real participation.

## Honest metric definitions

These definitions are product rules, not dashboard labels:

| Metric | Canonical evidence |
| --- | --- |
| Lead | A valid public inquiry or identified acquisition touchpoint. |
| Registration | A Class enrollment record. |
| Confirmation | An explicit confirmation timestamp on that enrollment. It is never inferred from a form view. |
| Verified participation | `present` or `late` attendance on a finalized Class session. Raw registration is not service. |
| Program enrollment | A Student's enrollment in a Class belonging to the Program. |
| Completion | An explicit, attributed Student/Program outcome; attendance alone does not invent completion. |
| Repeat participation | Verified participation in at least two distinct Programs. Multiple sessions in one Program do not inflate retention. |
| Successful referral | The referred Student reaches verified participation. Sending a link or registering is an intermediate state. |
| Channel conversion | Students with the target evidence divided by attributable people who reached the prior stage. |
| Acquisition cost | Attributed spend divided by verified first-time participants, with registration cost shown separately. |

Every read model must preserve the denominator and evidence window so leaders
cannot accidentally compare incompatible rates.

## Canonical growth network

The durable foundation consists of:

1. **Channels** — the stable source category, such as student referral,
   instructor referral, ambassador outreach, school distribution, local event,
   organic social, or paid acquisition.
2. **Campaigns** — a bounded operating effort with hypothesis, owner, market,
   dates, target metric, budget/spend, result, decision, and reusable learning.
3. **Contributors** — a Person's growth-network identity.
4. **Assignments** — temporal roles and reporting lines such as Ambassador,
   Growth Captain, Market Lead, and Regional Lead. Hierarchy is explicit; the
   founder is not the implicit manager of every contributor.
5. **Goals** — time-bounded targets attached to an accountable operating entity
   and owner. Actuals are derived from evidence rather than manually typed.
6. **Touchpoints and attribution** — append-only facts connecting People and
   Students to channels, campaigns, contributors, and referrers.
7. **Referrals** — a Person-to-Person relationship whose success is derived
   only when the referred learner meaningfully participates.
8. **Student/Program outcomes** — explicit completion and progression evidence.
9. **Playbooks** — promoted learning from completed campaigns, with an owner
   and evidence source so successful tactics become repeatable.

## Delegation model

An assignment owns a scope, not just a title:

```text
Founder / senior leadership
  -> Regional Lead
    -> Market Lead
      -> Growth Captain
        -> Ambassador
```

The same pattern can later support Instructor Captains without merging growth
impact and teaching quality into one score. A contributor owns exactly one
current assignment. Advancement or market transfer closes that dated interval
with an accountable reason and starts another; the full assignment history is
retained.

Each active assignment must be able to answer:

- who manages this person;
- which Region or Location they own;
- what goal is active;
- what Work is open;
- how many registrations, verified participants, repeat participants, and
  successful referrals their contribution produced;
- when they last contributed;
- what next level is available and what evidence is missing.

## Market and capacity intelligence

Market health is derived from existing and new facts rather than stored as a
subjective score. For each Region and Location, leadership should see:

- attributable leads, registrations, confirmations, and verified participants;
- first-time versus returning participants;
- active campaigns and contributor capacity;
- upcoming seats, registrations, waitlist, and unused seats;
- ready/available instructors and uncovered sessions;
- quality exceptions and incomplete reports;
- the primary imbalance: demand, instructor supply, program capacity,
  leadership, or quality.

This creates one operating language for deciding whether a market should grow
demand, add instructors, schedule Programs, develop leaders, or pause expansion.

Campaign geography is the first market signal. When outreach has no
Location-scoped campaign, the contributor's assignment on the touchpoint's local
calendar date supplies the market. This means direct ambassador work appears in
demand/capacity decisions without fabricating a campaign, while cross-Location
credit remains blocked.

Lead identity is also resolved deliberately. A Student ID wins; an exact direct
Person identity or a guardian linked to exactly one Student can converge to that
Student; a multi-child guardian remains a Person-level lead until the learner is
known. This prevents both double counting and sibling guessing.

## Founder cockpit integration

Growth does not become a separate executive dashboard. The existing
management-by-exception Home adds only evidence-backed exceptions:

- acquisition or milestone pace materially behind plan;
- a Program with unused near-term capacity;
- waitlisted or high-demand Programs without supply;
- an active campaign with no owner, expired dates, or no decision;
- a contributor team with an unassigned manager;
- a market missing a required leadership layer;
- referral or retention deterioration;
- high spend without verified participation.

Routine healthy records stay in Growth and Market workspaces. Founder Home
shows the small set of decisions that genuinely require senior attention.

## Storage boundary

The current SQLite deployment can validate the product model and support an
initial operating organization on one durable host. The normalized IDs,
append-only evidence, explicit scopes, and indexed event dates are designed for
a later Postgres migration. Multi-instance and multi-region deployment must not
pretend a local SQLite file is distributed infrastructure.

## Delivered operating workflows

- Campaigns move through draft, active, paused, completed, or cancelled states.
  Terminal state requires a system-derived result, a decision, and durable
  learning; active state cannot carry a typed success result.
- Spend-to-date changes require a note explaining the invoice, expense, or
  correction, and the activity record stores the exact delta.
- Goals close to achieved or missed from canonical evidence; an operator cannot
  type the result or label a miss as a win.
- Contributor roles form non-overlapping dated intervals. A manager cannot close
  before every report, and an interval cannot close before its latest evidence.
- Contributor membership supports pause, reactivation, and terminal alumni
  status after the current role closes.
- Referrals share one touchpoint evidence record, one void path, and success only
  after finalized attendance.
- New Class sessions preserve both the exact instant/timezone and canonical local
  date, so multi-city metric windows do not drift through UTC midnight.
- High-cardinality identities are searched on demand through a staff-only,
  debounced, 20-result reader; small stable operational lists remain server
  rendered.

## Remaining product boundaries

1. Build a least-privilege contributor portal and claimable referral links; do
   not solve this by granting community contributors staff Growth access.
2. Replace manually reconciled campaign spend totals with an immutable
   invoice/expense ledger when finance integration becomes available.
3. Move SQLite to Postgres before multi-instance or multi-region hosting while
   retaining these IDs, evidence relations, and lifecycle contracts.
4. Move outbound messages to a durable queue before horizontal deployment.
5. Add cohort/market forecasting only after enough verified local evidence
   exists; do not store a subjective expansion score today.
