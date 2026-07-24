/* ============================================================
 * Growth attribution — client-safe contracts & pure logic.
 *
 * BOW grows through people who bring other people: an instructor refers
 * another instructor, a family refers another family, an instructor or
 * partner introduces a school. Those loops already exist as three canonical
 * spines keyed by Person (instructors.referred_by_person_id, student_referrals,
 * growth_introductions). This module is the single honest lens over all three:
 * for any Person, "what growth did they generate, and what verified outcome
 * resulted?" — never clicks or intent, only downstream facts.
 *
 * No database or server-only imports. Every rule here is deterministic and
 * unit-testable; the server module fills the shapes from canonical queries.
 * ============================================================ */

/** The three canonical ways a Person brings growth to BOW. */
export type AttributionChannel = "instructor_referral" | "family_referral" | "partner_introduction";

export const ATTRIBUTION_CHANNELS: readonly AttributionChannel[] = [
  "instructor_referral",
  "family_referral",
  "partner_introduction",
] as const;

export interface ChannelMeta {
  channel: AttributionChannel;
  /** Short label for the channel itself. */
  label: string;
  /** What "referred" counts. */
  referredNoun: string;
  /** What "converted" — the verified downstream outcome — means for this channel. */
  convertedNoun: string;
}

export const CHANNEL_META: Record<AttributionChannel, ChannelMeta> = {
  instructor_referral: {
    channel: "instructor_referral",
    label: "Instructor referrals",
    referredNoun: "referred",
    convertedNoun: "became active",
  },
  family_referral: {
    channel: "family_referral",
    label: "Family referrals",
    referredNoun: "referred",
    convertedNoun: "verified participation",
  },
  partner_introduction: {
    channel: "partner_introduction",
    label: "Partner introductions",
    referredNoun: "introduced",
    convertedNoun: "became a partner",
  },
};

/** One channel's contribution for one Person — all counts are canonical facts. */
export interface AdvocateChannelStat {
  channel: AttributionChannel;
  /** People/orgs this Person referred or introduced through this channel. */
  referred: number;
  /** Reached a real milestone (instructor accepted+, family registered, intro contacted+). */
  advanced: number;
  /** Verified downstream outcome (instructor active, referred student verified, intro converted). */
  converted: number;
  /** Students actually reached downstream of this channel's conversions. */
  studentsReached: number;
}

/** A Person and the total, cross-channel growth they have generated. */
export interface Advocate {
  personId: string;
  name: string;
  channels: AdvocateChannelStat[];
  /** Sum of referred/introduced across channels. */
  totalReferred: number;
  /** Sum of advanced across channels. */
  totalAdvanced: number;
  /** Sum of verified conversions across channels. */
  totalConverted: number;
  /** Instructors this Person referred who reached the active stage. */
  activeInstructorsGenerated: number;
  /** Partner organizations this Person's introductions produced. */
  partnersGenerated: number;
  /** Distinct students reached downstream of everything this Person set in motion. */
  studentsReached: number;
  /** Most recent attributable touch, for staleness — ms epoch or null. */
  lastActivityAt: number | null;
}

function stat(overrides: Partial<AdvocateChannelStat> & { channel: AttributionChannel }): AdvocateChannelStat {
  return { referred: 0, advanced: 0, converted: 0, studentsReached: 0, ...overrides };
}

/**
 * Assemble a Person's channel stats into a scored Advocate. Rolls up the
 * cross-channel totals every consumer needs and keeps only channels the Person
 * actually used, in canonical order.
 */
export function buildAdvocate(input: {
  personId: string;
  name: string;
  channels: Partial<Record<AttributionChannel, Partial<AdvocateChannelStat>>>;
  lastActivityAt?: number | null;
}): Advocate {
  const channels: AdvocateChannelStat[] = ATTRIBUTION_CHANNELS.map((channel) =>
    stat({ channel, ...(input.channels[channel] ?? {}) }),
  ).filter((entry) => entry.referred > 0 || entry.advanced > 0 || entry.converted > 0);

  const sum = (pick: (entry: AdvocateChannelStat) => number): number =>
    channels.reduce((total, entry) => total + pick(entry), 0);

  const instructor = channels.find((entry) => entry.channel === "instructor_referral");
  const partner = channels.find((entry) => entry.channel === "partner_introduction");

  return {
    personId: input.personId,
    name: input.name,
    channels,
    totalReferred: sum((entry) => entry.referred),
    totalAdvanced: sum((entry) => entry.advanced),
    totalConverted: sum((entry) => entry.converted),
    activeInstructorsGenerated: instructor?.converted ?? 0,
    partnersGenerated: partner?.converted ?? 0,
    studentsReached: sum((entry) => entry.studentsReached),
    lastActivityAt: input.lastActivityAt ?? null,
  };
}

/**
 * Rank advocates by *verified downstream outcome*, never by raw lead volume.
 * A referred instructor who became active and a converted partner both compound
 * into many students, so they dominate; students reached is the honest headline;
 * unconverted referral volume is only a tie-breaker. Section 11: outcomes, not
 * vanity metrics.
 */
export function advocateScore(advocate: Advocate): number {
  return (
    advocate.studentsReached * 3 +
    advocate.activeInstructorsGenerated * 40 +
    advocate.partnersGenerated * 40 +
    advocate.totalConverted * 8 +
    advocate.totalAdvanced * 2 +
    advocate.totalReferred
  );
}

/** Deterministic sort: strongest verified growth first, newest touch breaks ties. */
export function rankAdvocates(advocates: Advocate[]): Advocate[] {
  return [...advocates].sort(
    (a, b) =>
      advocateScore(b) - advocateScore(a) ||
      b.studentsReached - a.studentsReached ||
      (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0) ||
      a.name.localeCompare(b.name),
  );
}

/** Whether a Person has generated anything worth attributing. */
export function isAdvocate(advocate: Advocate): boolean {
  return advocate.totalReferred > 0;
}

/**
 * One honest, evidence-only sentence tracing a Person's compounding impact —
 * exactly the "Instructor A → 2 became active → taught 70 students" shape,
 * assembled only from facts that are true.
 */
export function advocateHeadline(advocate: Advocate): string {
  const parts: string[] = [];
  const instructor = advocate.channels.find((entry) => entry.channel === "instructor_referral");
  const family = advocate.channels.find((entry) => entry.channel === "family_referral");
  const partner = advocate.channels.find((entry) => entry.channel === "partner_introduction");

  if (instructor) {
    const active = instructor.converted;
    const base = `referred ${instructor.referred} instructor${instructor.referred === 1 ? "" : "s"}`;
    parts.push(
      active > 0
        ? `${base} — ${active} now active${instructor.studentsReached > 0 ? `, together teaching ${instructor.studentsReached} student${instructor.studentsReached === 1 ? "" : "s"}` : ""}`
        : base,
    );
  }
  if (family) {
    const base = `referred ${family.referred} famil${family.referred === 1 ? "y" : "ies"}`;
    parts.push(family.converted > 0 ? `${base} — ${family.converted} reached verified participation` : base);
  }
  if (partner) {
    const base = `introduced ${partner.referred} organization${partner.referred === 1 ? "" : "s"}`;
    parts.push(
      partner.converted > 0
        ? `${base} — ${partner.converted} became a partner${partner.studentsReached > 0 ? `, reaching ${partner.studentsReached} student${partner.studentsReached === 1 ? "" : "s"}` : ""}`
        : base,
    );
  }
  if (parts.length === 0) return "No attributable growth yet.";
  const sentence = parts.join("; ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + ".";
}

/** The Person's dominant contribution style, for a compact role hint. */
export function advocateRoleHint(advocate: Advocate): string {
  const strongest = [...advocate.channels].sort((a, b) => b.converted - a.converted || b.referred - a.referred)[0];
  if (!strongest) return "Advocate";
  if (strongest.channel === "instructor_referral") return "Instructor recruiter";
  if (strongest.channel === "family_referral") return "Family advocate";
  return "Community connector";
}
