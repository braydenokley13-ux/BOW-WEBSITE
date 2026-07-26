/* ============================================================
 * BOW Sports Capital — typeface loading.
 *
 * The four brand voices are self-hosted through `next/font/google`, which
 * downloads and subsets them at build time and emits `<link rel="preload">`
 * plus a `size-adjust`ed fallback face. That removes the render-blocking
 * round-trip to fonts.googleapis.com the stylesheet `@import` used to make,
 * and removes the layout shift that came with it.
 *
 * Each family is exposed as a CSS custom property so `styles/tokens/
 * typography.css` can keep owning the *semantics* (`--font-display` and
 * friends); this file only owns *delivery*. Weights are pinned to the ones
 * the product actually uses — every extra weight is bytes on the wire.
 * ============================================================ */

import { Barlow_Condensed, Newsreader, Inter, IBM_Plex_Mono } from "next/font/google";

/** Display — headlines, buttons, eyebrows. Not a variable font: pin weights. */
export const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700", "900"],
  variable: "--font-display-loaded",
  display: "swap",
  fallback: ["Arial Narrow", "sans-serif"],
});

/** Editorial serif — the marketing voice. Variable (optical size + weight). */
export const editorial = Newsreader({
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
  variable: "--font-editorial-loaded",
  display: "swap",
  fallback: ["Georgia", "Times New Roman", "serif"],
});

/** Interface — body copy, forms, portal UI. Variable. */
export const interface_ = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-interface-loaded",
  display: "swap",
  fallback: ["system-ui", "-apple-system", "sans-serif"],
});

/** Data — stats, metadata, tabular numerals. Not variable: pin weights. */
export const data = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-data-loaded",
  display: "swap",
  fallback: ["SFMono-Regular", "ui-monospace", "monospace"],
});

/** Applied once, on <html>, by the root layout. */
export const fontVariables = [
  display.variable,
  editorial.variable,
  interface_.variable,
  data.variable,
].join(" ");
