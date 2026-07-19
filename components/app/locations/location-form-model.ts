import type { LocationStage } from "@/lib/operations-shared";

export const LOCATION_TYPES = [
  "school",
  "community_center",
  "camp",
  "partner_site",
  "sports_facility",
  "college",
  "regional_chapter",
  "virtual_hub",
  "other",
] as const;

export type LocationType = (typeof LOCATION_TYPES)[number];

export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  school: "School",
  community_center: "Community center",
  camp: "Camp",
  partner_site: "Partner site",
  sports_facility: "Sports facility",
  college: "College or university",
  regional_chapter: "Regional chapter",
  virtual_hub: "Virtual hub",
  other: "Other",
};

/**
 * Location lifecycle is intentionally narrower than Program lifecycle.
 * Active markets must pause before they can become historical, and a launch
 * can only advance to Active or return to an earlier planning state.
 */
const LOCATION_TRANSITIONS: Record<LocationStage, LocationStage[]> = {
  prospect: ["evaluating", "closed"],
  evaluating: ["prospect", "launching", "paused", "closed"],
  launching: ["evaluating", "active", "paused"],
  active: ["paused"],
  paused: ["evaluating", "launching", "active", "closed"],
  closed: [],
};

export function allowedLocationTransitions(stage: LocationStage): LocationStage[] {
  return [...(LOCATION_TRANSITIONS[stage] ?? [])];
}
