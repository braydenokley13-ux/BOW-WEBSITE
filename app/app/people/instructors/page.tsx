import Link from "next/link";
import { Badge, DataStrip, PageHeader, PageSection } from "@/components/ds";
import type { DataItem } from "@/components/ds";
import { requireStaff } from "@/lib/dal";
import { getDb } from "@/lib/db";
import { getInstructorCommandCenter } from "@/lib/instructor-missions";
import { missionAreaMeta, type ActivationException, type ActivationSeverity } from "@/lib/instructor-missions-shared";

export const metadata = { title: "Instructor command center" };

const SEVERITY_LABEL: Record<ActivationSeverity, string> = {
  critical: "Act now",
  high: "Next up",
  watch: "Watch",
};

const KIND_LABEL: Record<string, string> = {
  accepted_not_activated: "Accepted, not activated",
  onboarding_stalled: "Onboarding stalled",
  ready_without_assignment: "Ready but unused",
  active_without_mission: "No current mission",
  dormant: "Going dormant",
};

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * The Founder Instructor Command Center — not a KPI wall but a set of
 * actionable queues that answer: who is accepted but not activated, ready but
 * unused, without a Current Mission, or going dormant; which recruiting
 * sources actually create active instructors; and how the base's missions are
 * distributed across the growth loops.
 */
export default async function InstructorCommandCenterPage() {
  await requireStaff();

  let center: Awaited<ReturnType<typeof getInstructorCommandCenter>> | null = null;
  let setupError = false;
  try {
    const now = Number(((await getDb().prepare("SELECT unixepoch('now') * 1000 AS now").get()) as { now: number }).now);
    center = await getInstructorCommandCenter(now);
  } catch {
    setupError = true;
  }

  if (!center) {
    return (
      <main className="ops-page">
        <PageHeader eyebrow="BOW OS · Instructors" title="Instructor command center" context="Recruit, activate, deploy, and retain the instructor base." />
        <PageSection title="Setup required" noRule>
          <div className="ops-alert" data-tone="warning">
            <p className="ops-body" style={{ margin: 0 }}>
              {setupError
                ? "The instructor mission tables are not available yet. Apply scripts/migrations/013_instructor_missions.sql (npm run migrate), then reload."
                : "No data yet."}
            </p>
          </div>
        </PageSection>
      </main>
    );
  }

  const byKind = new Map<string, number>();
  for (const exception of center.exceptions) byKind.set(exception.kind, (byKind.get(exception.kind) ?? 0) + 1);

  const strip: DataItem[] = [
    { label: "Active instructors", value: String(center.activeInstructors), tone: "info" },
    { label: "Ready to teach", value: String(center.readyInstructors), tone: center.readyInstructors > 0 ? "positive" : "warning" },
    { label: "Current missions", value: String(center.activeMissions), tone: "info" },
    { label: "Need attention", value: String(center.exceptions.length), tone: center.exceptions.length > 0 ? "warning" : "positive" },
  ];

  const tiers: ActivationSeverity[] = ["critical", "high", "watch"];

  return (
    <main className="ops-page" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <PageHeader
        eyebrow="BOW OS · Instructors"
        title="Instructor command center"
        context="Recruit, activate, deploy, and retain the instructor base — the queues that keep every instructor moving forward."
        action={
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <Link href="/app/hiring" className="ops-inline-link">Hiring pipeline →</Link>
            <Link href="/app/people?type=instructor" className="ops-inline-link">Instructor base →</Link>
          </div>
        }
      />

      <DataStrip items={strip} dense />

      <PageSection title="Activation queue" noRule>
        {center.exceptions.length === 0 ? (
          <div className="ops-empty">
            <Badge status="positive">Base is moving</Badge>
            <h3 className="ops-empty__title" style={{ marginTop: 10 }}>No instructor is stalled, unused, or going dormant.</h3>
            <p className="ops-empty__body">Everyone accepted is activating, and every active instructor has a mission or an assignment.</p>
          </div>
        ) : (
          tiers.map((tier) => {
            const rows = center!.exceptions.filter((exception) => exception.severity === tier);
            if (rows.length === 0) return null;
            return (
              <div key={tier} style={{ marginBottom: 18 }}>
                <span className="ops-label" style={{ display: "block", padding: "6px 0", borderBottom: "1px solid var(--border-rule)" }}>{SEVERITY_LABEL[tier]}</span>
                <div>
                  {rows.map((exception: ActivationException) => (
                    <article key={exception.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, padding: "13px 0", borderBottom: "1px solid var(--border-rule)", flexWrap: "wrap" }}>
                      <div style={{ flex: "1 1 380px", minWidth: 0 }}>
                        <div style={{ marginBottom: 4 }}><Badge status={tier === "critical" ? "negative" : tier === "high" ? "warning" : "neutral"}>{KIND_LABEL[exception.kind] ?? exception.kind}</Badge></div>
                        <h3 style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 15 }}>{exception.name}</h3>
                        <p className="ops-body" style={{ margin: "4px 0 0" }}>{exception.detail}</p>
                      </div>
                      <Link href={`/app/people/${exception.personId}?tab=instructor`} className="ops-inline-link" style={{ alignSelf: "center", whiteSpace: "nowrap", textDecoration: "none" }}>
                        Open instructor →
                      </Link>
                    </article>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </PageSection>

      <PageSection title="Recruiting sources — do they create active instructors?">
        {center.sourceFunnel.length === 0 ? (
          <p className="ops-body">No instructor records yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-interface)", fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border-rule)" }}>
                  <th style={{ padding: "8px 12px 8px 0", fontWeight: 600 }}>Source</th>
                  <th style={{ padding: "8px 12px", fontWeight: 600 }}>Applicants</th>
                  <th style={{ padding: "8px 12px", fontWeight: 600 }}>Accepted</th>
                  <th style={{ padding: "8px 12px", fontWeight: 600 }}>Ready</th>
                  <th style={{ padding: "8px 12px", fontWeight: 600 }}>Active</th>
                  <th style={{ padding: "8px 0 8px 12px", fontWeight: 600 }}>Activation</th>
                </tr>
              </thead>
              <tbody>
                {center.sourceFunnel.map((row) => (
                  <tr key={row.source} style={{ borderBottom: "1px solid var(--border-rule)" }}>
                    <td style={{ padding: "8px 12px 8px 0" }}>{row.label}</td>
                    <td style={{ padding: "8px 12px", fontFamily: "var(--font-data)" }}>{row.applicants}</td>
                    <td style={{ padding: "8px 12px", fontFamily: "var(--font-data)" }}>{row.accepted}</td>
                    <td style={{ padding: "8px 12px", fontFamily: "var(--font-data)" }}>{row.ready}</td>
                    <td style={{ padding: "8px 12px", fontFamily: "var(--font-data)" }}>{row.active}</td>
                    <td style={{ padding: "8px 0 8px 12px", fontFamily: "var(--font-data)" }}>{pct(row.activationRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageSection>

      <PageSection title="Current mission mix">
        {center.missionMix.length === 0 ? (
          <p className="ops-body">No Current Missions have been assigned yet. Assign missions from any instructor&rsquo;s dossier to start deploying the base beyond teaching.</p>
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {center.missionMix.map((entry) => (
              <span key={entry.area} className="ops-chip" data-tone="info">
                {missionAreaMeta(entry.area).label} · {entry.count}
              </span>
            ))}
          </div>
        )}
      </PageSection>
    </main>
  );
}
