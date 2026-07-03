/* ============================================================
 * NBA team identity — pure lookups, no I/O.
 *
 * The curated contract list (data-seeds/contracts.csv) only ever
 * references a handful of teams at a time, but the team pages need
 * every team's full name up front (nav, metadata, sitemap) so a
 * roster addition never produces an "undefined" title. Abbreviations
 * are the standard 3-letter NBA codes.
 * ============================================================ */

/** Every NBA franchise, keyed by its 3-letter abbreviation. */
export const TEAM_NAMES: Record<string, string> = {
  ATL: "Atlanta Hawks",
  BOS: "Boston Celtics",
  BKN: "Brooklyn Nets",
  CHA: "Charlotte Hornets",
  CHI: "Chicago Bulls",
  CLE: "Cleveland Cavaliers",
  DAL: "Dallas Mavericks",
  DEN: "Denver Nuggets",
  DET: "Detroit Pistons",
  GSW: "Golden State Warriors",
  HOU: "Houston Rockets",
  IND: "Indiana Pacers",
  LAC: "LA Clippers",
  LAL: "Los Angeles Lakers",
  MEM: "Memphis Grizzlies",
  MIA: "Miami Heat",
  MIL: "Milwaukee Bucks",
  MIN: "Minnesota Timberwolves",
  NOP: "New Orleans Pelicans",
  NYK: "New York Knicks",
  OKC: "Oklahoma City Thunder",
  ORL: "Orlando Magic",
  PHI: "Philadelphia 76ers",
  PHX: "Phoenix Suns",
  POR: "Portland Trail Blazers",
  SAC: "Sacramento Kings",
  SAS: "San Antonio Spurs",
  TOR: "Toronto Raptors",
  UTA: "Utah Jazz",
  WAS: "Washington Wizards",
};

/** Full franchise name for an abbreviation; falls back to the raw code for anything unmapped. */
export function teamName(abbr: string): string {
  return TEAM_NAMES[abbr] ?? abbr;
}

/** URL-safe slug for a team — just the lowercased abbreviation. */
export function teamSlug(abbr: string): string {
  return abbr.toLowerCase();
}

/** Inverse of teamSlug — the abbreviation as stored on AnalyticsPlayer.team. */
export function teamFromSlug(slug: string): string {
  return slug.toUpperCase();
}
