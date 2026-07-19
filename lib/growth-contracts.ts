/** Browser-safe shared vocabulary for Growth forms and server evidence rules. */
export const CAMPAIGN_METRICS = [
  "leads",
  "registrations",
  "confirmations",
  "verified_participants",
  "repeat_participants",
  "successful_referrals",
] as const;

export const GROWTH_METRICS = [
  ...CAMPAIGN_METRICS,
  "active_contributors",
  "ready_instructors",
  "available_seats",
] as const;

export type CampaignMetric = (typeof CAMPAIGN_METRICS)[number];
export type GrowthMetric = (typeof GROWTH_METRICS)[number];
export type GoalScopeType = "organization" | "region" | "location" | "campaign" | "assignment" | "program";
