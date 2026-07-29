# BOW Sports Capital

**The front office for the next generation.** Read the game. Run the business. Make the decision.

BOW Sports Capital is a sports-business education platform: middle and high school
students learn economics, finance, leadership, and strategy by making the same
decisions that shape teams, leagues, and the business of sports.

This repository contains both the public education experience and the BOW
Operating System used to plan Programs, staff Classes, run sessions, and manage
operational exceptions. It is built with **Next.js (App Router) + TypeScript**.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
npm test           # node:test suite
```

### Database

```bash
npm run migrate            # apply pending SQL migrations (forward-only, idempotent)
npm run content:bootstrap  # load the existing public website into the editor (insert-only)
npm run db:deploy          # both of the above, in order
```

Both are safe to re-run and never overwrite founder edits. See
[docs/website-content-system.md](docs/website-content-system.md) for the
deployment sequence, the publishing model, and what to do when a page reports a
fault.

## Project structure

```
app/                     App Router routes (one folder per public page)
  layout.tsx             Root layout — fonts, metadata, masthead + footer
  globals.css            Tokens import + base + keyframes + reveal utilities
components/
  ds/                    Design-system components (Button, CapLine, DecisionCard, …)
  site/                  Site chrome (Masthead, Footer, DataRibbon, ImageSlot, …)
lib/
  cms/                   Site content system — schemas, public reads, founder writes

styles/tokens/           Brand design tokens (colors, type, spacing, shape, fonts)
public/assets/           Brand SVGs (wordmark, monogram, cap line)
```

## Design system

The brand runs on four type voices — **Barlow Condensed** (display), **Newsreader**
(editorial serif), **Inter** (interface), **IBM Plex Mono** (data) — and two surface
modes: editorial (cream/white) and front-office (`.bow-front-office`, dark). All
colors, type scale, spacing, and shape live as CSS variables in `styles/tokens/`.
The signature device is the **Cap Line**. See `styles/tokens/` and `components/ds/`.

## Conventions

- Components/pages use inline `style` objects (faithful to the design tokens) plus a
  handful of global utility classes for hover, reveal, and parallax.
- Reveal/parallax: add `className="bow-reveal"`, `bow-reveal-sm`, `bow-wipe`,
  `bow-para-far`, `bow-para-sink`, `bow-para-up`, `bow-drift-l`, etc. (defined in
  `app/globals.css`). They use CSS scroll-driven timelines and degrade gracefully.
- Navigation uses `next/link`; the `Button` component renders a link when given `href`.
- Dynamic routes: `params` is a Promise in Next 16 — `await` it.

## Roadmap

- ✅ Public marketing site (this repo)
- ✅ Authentication (student / instructor / admin)
- ✅ Backend + persistence for cohorts, lessons, and the LMS app shell
- ✅ Expanded self-paced Track 101 (below)
- ✅ Track 201, two simulations, discussion board, weekly challenges,
  partner pages, in-app notifications, and onboarding (below)

## Expanded Track 101 experience

The self-paced product runs on the same SQLite backend with no new package dependencies.

| Route | Who | What |
| ----- | --- | ---- |
| `/dashboard` | student | Track 101 **and** Track 201 modules side by side, Weekly Challenge, BOW Daily, Econ Quiz (per track), notification bell, certificate download |
| `/dashboard/certificate` | student | Self-contained navy/gold certificate (idempotent; `?track=201` for Track 201) |
| `/onboarding` | new student | 4-screen first-run flow (shown once after signup) |
| `/discussion` | any signed-in | Three-channel discussion board: posts, replies, reactions, pins |
| `/profile` | student | BOW Rank, BOW Score, both tracks, reflections, quiz %, weekly + discussion counts, share button |
| `/profile/[id]` | public | Privacy-safe shareable record + Open Graph image |
| `/leaderboard` | any signed-in | Top 25 by BOW Score with cohort + time filters |
| `/simulation-room` | student (after Module 2) | 10-turn Westbrook Wolves game + BOW Economics Grade |
| `/front-office` | student (after Module 201-2) | 8-turn Eastfield Eagles "Front Office" sim + cap-efficiency report card |
| `/partners/[slug]` | public | Custom-branded outreach landing page + "Request a Demo" form + OG image |
| `/instructor` | instructor | Roster, Class Analytics, Weekly Report, Cohort Leaderboard |
| `/admin` | admin | Platform overview, cohort/user management, content, partners, health |

**Track 201 — Front Office Fundamentals** is an advanced 4-module track that unlocks
only after a student earns their Track 101 certificate. It carries its own quiz bank,
the Eastfield Eagles simulation, and a separate certificate.

**BOW Score** = modules×100 + MC-correct×10 + scenarios×15 + reflections×20 +
certificate×200 (per track) + Westbrook sim×150 + Eastfield sim×200 +
discussion posts×5 (capped at 50) + weekly-challenge completions×25.
**Ranks**: Rookie → Scout → Analyst → Front Office.

## Authentication & backend

The front office (`/app`) runs on a real, self-contained backend — no external
service required:

- **Database** — Supabase Postgres. Vercel runtime traffic uses the pooled
  `POSTGRES_URL`; one-time migration work uses `POSTGRES_URL_NON_POOLING`.
- **Passwords** — hashed with scrypt (`node:crypto`); see `lib/password.ts`.
- **Sessions** — random opaque tokens stored in an HttpOnly cookie; only their
  SHA-256 digests are stored in the database (`lib/session.ts`). Validated
  against the DB on every request.
- **Password recovery** — enumeration-safe requests issue 30-minute, single-use
  bearer tokens whose SHA-256 digests are the only token material stored. A
  successful reset revokes every account session and does not sign the user in.
- **Route protection** — `proxy.ts` (Next 16's renamed Middleware) does an
  optimistic cookie check; the authoritative check is in the app layout and every
  server action via the Data Access Layer (`lib/dal.ts`).
- **Mutations** — server actions in `app/actions/` (`auth.ts`, `lms.ts`) persist
  every change and verify authorization first.

### Signing in

Local seeded accounts use `SEED_PASSWORD`, or the historical development-only fallback when no local environment file exists. For example:

| Role        | Email                          |
| ----------- | ------------------------------ |
| Admin       | `dana@bowsportscapital.org`    |
| Instructor  | `marcus.reyes@lincolnhs.edu`   |
| Student     | `jalen.b@lincolnhs.edu`        |

Invited accounts (e.g. `aisha.o@lincolnhs.edu`) have no password until they
accept their invitation at `/accept-invitation#token=<secure-token>` (admins can copy the
link from the Invitations table).

Password recovery is available from `/forgot-password`. Production transactional
email uses the Resend REST API and requires `RESEND_API_KEY`, `BOW_EMAIL_FROM`, and
a public HTTPS `BOW_APP_URL` with no path, query, or credentials. Existing
deployments may keep `BOW_RESET_EMAIL_FROM` as a backwards-compatible sender
fallback. Verify the From domain in Resend. Missing or invalid delivery
configuration, provider failures,
unknown accounts, and throttled requests all retain the same public response;
an undelivered reset credential is deleted. Requesting another link atomically
invalidates every older link for that account. New reset URLs carry the bearer
token in the URL fragment so it is not sent in the initial HTTP request or ordinary
Referer headers; already-sent query-token links remain supported and are scrubbed
from browser history after hydration.

Password-reset and invitation email delivery run with Next.js `after()` once the
response is finished, which keeps provider latency from becoming an
account-enumeration signal. This is
not a durable outbound-email queue and does not automatically retry delivery. The
self-hosted process must receive `SIGINT` or `SIGTERM` and be allowed a 10–30 second
graceful drain so pending delivery callbacks can finish before shutdown.

Invitation links also carry the credential in the URL fragment. New and resent
student invitations, plus founder-approved instructor invitations, queue email
automatically after their database transaction commits. The issuing operator still
receives a one-time copy fallback; “queued” never means provider delivery is
guaranteed. Before sending, the callback rechecks that the exact invitation digest,
email, status, and expiry are still current. Provider/configuration failures create
a staff notification without storing or logging the raw credential.

For local testing only, set `BOW_APP_URL=http://localhost:3000` and
`BOW_REVEAL_RESET_LINKS=true` to reveal the link in the confirmation screen.
Production ignores this reveal flag. Never enable it in a shared environment.

Production never seeds the demo identities by default. A fresh production database
requires `BOW_BOOTSTRAP_ADMIN_EMAIL`, `BOW_BOOTSTRAP_ADMIN_NAME`, and a unique
`BOW_BOOTSTRAP_ADMIN_PASSWORD` of at least 16 characters. That bootstrap account is
flagged for immediate password rotation. On the first production start of an
existing database, every active credential is checked once and startup refuses to
continue if any account uses the historical public demo password. Production mode
never seeds demo identities or demo-authored content.

### SQLite → Supabase migration

1. Connect a new Supabase resource to the Vercel project.
2. Pull Vercel's variables locally, or place the direct/session connection in
   `POSTGRES_URL_NON_POOLING` inside `.env.local`.
3. Run `npm run db:migrate:supabase`. The importer reads `data/bow.db`, creates
   the Postgres tables/indexes/foreign keys, copies every row, enables RLS, and
   verifies the row count of every table.
4. Deploy with the pooled `POSTGRES_URL` supplied by the integration.

The importer refuses to write over existing BOW tables. `--force` exists only
for intentionally replacing a test import. To migrate a different SQLite file,
run `npm run db:migrate:supabase -- --source=/absolute/path/to/bow.db`.

Editorial mirrors require two separate stores: `BLOB_READ_WRITE_TOKEN` for the
public, published-only article payloads and `ARTICLE_PRIVATE_BLOB_READ_WRITE_TOKEN`
for a store configured with private access. Keep both tokens available during the
privacy migration so legacy public full-row artifacts can be discovered and removed.

Sign-in and public-intake throttles are persisted in SQLite. To enable their network
bucket, set `BOW_TRUSTED_CLIENT_IP_HEADER` to `x-forwarded-for`, `x-real-ip`, or
`cf-connecting-ip`, and configure the production reverse proxy to replace that one
header with one canonical client IP (not an untrusted forwarded chain). Other
forwarding headers are ignored, and a configured header that is missing or malformed
fails closed. Identity-based limits remain active when no trusted client-address
header is configured.

For a disposable local-development database only, you may delete the local `data/`
directory and restart to re-seed. Never run that reset against production or any
directory mounted from a production backup or durable volume.
