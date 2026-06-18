/* ============================================================
 * Highway World page content — ported from the design prototype.
 * ============================================================ */

export interface HwDistrict {
  code: string;
  title: string;
}

export const hwDistricts: HwDistrict[] = [
  { code: "DISTRICT 01", title: "Stadium District" },
  { code: "ROW 02", title: "Sponsor Row" },
  { code: "ZONE 03", title: "Fan Zone" },
  { code: "TOWER 04", title: "Media Tower" },
  { code: "OFFICE 05", title: "League Offices" },
  { code: "DISTRICT 06", title: "Revenue Row" },
  { code: "FACILITY 07", title: "Practice Facility" },
  { code: "ROOM 08", title: "Draft War Room" },
  { code: "HQ 09", title: "Ownership HQ" },
];

export interface HwMission {
  title: string;
  type: string;
  desc: string;
}

export const hwMissions: HwMission[] = [
  { title: "Stadium Financing Deal", type: "Negotiation", desc: "The city wants a new arena. You want public money. Neither of you wants to blink first." },
  { title: "Emergency Trade Deadline", type: "Decision", desc: "Four hours to move a player or lose him for nothing. The league is watching." },
  { title: "Sponsor Contract Renewal", type: "Negotiation", desc: "Your jersey sponsor wants a better deal. Fan trust says hold the line." },
  { title: "Draft Room on the Clock", type: "Decision", desc: "One pick, three good options, and a rival trading up behind you." },
];

export interface HwMetric {
  name: string;
  desc: string;
}

export const hwMetrics: HwMetric[] = [
  { name: "Cash", desc: "The franchise budget. Every decision earns or costs." },
  { name: "Clout", desc: "Reputation and influence across the league." },
  { name: "Chemistry", desc: "How the locker room holds under pressure." },
  { name: "Wins", desc: "What it all comes down to." },
];
