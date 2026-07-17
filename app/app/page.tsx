import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { roleHomePath } from "@/lib/account";
import { Badge, SectionHeader } from "@/components/ds";
import { getLeadershipHomeData } from "@/lib/hiring";
import { getDb, rowToPerson } from "@/lib/db";
import { entityHref, sessionHref } from "@/lib/routes";

const cardStyle = { background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 20 } as const;
const labelStyle = { fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "var(--bow-slate)" };
const valueStyle = { fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-ink)" };

interface Bucket {
  key: string;
  title: string;
  items: { id: string; label: string; href: string }[];
}

/**
 * The app entry point. Admin and growth both land on the leadership
 * Home here (decision-oriented buckets from getLeadershipHomeData).
 * Everyone else is routed to their role home.
 */
export default async function AppHome() {
  const me = await requireUser();
  if (me.role !== "admin" && me.role !== "growth") {
    redirect(roleHomePath(me.role));
  }

  const db = getDb();
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const personName = (personId: string): string => {
    const row = db.prepare("SELECT * FROM people WHERE id = ?").get(personId) as any;
    return row ? rowToPerson(row).name : personId;
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const data = getLeadershipHomeData();

  const buckets: Bucket[] = [
    {
      key: "newApplications",
      title: "New applications",
      items: data.newApplications.map((i) => ({ id: i.id, label: personName(i.personId), href: entityHref("instructor", i.id)! })),
    },
    {
      key: "interviewsToSchedule",
      title: "Interviews to schedule",
      items: data.interviewsToSchedule.map((i) => ({ id: i.id, label: personName(i.personId), href: entityHref("instructor", i.id)! })),
    },
    {
      key: "awaitingFounderReview",
      title: "Awaiting founder review",
      items: data.awaitingFounderReview.map((i) => ({ id: i.id, label: personName(i.personId), href: entityHref("instructor", i.id)! })),
    },
    {
      key: "behindOnOnboardingOrTraining",
      title: "Behind on onboarding/training",
      items: data.behindOnOnboardingOrTraining.map((i) => ({ id: i.id, label: personName(i.personId), href: entityHref("instructor", i.id)! })),
    },
    {
      key: "practiceEvalsNeeded",
      title: "Practice evals needed",
      items: data.practiceEvalsNeeded.map((i) => ({ id: i.id, label: personName(i.personId), href: entityHref("instructor", i.id)! })),
    },
    {
      key: "classesWithoutEligibleInstructor",
      title: "Classes without an eligible instructor",
      items: data.classesWithoutEligibleInstructor.map((c) => ({ id: c.id, label: c.title, href: entityHref("class", c.id)! })),
    },
    {
      key: "classesLaunchingSoonIncomplete",
      title: "Launching soon, setup incomplete",
      items: data.classesLaunchingSoonIncomplete.map((c) => ({ id: c.id, label: c.title, href: entityHref("class", c.id)! })),
    },
    {
      key: "missingStudentForms",
      title: "Missing student forms",
      items: data.missingStudentForms.map((s) => ({ id: s.id, label: s.name, href: entityHref("student", s.id)! })),
    },
    {
      key: "flaggedSessionReports",
      title: "Flagged session reports (14d)",
      items: data.flaggedSessionReports.map((r) => ({
        id: r.id,
        label: r.flag_reason || "Flagged session",
        href: sessionHref(r.class_id, r.session_id),
      })),
    },
    {
      key: "openFounderHandoffTasks",
      title: "Open founder handoffs",
      items: data.openFounderHandoffTasks.map((t) => ({ id: t.id, label: t.title, href: entityHref("task", t.id) ?? "/app/tasks" })),
    },
  ];

  const totalOpen = buckets.reduce((sum, b) => sum + b.items.length, 0);

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px clamp(16px,4vw,32px) 96px", display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionHeader kicker="BOW HQ" title="Home" />
      <p style={{ fontFamily: "var(--font-interface)", fontSize: 15, color: "var(--bow-slate)", maxWidth: 640 }}>
        Execution state and blockers across the pipeline. {totalOpen} item(s) need attention.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px,1fr))", gap: 16 }}>
        {buckets.map((b) => (
          <div key={b.key} style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={labelStyle}>{b.title}</span>
              <Badge status={b.items.length > 0 ? "warning" : "neutral"}>{b.items.length}</Badge>
            </div>
            {b.items.length === 0 ? (
              <p style={{ ...valueStyle, color: "var(--bow-slate)" }}>Nothing here.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {b.items.slice(0, 6).map((item) => (
                  <Link key={item.id} href={item.href} style={{ ...valueStyle, color: "var(--bow-blue)" }}>
                    {item.label}
                  </Link>
                ))}
                {b.items.length > 6 && <span style={{ ...labelStyle }}>+{b.items.length - 6} more</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
