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
- ⏳ Authentication (student / instructor / admin)
- ⏳ Backend + persistence for cohorts, lessons, and the LMS app shell
