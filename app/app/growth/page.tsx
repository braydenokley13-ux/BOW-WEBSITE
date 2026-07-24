import Link from "next/link";
import CampaignStateActions from "@/components/app/growth/CampaignStateActions";
import ContributorStateActions from "@/components/app/growth/ContributorStateActions";
import GrowthCommandActions from "@/components/app/growth/GrowthCommandActions";
import GoalStateActions from "@/components/app/growth/GoalStateActions";
import { Badge, DataStrip } from "@/components/ds";
import { requireStaff } from "@/lib/dal";
import { getDb } from "@/lib/db";
import { getGrowthCommandCenter, type CampaignMetric } from "@/lib/growth";
import { getFlywheelSnapshot, getWeeklyOperatingSummary } from "@/lib/flywheel";
import { listStaffUsers } from "@/lib/hiring";
import FlywheelPanel from "@/components/app/growth/FlywheelPanel";
import ManagementBriefing from "@/components/app/growth/ManagementBriefing";
import { getManagementBriefing } from "@/lib/management";
import { getGrowthAdvocates } from "@/lib/growth-attribution";
import { advocateHeadline, advocateRoleHint } from "@/lib/growth-attribution-shared";
import { addCanonicalDays, canonicalDateInZone } from "@/lib/timezone";

function label(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function statusTone(status: string): "positive" | "warning" | "negative" | "info" | "neutral" | "locked" {
  if (["active", "achieved", "on_track", "balanced"].includes(status)) return "positive";
  if (["paused", "behind", "capacity", "demand"].includes(status)) return "warning";
  if (["cancelled", "missed", "urgent"].includes(status)) return "negative";
  if (["draft", "not_started", "leadership"].includes(status)) return "info";
  if (["completed", "retired"].includes(status)) return "locked";
  return "neutral";
}

function ratio(numerator: number, denominator: number): string {
  if (denominator <= 0) return "—";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function metricValue(campaign: { status: string; resultValue: number | null; targetMetric: CampaignMetric; leads: number; registrations: number; confirmations: number; verifiedParticipants: number; repeatParticipants: number; successfulReferrals: number }): number | null {
  if (["completed", "cancelled"].includes(campaign.status) && campaign.resultValue != null) {
    return campaign.resultValue;
  }
  if (campaign.targetMetric === "leads") return campaign.leads;
  if (campaign.targetMetric === "registrations") return campaign.registrations;
  if (campaign.targetMetric === "confirmations") return campaign.confirmations;
  if (campaign.targetMetric === "verified_participants") return campaign.verifiedParticipants;
  if (campaign.targetMetric === "repeat_participants") return campaign.repeatParticipants;
  if (campaign.targetMetric === "successful_referrals") return campaign.successfulReferrals;
  return null;
}

function money(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

export default async function GrowthCommandCenterPage() {
  const me = await requireStaff();
  const isLeadership = me.role === "admin";
  const now = Number(((await getDb().prepare("SELECT unixepoch('now') * 1000 AS now").get()) as { now: number }).now);
  const today = canonicalDateInZone(now);
  const quarterEnd = addCanonicalDays(today, 90);
  const center = (await getGrowthCommandCenter(now));
  const flywheel = (await getFlywheelSnapshot(now));
  const weekly = (await getWeeklyOperatingSummary(now));
  // Cross-system attribution: who actually brings instructors, families, and
  // partners into BOW. Degrades to empty if a referral spine is missing.
  const advocacy = await getGrowthAdvocates(5).catch(() => ({
    advocates: [] as Awaited<ReturnType<typeof getGrowthAdvocates>>["advocates"],
    totals: { advocates: 0, activeInstructorsGenerated: 0, partnersGenerated: 0, verifiedFamilies: 0, studentsReached: 0, pendingReferrals: 0 },
  }));
  const staffUsers = (await listStaffUsers()).map((user) => ({ id: user.id, name: user.name }));
  const briefing = isLeadership ? (await getManagementBriefing(now)) : null;
  const { funnel } = center;
  const activeGoals = center.goals.filter((goal) => goal.status === "active");
  const closedGoals = center.goals.filter((goal) => goal.status !== "active");
  const funnelSteps = [
    { label: "Attributed leads", value: funnel.leads, rate: `${funnel.startsOn} → ${funnel.endsOn}` },
    { label: "Registrations", value: funnel.registrations, rate: ratio(funnel.registrations, funnel.leads) },
    { label: "Confirmations", value: funnel.confirmations, rate: ratio(funnel.confirmations, funnel.registrations) },
    { label: "Verified participation", value: funnel.verifiedParticipants, rate: ratio(funnel.verifiedParticipants, funnel.confirmations) },
    { label: "Repeat participation", value: funnel.repeatParticipants, rate: ratio(funnel.repeatParticipants, funnel.verifiedParticipants) },
    { label: "Successful referrals", value: funnel.successfulReferrals, rate: "verified only" },
    { label: "Explicit completions", value: funnel.completions, rate: "recorded outcome" },
  ];

  return (
    <main className="ops-page" data-accent="blue">
      <header className="ops-hero">
        <div className="ops-hero__copy">
          <span className="ops-eyebrow">Growth · Evidence to Expansion</span>
          <h1 className="ops-title">Turn community trust into verified, repeatable participation.</h1>
          <p className="ops-summary">
            Run channels, campaigns, contributors, goals, referrals, and market capacity from one evidence chain. Registrations show intent; finalized attendance proves service; explicit outcomes prove completion.
          </p>
        </div>
        <GrowthCommandActions options={center.options} today={today} quarterEnd={quarterEnd} />
      </header>

      {briefing && <ManagementBriefing issues={briefing.issues} staffUsers={staffUsers} />}

      <FlywheelPanel snapshot={flywheel} staffUsers={staffUsers} />

      {briefing && (
        <section className="ops-panel ops-panel--flat ops-anchor" aria-labelledby="team-heading">
          <div className="ops-section-head">
            <div>
              <span className="ops-label">Team · last 30 days</span>
              <h2 className="ops-section-title" id="team-heading">Who is producing, who needs help</h2>
            </div>
            <span className="ops-section-note">
              Activity and downstream impact side by side — completions are motion; progressions and conversions are growth.
            </span>
          </div>
          <div className="ops-list">
            {briefing.contributors.map((person) => (
              <article className="ops-list-row" key={person.userId}>
                <div>
                  <span className="ops-record-name">{person.name}</span>
                  <span className="ops-record-meta">{person.role === "admin" ? "Founder" : "Growth"} · {person.open} open · {person.dueThisWeek} due this week{person.stale > 0 ? ` · ${person.stale} stale` : ""}</span>
                </div>
                <Badge status={person.capacity === "overloaded" ? "negative" : person.capacity === "available" ? "positive" : "neutral"}>
                  {person.capacity}
                </Badge>
                <p className="ops-body" style={{ margin: 0 }}>
                  {person.completed30} done · {person.progressions30} progressed · {person.conversions30} converted
                  {person.introsConverted30 > 0 ? ` · ${person.introsConverted30} intro${person.introsConverted30 === 1 ? "" : "s"} → partner` : ""}
                  {person.noResponse30 >= 3 ? ` · ${person.noResponse30} no-response` : ""}
                </p>
                <span className="ops-record-meta" style={{ textAlign: "right" }}>
                  {person.overdue > 0 ? `${person.overdue} overdue` : "on track"}
                  {person.onTimeRate != null ? ` · ${person.onTimeRate}% on time` : ""}
                </span>
              </article>
            ))}
          </div>
        </section>
      )}

      {briefing && (briefing.channels.length > 0 || briefing.unattributedStudents90 > 0) && (
        <section className="ops-panel ops-panel--flat ops-anchor" aria-labelledby="channels-heading">
          <div className="ops-section-head">
            <div>
              <span className="ops-label">Channels · trailing 90 days</span>
              <h2 className="ops-section-title" id="channels-heading">Where growth actually comes from</h2>
            </div>
            <span className="ops-section-note">Leads in → registrations → verified participation. Only attributed records are counted.</span>
          </div>
          <div className="ops-meta-grid">
            {briefing.channels.map((channel) => (
              <div className="ops-meta" key={channel.channelId}>
                <span className="ops-label">{channel.name}</span>
                <span className="ops-value">
                  {channel.leads90} lead{channel.leads90 === 1 ? "" : "s"} → {channel.registrations90} registered
                  {channel.conversionPct != null ? ` (${channel.conversionPct}%)` : ""} → {channel.verified90} verified
                  {channel.medianDaysToRegistration != null ? ` · ~${channel.medianDaysToRegistration}d to register` : ""}
                </span>
              </div>
            ))}
            {briefing.unattributedStudents90 > 0 && (
              <div className="ops-meta">
                <span className="ops-label">Unattributed</span>
                <span className="ops-value">
                  {briefing.unattributedStudents90} student{briefing.unattributedStudents90 === 1 ? "" : "s"} joined in 90 days with no recorded source — capture sources at registration or this view understates every channel.
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="ops-panel ops-panel--flat ops-anchor" aria-labelledby="weekly-heading">
        <div className="ops-section-head">
          <div>
            <span className="ops-label">{weekly.windowLabel}</span>
            <h2 className="ops-section-title" id="weekly-heading">What happened this week</h2>
          </div>
          <span className="ops-section-note">Created → executed → leaking. Every number opens the underlying records.</span>
        </div>
        <div className="ops-meta-grid">
          <div className="ops-meta">
            <span className="ops-label">Growth created</span>
            <span className="ops-value">
              <Link className="ops-inline-link" href="/app/students">{weekly.created.newStudents} new student{weekly.created.newStudents === 1 ? "" : "s"}</Link>
              {" · "}{weekly.created.referrals} referral{weekly.created.referrals === 1 ? "" : "s"}
              {" · "}{weekly.created.introductionsMade} introduction{weekly.created.introductionsMade === 1 ? "" : "s"} ({weekly.created.introductionsConverted} converted)
            </span>
          </div>
          <div className="ops-meta">
            <span className="ops-label">Pipeline created</span>
            <span className="ops-value">
              <Link className="ops-inline-link" href="/app/programs">{weekly.created.repeatPrograms} repeat program{weekly.created.repeatPrograms === 1 ? "" : "s"}</Link>
              {" · "}{weekly.created.demoRequests} demo request{weekly.created.demoRequests === 1 ? "" : "s"}
            </span>
          </div>
          <div className="ops-meta">
            <span className="ops-label">Execution</span>
            <span className="ops-value">
              <Link className="ops-inline-link" href="/app/tasks">{weekly.execution.completed} completed</Link>
              {" · "}{weekly.execution.overdue} overdue · {weekly.execution.unowned} unowned · {weekly.execution.dueNextWeek} due next week
            </span>
          </div>
          <div className="ops-meta">
            <span className="ops-label">Outcomes recorded</span>
            <span className="ops-value">
              {weekly.execution.outcomes.length === 0
                ? "None yet — record outcomes on Work items so the system can advance loops."
                : weekly.execution.outcomes.map((entry) => `${label(entry.outcome)} ×${entry.count}`).join(" · ")}
            </span>
          </div>
        </div>
      </section>

      <section className="ops-panel ops-panel--flat ops-anchor" id="advocates" aria-labelledby="advocates-heading">
        <div className="ops-section-head">
          <div>
            <span className="ops-label">People, not just channels</span>
            <h2 className="ops-section-title" id="advocates-heading">Who generates our growth</h2>
          </div>
          <Link className="ops-inline-link" href="/app/growth/advocates">All advocates →</Link>
        </div>
        {advocacy.advocates.length === 0 ? (
          <p className="ops-body">
            No attributable referral or introduction has produced a verified outcome yet. When an instructor refers an instructor, a family refers a family, or someone opens a school, the person and the downstream result appear here.
          </p>
        ) : (
          <>
            <div className="ops-list">
              {advocacy.advocates.map((advocate) => (
                <article className="ops-list-row" key={advocate.personId} style={{ alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <Link className="ops-record-name" href={`/app/people/${advocate.personId}`}>{advocate.name}</Link>
                    <span className="ops-record-meta">{advocateRoleHint(advocate)}</span>
                    <p className="ops-body" style={{ margin: "4px 0 0" }}>{advocateHeadline(advocate)}</p>
                  </div>
                  <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <span className="ops-value">{advocate.studentsReached}</span>
                    <span className="ops-record-meta">student{advocate.studentsReached === 1 ? "" : "s"} reached</span>
                  </div>
                </article>
              ))}
            </div>
            <p className="ops-record-meta" style={{ marginTop: 10 }}>
              {advocacy.totals.advocates} advocate{advocacy.totals.advocates === 1 ? "" : "s"} · {advocacy.totals.activeInstructorsGenerated} instructor{advocacy.totals.activeInstructorsGenerated === 1 ? "" : "s"} activated · {advocacy.totals.partnersGenerated} partner{advocacy.totals.partnersGenerated === 1 ? "" : "s"} opened · {advocacy.totals.studentsReached} students reached through referred growth.
            </p>
          </>
        )}
      </section>

      <DataStrip
        dense
        items={[
          { label: "90-day leads", value: funnel.leads.toLocaleString(), tone: "info" },
          { label: "Registrations", value: funnel.registrations.toLocaleString() },
          { label: "Confirmed", value: funnel.confirmations.toLocaleString() },
          { label: "Verified students", value: funnel.verifiedParticipants.toLocaleString(), tone: "positive" },
          { label: "Repeat students", value: funnel.repeatParticipants.toLocaleString(), tone: funnel.repeatParticipants > 0 ? "positive" : undefined },
          { label: "Open exceptions", value: center.exceptions.length.toLocaleString(), tone: center.exceptions.some((item) => item.severity === "urgent") ? "negative" : center.exceptions.length ? "warning" : "positive" },
        ]}
      />

      <section className="ops-proof-note" aria-label="Metric integrity rule">
        <strong>Evidence rule:</strong> referral success and acquisition cost use verified first participation—not clicks, submissions, or unconfirmed registration. Every denominator and date window stays visible.
      </section>

      <div className="ops-grid">
        <section className="ops-panel ops-panel--signal" aria-labelledby="growth-exceptions-title">
          <div className="ops-section-head">
            <div><span className="ops-label">Management by exception</span><h2 id="growth-exceptions-title" className="ops-section-title">Decisions that need attention</h2></div>
            <Badge status={center.exceptions.length ? "warning" : "positive"}>{center.exceptions.length}</Badge>
          </div>
          {center.exceptions.length === 0 ? (
            <div className="ops-alert" data-tone="positive"><span className="ops-alert__title">No growth exception needs escalation</span><p className="ops-body">Healthy routine work remains with its owner instead of crowding the founder cockpit.</p></div>
          ) : (
            <div className="ops-stack" style={{ gap: 10 }}>
              {center.exceptions.slice(0, 10).map((exception) => (
                <Link key={exception.id} href={exception.href} className="ops-alert" data-tone={exception.severity === "urgent" ? undefined : exception.severity}>
                  <span className="ops-alert__title">{exception.title}</span>
                  <p className="ops-body" style={{ marginTop: 4 }}>{exception.detail}</p>
                </Link>
              ))}
            </div>
          )}
        </section>

        <aside id="goals" className="ops-panel ops-anchor" aria-labelledby="growth-goals-title">
          <div className="ops-section-head"><div><span className="ops-label">Owned outcomes</span><h2 id="growth-goals-title" className="ops-section-title">Goal pace</h2></div></div>
          {activeGoals.length === 0 && closedGoals.length === 0 ? <p className="ops-body">No evidence-backed operating goal exists yet. Set the first target, owner, scope, and window above.</p> : (
            <div className="ops-stack" style={{ gap: 16 }}>
              {activeGoals.length === 0 && <p className="ops-body">No active goal remains. Set the next owned target above.</p>}
              {activeGoals.slice(0, 6).map((goal) => {
                const progress = Math.min(100, Math.round((goal.actualValue / goal.targetValue) * 100));
                return (
                  <div key={goal.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                      <span className="ops-value" style={{ margin: 0 }}>{goal.scopeLabel}</span>
                      <Badge status={statusTone(goal.pace)}>{label(goal.pace)}</Badge>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span className="ops-record-meta">{label(goal.metric)} · {goal.actualValue.toLocaleString()} of {goal.targetValue.toLocaleString()} · {goal.ownerName}</span>
                      <GoalStateActions goalId={goal.id} goalLabel={`${goal.scopeLabel} ${label(goal.metric)}`} expectedUpdatedAt={goal.updatedAt} />
                    </div>
                    <div className="ops-progress" role="progressbar" aria-label={`${goal.scopeLabel} ${label(goal.metric)} goal`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} style={{ marginTop: 8 }}><span style={{ width: `${progress}%` }} /></div>
                  </div>
                );
              })}
              {closedGoals.length > 0 && (
                <div style={{ borderTop: "1px solid var(--border-rule)", paddingTop: 14 }}>
                  <span className="ops-label">Recent locked outcomes</span>
                  <div className="ops-stack" style={{ gap: 10, marginTop: 8 }}>
                    {closedGoals.slice(0, 3).map((goal) => (
                      <div key={goal.id}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                          <span className="ops-record-name" style={{ fontSize: 14 }}>{goal.scopeLabel}</span>
                          <Badge status={statusTone(goal.status)}>{label(goal.status)}</Badge>
                        </div>
                        <span className="ops-record-meta">
                          {label(goal.metric)} · {goal.resultValue?.toLocaleString() ?? "—"} of {goal.targetValue.toLocaleString()}
                        </span>
                        {goal.decisionNote && <p className="ops-body" style={{ marginTop: 4 }}>{goal.decisionNote}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>

      <section className="ops-panel ops-anchor" id="funnel" aria-labelledby="growth-funnel-title">
        <div className="ops-section-head">
          <div><span className="ops-label">{funnel.windowLabel}</span><h2 id="growth-funnel-title" className="ops-section-title">One honest participation funnel</h2></div>
          <span className="ops-section-note">Each stage keeps its own evidence rule; repeat means two distinct Programs.</span>
        </div>
        <div className="ops-growth-flow" role="list" aria-label="Growth participation funnel">
          {funnelSteps.map((step, index) => (
            <div className="ops-growth-flow__step" role="listitem" key={step.label}>
              <span className="ops-growth-flow__ordinal">{String(index + 1).padStart(2, "0")}</span>
              <strong>{step.value.toLocaleString()}</strong>
              <span>{step.label}</span>
              <small>{step.rate}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="ops-panel ops-anchor" id="campaigns" aria-labelledby="growth-campaigns-title">
        <div className="ops-section-head">
          <div><span className="ops-label">Measurable experiments</span><h2 id="growth-campaigns-title" className="ops-section-title">Campaign portfolio</h2></div>
          <Badge status={center.campaigns.some((campaign) => campaign.status === "active") ? "positive" : "neutral"}>{center.campaigns.filter((campaign) => campaign.status === "active").length} active</Badge>
        </div>
        {center.campaigns.length === 0 ? (
          <div className="ops-empty"><h3 className="ops-empty__title">No campaign has a testable operating record.</h3><p className="ops-empty__body">Create one hypothesis with an owner, market, date window, target, budget, and channel. Completion will require a derived result, decision, and learning.</p></div>
        ) : (
          <div className="ops-list">
            {center.campaigns.map((campaign) => {
              const targetActual = metricValue(campaign);
              const costPerVerified = campaign.verifiedParticipants > 0 ? campaign.spendCents / campaign.verifiedParticipants : null;
              return (
                <article className="ops-list-row" id={`campaign-${campaign.id}`} key={campaign.id}>
                  <div><span className="ops-record-name">{campaign.name}</span><span className="ops-record-meta">{campaign.channelName} · {campaign.scopeLabel}</span></div>
                  <div><Badge status={statusTone(campaign.status)}>{label(campaign.status)}</Badge><span className="ops-record-meta">{campaign.startsOn} → {campaign.endsOn}</span></div>
                  <div><span className="ops-label">{["completed", "cancelled"].includes(campaign.status) ? "Locked result" : "Owned target"}</span><span className="ops-value">{targetActual == null ? "Derived at close" : targetActual.toLocaleString()} / {campaign.targetValue.toLocaleString()}</span><span className="ops-record-meta">{label(campaign.targetMetric)} · {campaign.ownerName ?? "Unassigned"}</span></div>
                  <div>
                    <span className="ops-label">{["completed", "cancelled"].includes(campaign.status) ? "Current evidence & economics" : "Evidence & economics"}</span>
                    <span className="ops-value">{campaign.leads} leads · {campaign.registrations} registered · {campaign.verifiedParticipants} verified</span>
                    <span className="ops-record-meta">{money(campaign.spendCents)} spend · {costPerVerified == null ? "No verified CAC yet" : `${money(costPerVerified)} per verified student`}</span>
                    {campaign.decision && campaign.learning && (
                      <details className="ops-campaign-learning">
                        <summary>{label(campaign.decision)} decision & learning</summary>
                        <p>{campaign.learning}</p>
                      </details>
                    )}
                  </div>
                  <div className="ops-row-actions"><CampaignStateActions campaignId={campaign.id} campaignName={campaign.name} status={campaign.status as "draft" | "active" | "paused" | "completed" | "cancelled"} spendCents={campaign.spendCents} expectedUpdatedAt={campaign.updatedAt} /></div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="ops-panel ops-anchor" id="contributors" aria-labelledby="growth-contributors-title">
        <div className="ops-section-head">
          <div><span className="ops-label">Distributed leadership</span><h2 id="growth-contributors-title" className="ops-section-title">Contributor network</h2></div>
          <span className="ops-section-note">Regional Lead → Market Lead → Growth Captain → Ambassador. Every active person owns a scope and reporting line.</span>
        </div>
        {center.contributors.length === 0 ? (
          <div className="ops-empty"><h3 className="ops-empty__title">The contributor network has not been activated.</h3><p className="ops-empty__body">Add existing People as candidates or active contributors, then assign explicit roles, markets, and managers.</p></div>
        ) : (
          <div className="ops-list">
            {center.contributors.map((contributor) => (
              <article className="ops-list-row" id={`contributor-${contributor.id}`} key={`${contributor.id}-${contributor.assignmentId ?? "unassigned"}`}>
                <div><span className="ops-record-name">{contributor.name}</span><span className="ops-record-meta">{contributor.email}</span></div>
                <div><Badge status={statusTone(contributor.status)}>{label(contributor.status)}</Badge><span className="ops-record-meta">{contributor.role ? label(contributor.role) : "No current role"}</span></div>
                <div><span className="ops-label">Reporting line</span><span className="ops-value">{contributor.managerName ?? (contributor.role === "regional_lead" ? "Senior leadership" : "Unassigned")}</span><span className="ops-record-meta">{contributor.scopeLabel}</span></div>
                <div><span className="ops-label">Attributed impact</span><span className="ops-value">{contributor.leads} leads · {contributor.registrations} registrations · {contributor.verifiedParticipants} verified</span><span className="ops-record-meta">{contributor.successfulReferrals} successful referral{contributor.successfulReferrals === 1 ? "" : "s"}{contributor.lastContributionAt ? ` · last ${new Date(contributor.lastContributionAt).toLocaleDateString()}` : " · no recorded touchpoint"}</span></div>
                <div className="ops-row-actions">
                  <ContributorStateActions
                    contributorId={contributor.id}
                    contributorName={contributor.name}
                    contributorStatus={contributor.status as "candidate" | "active" | "paused" | "alumni"}
                    contributorUpdatedAt={contributor.contributorUpdatedAt}
                    assignmentId={contributor.assignmentId}
                    assignmentStartsOn={contributor.assignmentStartsOn}
                    assignmentUpdatedAt={contributor.assignmentUpdatedAt}
                    today={today}
                  />
                  <Link className="ops-inline-link" href={`/app/admin/people?person=${contributor.personId}`}>Person record</Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="ops-panel ops-anchor" id="markets" aria-labelledby="growth-markets-title">
        <div className="ops-section-head">
          <div><span className="ops-label">Demand × capacity</span><h2 id="growth-markets-title" className="ops-section-title">Market balance</h2></div>
          <span className="ops-section-note">The next action changes with the constraint: grow demand, add seats, develop instructors, or assign leadership.</span>
        </div>
        {center.markets.length === 0 ? <p className="ops-body">Create Regions and Locations before BOW plans market expansion.</p> : (
          <div className="ops-list">
            {center.markets.map((market) => (
              <article className="ops-list-row" key={market.id}>
                <div><Link className="ops-record-name" href={`/app/locations/${market.id}`}>{market.name}</Link><span className="ops-record-meta">{market.regionName ?? "Region missing"} · {market.leaderName ?? "Leader missing"}</span></div>
                <div><Badge status={statusTone(market.imbalance)}>{label(market.imbalance)}</Badge><span className="ops-record-meta">primary constraint</span></div>
                <div><span className="ops-label">90-day demand</span><span className="ops-value">{market.attributableLeads} leads · {market.verifiedParticipants} verified</span></div>
                <div><span className="ops-label">Next 90 days</span><span className="ops-value">{market.upcomingClasses} Classes · {market.registrations}/{market.upcomingSeats} seats</span><span className="ops-record-meta">{market.availableSeats} open · {market.waitlisted} waitlisted</span></div>
                <Link className="ops-inline-link" href={`/app/locations/${market.id}`}>Open market</Link>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="ops-panel ops-anchor" id="playbooks" aria-labelledby="growth-playbooks-title">
        <div className="ops-section-head">
          <div><span className="ops-label">Organizational memory</span><h2 id="growth-playbooks-title" className="ops-section-title">Promoted playbooks</h2></div>
          <Badge status={center.playbooks.some((playbook) => playbook.status === "active") ? "positive" : "neutral"}>{center.playbooks.filter((playbook) => playbook.status === "active").length} active</Badge>
        </div>
        {center.playbooks.length === 0 ? <p className="ops-body">Complete a campaign with a derived result, decision, and reusable learning before promoting the first playbook.</p> : (
          <div className="ops-playbook-grid">
            {center.playbooks.map((playbook) => (
              <article className="ops-playbook" key={playbook.id}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}><h3>{playbook.title}</h3><Badge status={statusTone(playbook.status)}>{label(playbook.status)}</Badge></div>
                <span className="ops-record-meta">Source: {playbook.sourceCampaignName} · Owner: {playbook.ownerName}</span>
                <p className="ops-body"><strong>Problem:</strong> {playbook.problem}</p>
                <p className="ops-body"><strong>Play:</strong> {playbook.play}</p>
                <p className="ops-body"><strong>Evidence:</strong> {playbook.evidence}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="ops-panel ops-panel--flat" aria-labelledby="growth-definitions-title">
        <div className="ops-section-head"><div><span className="ops-label">Metric contract</span><h2 id="growth-definitions-title" className="ops-section-title">What the numbers mean</h2></div></div>
        <div className="ops-meta-grid">
          <div className="ops-meta"><span className="ops-label">Verified participation</span><span className="ops-value">Present or late attendance on a finalized Class session.</span></div>
          <div className="ops-meta"><span className="ops-label">Repeat participation</span><span className="ops-value">Verified participation in two or more distinct Programs.</span></div>
          <div className="ops-meta"><span className="ops-label">Successful referral</span><span className="ops-value">The referred Student reaches verified participation.</span></div>
          <div className="ops-meta"><span className="ops-label">Completion</span><span className="ops-value">An explicit Student/Program outcome; attendance never invents it.</span></div>
        </div>
      </section>
    </main>
  );
}
