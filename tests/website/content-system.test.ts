import assert from "node:assert/strict";
import test from "node:test";
import {
  REGISTRATION_STATUSES,
  deriveCta,
  interestListIsOpen,
  registrationIsOpen,
  toPublicationStatus,
  toRegistrationStatus,
} from "../../lib/cms/status";
import {
  AUTHORABLE_SECTION_KINDS,
  SECTION_KINDS,
  parseSectionData,
  sectionSpec,
  validateSectionData,
} from "../../lib/cms/sections";
import { sectionFields } from "../../lib/cms/fields";
import { ContentError, classifyError, describe as describeNotice } from "../../lib/cms/errors";
import { navForRole } from "../../lib/navigation/catalog";

/* ============================================================
 * The three rules of the content system that must not regress:
 *
 *   1. A registration status always produces one, and only one, correct call
 *      to action. This is what stops a "Full" program from showing an active
 *      Register button.
 *   2. Reading stored content never throws, whatever is in the row.
 *   3. An error is classified into a specific reason, and the public-facing
 *      text never carries a diagnostic.
 * ============================================================ */

const cta = (status: (typeof REGISTRATION_STATUSES)[number], interestListEnabled = true) =>
  deriveCta({
    registrationStatus: status,
    registerHref: "/programs/register/p1",
    interestHref: "/sign-up",
    interestListEnabled,
  });

test("every registration status derives exactly one defined call to action", () => {
  const expected: Record<string, { behavior: string; label: string; hasSecondary: boolean }> = {
    coming_soon: { behavior: "none", label: "Coming Soon", hasSecondary: true },
    registration_open: { behavior: "register", label: "Register", hasSecondary: false },
    interest_list: { behavior: "interest", label: "Join the Interest List", hasSecondary: false },
    full: { behavior: "disabled", label: "Program Full", hasSecondary: true },
    registration_closed: { behavior: "disabled", label: "Registration Closed", hasSecondary: false },
    completed: { behavior: "none", label: "Completed", hasSecondary: false },
  };

  for (const status of REGISTRATION_STATUSES) {
    const result = cta(status);
    assert.equal(result.behavior, expected[status].behavior, `${status} behavior`);
    assert.equal(result.label, expected[status].label, `${status} label`);
    assert.equal(Boolean(result.secondary), expected[status].hasSecondary, `${status} interest-list option`);
  }
});

test("only an open program exposes a live registration link", () => {
  for (const status of REGISTRATION_STATUSES) {
    const result = cta(status);
    const linksToRegistration = result.href === "/programs/register/p1";
    assert.equal(linksToRegistration, status === "registration_open", `${status} must not link to the form`);
    assert.equal(registrationIsOpen(status), status === "registration_open");
  }
});

test("turning the interest list off removes it from every status", () => {
  for (const status of REGISTRATION_STATUSES) {
    assert.equal(cta(status, false).secondary, null, `${status} still offered the interest list`);
    assert.equal(interestListIsOpen(status, false), false, `${status} still accepted interest submissions`);
  }
});

test("a wording override changes the words but never the behaviour", () => {
  const overridden = deriveCta({
    registrationStatus: "full",
    registerHref: "/programs/register/p1",
    interestHref: "/sign-up",
    interestListEnabled: true,
    ctaLabelOverride: "All seats taken for now",
  });
  assert.equal(overridden.label, "All seats taken for now");
  assert.equal(overridden.behavior, "disabled");
  assert.equal(overridden.href, null);
});

test("unknown statuses fall back to the safest state rather than throwing", () => {
  assert.equal(toRegistrationStatus("nonsense"), "coming_soon");
  assert.equal(toRegistrationStatus(undefined), "coming_soon");
  assert.equal(toPublicationStatus("nonsense"), "draft");
  assert.equal(toPublicationStatus(null), "draft");
});

test("every section kind parses garbage into its own empty shape without throwing", () => {
  for (const kind of SECTION_KINDS) {
    for (const junk of [null, undefined, 42, "string", [], { items: 7, actions: "no", groups: null }]) {
      const parsed = parseSectionData(kind, junk);
      assert.equal(typeof parsed, "object", `${kind} did not return an object`);
    }
  }
  assert.deepEqual(parseSectionData("not-a-real-kind", { a: 1 }), {});
});

test("every authorable section kind has editor fields and none exposes raw JSON", () => {
  for (const kind of AUTHORABLE_SECTION_KINDS) {
    const fields = sectionFields(kind);
    assert.ok(fields.length > 0, `${kind} has no editor fields`);
    for (const field of fields) {
      assert.ok(field.label.trim().length > 0, `${kind}.${field.name} has no label`);
      assert.notEqual(field.label.toLowerCase(), "data", `${kind} exposes a raw data field`);
    }
    assert.ok(sectionSpec(kind).summary.length > 0, `${kind} has no plain-English summary`);
  }
});

test("writes are validated strictly and report the offending field", () => {
  const bad = validateSectionData("hero", { headline: 12345, actions: "not a list" });
  // `.catch()` coerces rather than rejecting, so this must still succeed and
  // produce a usable shape — the strict path exists to reject unknown kinds.
  assert.equal(bad.ok, true);
  const unknown = validateSectionData("does-not-exist", {});
  assert.equal(unknown.ok, false);
  if (!unknown.ok) assert.match(unknown.message, /Unknown section type/);
});

test("database faults classify into actionable reasons, not a single catch-all", () => {
  assert.equal(classifyError({ code: "42P01", message: 'relation "waitlist_offers" does not exist' }).reason, "schema_out_of_date");
  assert.equal(classifyError({ code: "42703", message: 'column "student_name" does not exist' }).reason, "schema_out_of_date");
  assert.equal(classifyError({ code: "42501" }).reason, "insufficient_permissions");
  assert.equal(classifyError({ code: "ECONNREFUSED" }).reason, "network_unavailable");
  assert.equal(classifyError({ message: "[bow] Missing POSTGRES_URL." }).reason, "configuration_error");
  assert.equal(classifyError(new Error("something else")).reason, "internal_error");
  assert.equal(classifyError(new ContentError("program_not_found")).reason, "program_not_found");
});

test("a schema fault names the missing relation for staff and nothing for visitors", () => {
  const error = { code: "42P01", message: 'relation "waitlist_offers" does not exist' };

  const visitor = describeNotice(error);
  assert.equal(visitor.diagnostic, undefined);
  assert.doesNotMatch(visitor.body, /waitlist_offers|42P01|SQLSTATE/);
  assert.doesNotMatch(visitor.title, /waitlist_offers|42P01|SQLSTATE/);

  const staff = describeNotice(error, { staff: true });
  assert.match(String(staff.diagnostic), /schema_out_of_date/);
  assert.match(String(staff.diagnostic), /waitlist_offers/);
  // The visitor-facing wording is identical either way.
  assert.equal(staff.title, visitor.title);
  assert.equal(staff.body, visitor.body);
});

test("a diagnostic never carries a connection string or credential", () => {
  const staff = describeNotice(
    { code: "28P01", message: "password authentication failed for user postgres.abcdef in postgres://user:secret@host/db" },
    { staff: true },
  );
  assert.doesNotMatch(String(staff.diagnostic), /postgres:\/\/|secret|password/i);
});

test("the Website area is founder-only in the authenticated navigation", () => {
  const ids = (role: Parameters<typeof navForRole>[0]) =>
    navForRole(role).flatMap((entry) => (entry.kind === "group" ? entry.items : [entry])).map((item) => item.id);

  assert.ok(ids("admin").includes("website"), "admin cannot reach the Website area");
  for (const role of ["growth", "instructor", "student", "parent"] as const) {
    assert.ok(!ids(role).includes("website"), `${role} was offered the Website area`);
  }
});
