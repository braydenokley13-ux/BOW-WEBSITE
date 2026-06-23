# BOW Sports Capital

**The front office for the next generation.** Read the game. Run the business. Make the decision.

BOW Sports Capital is a sports-business education platform: middle and high school
students learn economics, finance, leadership, and strategy by making the same
decisions that shape teams, leagues, and the business of sports.

This repository is the marketing/editorial website, implemented from the Claude
Design handoff. It is built with **Next.js (App Router) + TypeScript** and is
structured so the authentication layer and backend can be added later.

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run lint     # eslint
```

## Project structure

```
app/                     App Router routes (one folder per public page)
  layout.tsx             Root layout — fonts, metadata, masthead + footer
  globals.css            Tokens import + base + keyframes + reveal utilities
components/
  ds/                    Design-system components (Button, CapLine, DecisionCard, …)
  site/                  Site chrome (Masthead, Footer, DataRibbon, ImageSlot, …)
lib/                     Typed content/config (site nav, page data)
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

## Expanded Track 101 experience

The self-paced product runs on the same SQLite backend (no new dependencies and
no new environment variables — `SEED_PASSWORD` is still the only optional one):

| Route | Who | What |
| ----- | --- | ---- |
| `/dashboard` | student | Modules, BOW Daily (20 scenarios, difficulty + archive + "how others answered"), Econ Quiz (12/module, difficulty + Review Mode), certificate download |
| `/dashboard/certificate` | student | Self-contained navy/gold certificate (idempotent, all 4 modules required) |
| `/profile` | student | BOW Rank, BOW Score, modules, reflections, quiz %, share button |
| `/profile/[id]` | public | Privacy-safe shareable record + Open Graph image |
| `/leaderboard` | any signed-in | Top 25 by BOW Score with cohort + time filters |
| `/simulation-room` | student (after Module 2) | 10-turn GM economics game + BOW Economics Grade |
| `/instructor` | instructor | Roster, Class Analytics, Weekly Report, Cohort Leaderboard |
| `/admin` | admin | Platform overview, cohort/user management, content overview, health |

**BOW Score** = modules×100 + MC-correct×10 + scenarios×15 + reflections×20 +
certificate×200 + simulation×150. **Ranks**: Rookie → Scout → Analyst → Front Office.

## Authentication & backend

The front office (`/app`) runs on a real, self-contained backend — no external
service required:

- **Database** — SQLite via Node's built-in `node:sqlite` driver. The file lives
  at `data/bow.db` (gitignored) and is created and seeded from `lib/account.ts`
  on first boot, so the app comes up with the prototype's data already loaded.
- **Passwords** — hashed with scrypt (`node:crypto`); see `lib/password.ts`.
- **Sessions** — database-backed opaque tokens stored in an HttpOnly cookie
  (`lib/session.ts`). Validated against the DB on every request.
- **Route protection** — `proxy.ts` (Next 16's renamed Middleware) does an
  optimistic cookie check; the authoritative check is in the app layout and every
  server action via the Data Access Layer (`lib/dal.ts`).
- **Mutations** — server actions in `app/actions/` (`auth.ts`, `lms.ts`) persist
  every change and verify authorization first.

### Signing in

Seeded accounts share the development password **`bowdemo123`**. For example:

| Role        | Email                          |
| ----------- | ------------------------------ |
| Admin       | `dana@bowsportscapital.org`    |
| Instructor  | `marcus.reyes@lincolnhs.edu`   |
| Student     | `jalen.b@lincolnhs.edu`        |

Invited accounts (e.g. `aisha.o@lincolnhs.edu`) have no password until they
accept their invitation at `/accept-invitation?token=<id>` (admins can copy the
link from the Invitations table).

To reset everything, delete the `data/` directory and restart — it re-seeds.
