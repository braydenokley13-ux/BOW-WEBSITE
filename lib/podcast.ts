/* ============================================================
 * Podcast page content — ported from the design prototype.
 * ============================================================ */

export interface PodcastEpisode {
  num: string;
  topic: string;
  title: string;
  desc: string;
  track: string;
  module: string;
  runtime: string;
  concept: string;
}

export const podcastAllEpisodes: PodcastEpisode[] = [
  { num: "EP 08", topic: "Revenue Economics", title: "Why Leagues Share Revenue", desc: "How revenue sharing creates competitive balance — and why some owners hate it.", track: "Track 201", module: " · M1", runtime: "44 MIN", concept: "Revenue sharing" },
  { num: "EP 07", topic: "Salary Cap", title: "The Apron Era: How One Rule Rewired the League", desc: "A deep look at how the second apron changed the calculus for every front office.", track: "Track 101", module: " · M3 L2", runtime: "38 MIN", concept: "Constraints" },
  { num: "EP 06", topic: "Team Building", title: "Stars, Role Players, and the Math of a Contender", desc: "Roster construction as an optimization problem — and why stars alone don’t win.", track: "Track 101", module: " · M2 L1", runtime: "41 MIN", concept: "Allocation" },
  { num: "EP 05", topic: "Ownership", title: "Who Really Pays When a Team Wins?", desc: "Where franchise revenue comes from — and who bears the costs.", track: "Track 201", module: " · M1 L3", runtime: "35 MIN", concept: "Revenue" },
  { num: "EP 04", topic: "Sports Economics", title: "Opportunity Cost, Explained in Trades", desc: "Why the best front offices obsess over the deal they didn’t make.", track: "Track 101", module: " · M1 L2", runtime: "33 MIN", concept: "Opportunity cost" },
  { num: "EP 03", topic: "Stadium Economics", title: "Who Really Pays for the Arena?", desc: "Public financing, private profit, and the economics of naming rights.", track: "Track 201", module: " · M3", runtime: "39 MIN", concept: "Public economics" },
  { num: "EP 02", topic: "Sports Economics", title: "Are Superteams Bad Economics?", desc: "Competitive balance, luxury taxes, and why the league might want you to lose.", track: "Track 101", module: " · M1 L1", runtime: "37 MIN", concept: "Market power" },
  { num: "EP 01", topic: "Media Rights", title: "The Business Behind the Broadcast", desc: "Media deals, attention markets, and why a game can’t exist without a network.", track: "Track 201", module: " · M4", runtime: "42 MIN", concept: "Media economics" },
];

export interface PodTakeaway {
  n: string;
  text: string;
}

/** Featured-player takeaways (latest episode "Why Leagues Share Revenue"). */
export const podTakeaways: PodTakeaway[] = [
  { n: "01", text: "Revenue sharing exists to prevent small-market collapse — not equalize ambition." },
  { n: "02", text: "The teams that hate sharing the most are usually earning the most." },
  { n: "03", text: "Incentive systems designed for fairness always have unintended consequences." },
];
