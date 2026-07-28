import { test } from "node:test";
import assert from "node:assert/strict";
import { activeNavId, navForRole } from "../../lib/navigation/catalog";

test("staff nav resolves every surviving route to exactly one primary item", () => {
  const nav = navForRole("admin", { instructorCanDeliver: true });

  const cases: Array<[string, string]> = [
    ["/app", "staff-home"],
    ["/app/growth", "growth"],
    ["/app/inquiries", "growth"],
    ["/app/admin/inquiries", "growth"],
    ["/app/partners", "growth"],
    ["/app/partners/abc123", "growth"],
    ["/app/programs", "programs"],
    ["/app/programs/abc123", "programs"],
    ["/app/classes", "programs"],
    ["/app/classes/abc123", "programs"],
    ["/app/curriculum/abc123", "programs"],
    ["/app/regions/abc123", "programs"],
    ["/app/locations/abc123", "programs"],
    ["/app/people", "people"],
    ["/app/people/abc123", "people"],
    ["/app/instructors/abc123", "people"],
    ["/app/students/abc123", "people"],
    ["/app/hiring", "people"],
    ["/app/hiring/applications/abc123", "people"],
    ["/app/instructor-ops", "people"],
    ["/app/instructor-ops#staffing", "people"],
    ["/app/training", "people"],
    ["/app/tasks", "work"],
    ["/app/tasks/abc123", "work"],
    ["/app/admin", "admin-overview"],
    ["/app/admin/cohorts", "admin-cohorts"],
    ["/app/admin/learn", "admin-learn"],
  ];

  for (const [path, expected] of cases) {
    assert.equal(activeNavId(path, nav), expected, `expected ${path} -> ${expected}`);
  }
});

test("growth staff never see the platform-admin group", () => {
  const nav = navForRole("growth");
  assert.equal(nav.some((entry) => entry.kind === "group" && entry.id === "platform-admin"), false);
  assert.equal(activeNavId("/app/admin/cohorts", nav), null);
});

test("instructor nav resolves Home, Classes, and Playbook including nested/legacy routes", () => {
  const nav = navForRole("instructor", { instructorCanDeliver: true });

  const cases: Array<[string, string]> = [
    ["/app/teach", "instructor-home"],
    ["/app/instructor", "instructor-home"],
    ["/app/teach/proposals", "instructor-home"],
    ["/app/teach/classes", "instructor-classes"],
    ["/app/teach/classes/abc123", "instructor-classes"],
    ["/app/teach/classes/abc123/sessions/def456", "instructor-classes"],
    ["/app/instructor/session", "instructor-classes"],
    ["/app/instructor/cohort", "instructor-classes"],
    ["/app/instructor/learn", "instructor-playbook"],
    ["/app/instructor/learn/review", "instructor-playbook"],
  ];

  for (const [path, expected] of cases) {
    assert.equal(activeNavId(path, nav), expected, `expected ${path} -> ${expected}`);
  }
});

test("instructorCanDeliver=false hides Classes but keeps Home and Playbook", () => {
  const nav = navForRole("instructor", { instructorCanDeliver: false });
  assert.equal(nav.some((entry) => entry.kind === "link" && entry.id === "instructor-classes"), false);
  assert.equal(activeNavId("/app/teach", nav), "instructor-home");
  assert.equal(activeNavId("/app/instructor/learn", nav), "instructor-playbook");
});

test("student nav is always /dashboard regardless of legacy options", () => {
  const nav = navForRole("student");
  assert.equal(activeNavId("/dashboard", nav), "student-home");
  assert.equal(activeNavId("/dashboard/lesson/abc123", nav), "student-home");
});
