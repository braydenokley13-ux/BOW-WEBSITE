import { test } from "node:test";
import assert from "node:assert/strict";
import { activeNavId, navForRole } from "../../lib/navigation/catalog";

test("staff nav resolves every surviving route to exactly one primary item", () => {
  const nav = navForRole("admin", { instructorCanDeliver: true });

  const cases: Array<[string, string]> = [
    ["/app", "staff-home"],
    ["/app/programs", "programs"],
    ["/app/programs/abc123", "programs"],
    ["/app/classes", "programs"],
    ["/app/classes/abc123", "programs"],
    // Post a Class and the session sheet are contextual surfaces that belong
    // to Programs; neither is its own destination.
    ["/app/post-class", "programs"],
    ["/app/post-class/published/abc123", "programs"],
    ["/app/session/abc123", "programs"],
    ["/app/regions/abc123", "programs"],
    ["/app/locations/abc123", "programs"],
    // Partners owns the school-inquiry inbox.
    ["/app/partners", "partners"],
    ["/app/partners/abc123", "partners"],
    ["/app/inquiries", "partners"],
    ["/app/admin/inquiries", "partners"],
    ["/app/people", "people"],
    ["/app/people/abc123", "people"],
    ["/app/instructors/abc123", "people"],
    ["/app/students/abc123", "people"],
    // Instructor applications live in People, not in the Partners inbox.
    ["/app/hiring", "people"],
    ["/app/hiring/applications/abc123", "people"],
    ["/app/instructor-ops", "people"],
    ["/app/instructor-ops#staffing", "people"],
    ["/app/training", "people"],
    // Curriculum is its own destination, and Playbook Studio is where a
    // course is authored — so Studio resolves to Curriculum, not to Admin.
    ["/app/curriculum", "curriculum"],
    ["/app/curriculum/abc123", "curriculum"],
    ["/app/admin/learn", "curriculum"],
    ["/app/admin/learn/lesson/abc123", "curriculum"],
    // Secondary group: still routable, just no longer a daily destination.
    ["/app/tasks", "work"],
    ["/app/tasks/abc123", "work"],
    ["/app/growth", "growth"],
    ["/app/admin", "admin-overview"],
    ["/app/admin/cohorts", "admin-cohorts"],
  ];

  for (const [path, expected] of cases) {
    assert.equal(activeNavId(path, nav), expected, `expected ${path} -> ${expected}`);
  }
});

test("the five primary staff destinations are the only non-secondary entries", () => {
  const nav = navForRole("admin");
  const primary = nav.filter((entry) => entry.kind === "link" || !entry.secondary).map((entry) => entry.id);
  assert.deepEqual(primary, ["staff-home", "programs", "partners", "people", "curriculum"]);
});

test("growth staff never see platform administration", () => {
  const nav = navForRole("growth");
  const adminOnly = ["admin-overview", "admin-invitations", "admin-organizations", "admin-accounts", "admin-cohorts", "website"];
  const visible = new Set(
    nav.flatMap((entry) => (entry.kind === "group" ? entry.items.map((item) => item.id) : [entry.id])),
  );
  for (const id of adminOnly) {
    assert.equal(visible.has(id), false, `growth must not see ${id}`);
  }
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
