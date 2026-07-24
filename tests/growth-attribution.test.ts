import assert from "node:assert/strict";
import test from "node:test";
import {
  advocateHeadline,
  advocateRoleHint,
  advocateScore,
  buildAdvocate,
  isAdvocate,
  rankAdvocates,
  type Advocate,
} from "@/lib/growth-attribution-shared";

function advocate(overrides: Parameters<typeof buildAdvocate>[0]): Advocate {
  return buildAdvocate(overrides);
}

test("buildAdvocate rolls up cross-channel totals and drops unused channels", () => {
  const a = advocate({
    personId: "p1",
    name: "Instructor A",
    channels: {
      instructor_referral: { referred: 4, advanced: 3, converted: 2, studentsReached: 70 },
      family_referral: { referred: 0, advanced: 0, converted: 0, studentsReached: 0 },
    },
  });
  assert.equal(a.channels.length, 1, "empty channels are pruned");
  assert.equal(a.totalReferred, 4);
  assert.equal(a.totalConverted, 2);
  assert.equal(a.activeInstructorsGenerated, 2);
  assert.equal(a.studentsReached, 70);
  assert.equal(a.partnersGenerated, 0);
});

test("studentsReached sums across every channel used", () => {
  const a = advocate({
    personId: "p2",
    name: "Connector",
    channels: {
      instructor_referral: { referred: 1, converted: 1, studentsReached: 30 },
      partner_introduction: { referred: 1, converted: 1, studentsReached: 24 },
      family_referral: { referred: 2, converted: 2, studentsReached: 2 },
    },
  });
  assert.equal(a.studentsReached, 56);
  assert.equal(a.partnersGenerated, 1);
});

test("ranking rewards verified downstream outcomes over raw referral volume", () => {
  const volume = advocate({
    personId: "volume",
    name: "Lots of leads",
    channels: { family_referral: { referred: 20, advanced: 0, converted: 0, studentsReached: 0 } },
  });
  const outcome = advocate({
    personId: "outcome",
    name: "Real growth",
    channels: { instructor_referral: { referred: 2, advanced: 2, converted: 2, studentsReached: 60 } },
  });
  const ranked = rankAdvocates([volume, outcome]);
  assert.equal(ranked[0].personId, "outcome", "converted growth outranks unconverted volume");
  assert.ok(advocateScore(outcome) > advocateScore(volume));
});

test("a converted partner and an active instructor both compound above pure counts", () => {
  const partner = advocate({
    personId: "partner",
    name: "School opener",
    channels: { partner_introduction: { referred: 1, advanced: 1, converted: 1, studentsReached: 24 } },
  });
  const nothing = advocate({
    personId: "nothing",
    name: "Suggested only",
    channels: { partner_introduction: { referred: 3, advanced: 0, converted: 0, studentsReached: 0 } },
  });
  assert.ok(advocateScore(partner) > advocateScore(nothing));
});

test("headline traces the full compounding loop from facts only", () => {
  const a = advocate({
    personId: "p1",
    name: "Instructor A",
    channels: { instructor_referral: { referred: 4, advanced: 3, converted: 2, studentsReached: 70 } },
  });
  const line = advocateHeadline(a);
  assert.match(line, /referred 4 instructors/i);
  assert.match(line, /2 now active/i);
  assert.match(line, /70 students/i);
});

test("headline never invents an outcome that did not happen", () => {
  const a = advocate({
    personId: "p3",
    name: "Parent B",
    channels: { family_referral: { referred: 3, advanced: 1, converted: 0, studentsReached: 0 } },
  });
  const line = advocateHeadline(a);
  assert.match(line, /referred 3 families/i);
  assert.doesNotMatch(line, /verified participation/i, "no conversion claimed when none occurred");
});

test("singular/plural render correctly", () => {
  const a = advocate({
    personId: "p4",
    name: "Parent C",
    channels: { family_referral: { referred: 1, advanced: 1, converted: 1, studentsReached: 1 } },
  });
  const line = advocateHeadline(a);
  assert.match(line, /referred 1 family/i);
  assert.match(line, /1 reached verified participation/i);
});

test("role hint reflects the dominant converting channel", () => {
  const recruiter = advocate({
    personId: "r",
    name: "R",
    channels: {
      instructor_referral: { referred: 2, converted: 2, studentsReached: 40 },
      family_referral: { referred: 1, converted: 0, studentsReached: 0 },
    },
  });
  assert.equal(advocateRoleHint(recruiter), "Instructor recruiter");

  const connector = advocate({
    personId: "c",
    name: "C",
    channels: { partner_introduction: { referred: 1, converted: 1, studentsReached: 24 } },
  });
  assert.equal(advocateRoleHint(connector), "Community connector");
});

test("isAdvocate requires at least one real referral", () => {
  const empty = advocate({ personId: "e", name: "E", channels: {} });
  assert.equal(isAdvocate(empty), false);
  const real = advocate({ personId: "x", name: "X", channels: { family_referral: { referred: 1 } } });
  assert.equal(isAdvocate(real), true);
});
