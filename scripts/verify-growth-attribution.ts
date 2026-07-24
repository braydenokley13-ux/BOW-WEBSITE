/* Ephemeral DB-backed verification of the real growth-attribution SQL.
 * Runs the production getGrowthAdvocates / getPersonAttribution against a
 * seeded local Postgres. Not part of CI (needs a DB); invoked manually. */
import assert from "node:assert/strict";
import { getGrowthAdvocates, getPersonAttribution } from "@/lib/growth-attribution";

async function main() {
  const { advocates, totals } = await getGrowthAdvocates(100);
  const byId = new Map(advocates.map((a) => [a.personId, a]));

  const a = byId.get("pA");
  const p = byId.get("pP");
  assert.ok(a, "Instructor A should be an advocate");
  assert.ok(p, "Parent P should be an advocate");

  // Instructor A: instructor referral (1 referred, 1 active, 3 taught) + partner
  // introduction (1 referred, 1 converted, 2 org students) = 5 reached.
  assert.equal(a!.activeInstructorsGenerated, 1, "A activated 1 instructor");
  assert.equal(a!.partnersGenerated, 1, "A opened 1 partner");
  assert.equal(a!.studentsReached, 5, "A reached 3 (taught) + 2 (org) students");
  const aInstr = a!.channels.find((c) => c.channel === "instructor_referral")!;
  assert.equal(aInstr.referred, 1);
  assert.equal(aInstr.converted, 1);
  assert.equal(aInstr.studentsReached, 3);
  const aPartner = a!.channels.find((c) => c.channel === "partner_introduction")!;
  assert.equal(aPartner.converted, 1);
  assert.equal(aPartner.studentsReached, 2);

  // Parent P: 1 non-voided family referral, referred student verified (present).
  const pFam = p!.channels.find((c) => c.channel === "family_referral")!;
  assert.equal(pFam.referred, 1, "voided referral r2 is excluded");
  assert.equal(pFam.converted, 1, "referred student attended → verified");
  assert.equal(p!.studentsReached, 1);

  // Ranking: A's compounding outcome outranks P.
  assert.equal(advocates[0].personId, "pA", "A ranks first by verified outcome");

  // Totals reflect the full set.
  assert.equal(totals.activeInstructorsGenerated, 1);
  assert.equal(totals.partnersGenerated, 1);
  assert.equal(totals.verifiedFamilies, 1);
  assert.equal(totals.studentsReached, 6, "5 (A) + 1 (P)");

  // Instructor B made one still-suggested community introduction: correctly an
  // advocate with an in-flight (unconverted) referral, ranked below A and P.
  const b = byId.get("pB");
  assert.ok(b, "B is an advocate via a pending introduction");
  const bIntro = b!.channels.find((c) => c.channel === "partner_introduction")!;
  assert.equal(bIntro.referred, 1);
  assert.equal(bIntro.converted, 0, "suggested intro has not converted");
  assert.equal(b!.studentsReached, 0, "no downstream students from a pending intro");
  assert.equal(advocates[advocates.length - 1].personId, "pB", "B ranks last");
  assert.equal(totals.pendingReferrals, 1, "exactly one referral in flight (B's intro)");

  // Single-person path returns the same rollup as the board.
  const solo = await getPersonAttribution("pA");
  assert.ok(solo, "getPersonAttribution finds A");
  assert.equal(solo!.studentsReached, 5);
  assert.equal(solo!.activeInstructorsGenerated, 1);
  assert.equal(solo!.partnersGenerated, 1);
  const none = await getPersonAttribution("pS1");
  assert.equal(none, null, "a taught student who referred no one is not an advocate");

  console.log("DB-backed growth-attribution verification PASSED");
  console.log(`  A: ${a!.studentsReached} reached · ${a!.activeInstructorsGenerated} instr · ${a!.partnersGenerated} partner`);
  console.log(`  P: ${p!.studentsReached} reached (family)`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("VERIFICATION FAILED:", error);
    process.exit(1);
  });
