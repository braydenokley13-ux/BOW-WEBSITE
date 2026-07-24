import Link from "next/link";
import { DataStrip, PageHeader } from "@/components/ds";
import { requireStaff } from "@/lib/dal";
import { getDb } from "@/lib/db";
import { getGrowthAdvocates } from "@/lib/growth-attribution";
import {
  advocateHeadline,
  advocateRoleHint,
  CHANNEL_META,
  type Advocate,
} from "@/lib/growth-attribution-shared";

export const metadata = { title: "Advocates · Growth · BOW HQ" };

function staleLabel(lastActivityAt: number | null, now: number): string | null {
  if (lastActivityAt === null) return null;
  const days = Math.max(0, Math.floor((now - lastActivityAt) / (24 * 60 * 60 * 1000)));
  if (days <= 45) return null;
  return `Last touch ${days} days ago`;
}

/**
 * "Who generates BOW's growth?" — the single cross-system attribution board.
 * Every Person who has brought instructors, families, or partners into BOW,
 * ranked by verified downstream outcome, with the full chain each one set in
 * motion. Nothing here is entered by hand: each number is derived from
 * canonical referrals, introductions, enrollments, and finalized attendance.
 */
export default async function AdvocatesPage() {
  await requireStaff();
  const now = Number(((await getDb().prepare("SELECT unixepoch('now') * 1000 AS now").get()) as { now: number }).now);
  const { advocates, totals } = await getGrowthAdvocates(100);

  const stripItems = [
    { label: "Advocates", value: totals.advocates.toLocaleString(), tone: "info" as const },
    { label: "Instructors activated", value: totals.activeInstructorsGenerated.toLocaleString(), tone: totals.activeInstructorsGenerated > 0 ? ("positive" as const) : undefined },
    { label: "Partners opened", value: totals.partnersGenerated.toLocaleString(), tone: totals.partnersGenerated > 0 ? ("positive" as const) : undefined },
    { label: "Families verified", value: totals.verifiedFamilies.toLocaleString() },
    { label: "Students reached", value: totals.studentsReached.toLocaleString(), tone: totals.studentsReached > 0 ? ("positive" as const) : undefined },
    { label: "Referrals in flight", value: totals.pendingReferrals.toLocaleString(), tone: totals.pendingReferrals > 0 ? ("warning" as const) : undefined },
  ];

  return (
    <main className="ops-page" data-accent="blue">
      <PageHeader
        eyebrow="Growth · Attribution"
        title="Who generates our growth"
        context="Every person who brought an instructor, family, or partner into BOW — ranked by the verified outcome that resulted, not by raw leads."
      />

      <DataStrip items={stripItems} dense />

      <section className="ops-proof-note" aria-label="Attribution rule">
        <strong>Evidence rule:</strong> an instructor referral converts at the active stage, a family referral at verified attendance, and an introduction when it produces a real partner organization. Students reached are counted downstream of those conversions — the compounding a single advocate actually set in motion.
      </section>

      {advocates.length === 0 ? (
        <section className="ops-empty">
          <h2 className="ops-empty__title">No attributable growth yet.</h2>
          <p className="ops-empty__body">
            When an instructor refers another instructor, a family refers a family, or someone introduces a school, the person and the outcome will appear here — automatically, from the records.
          </p>
        </section>
      ) : (
        <section className="ops-list" aria-label="Growth advocates">
          {advocates.map((advocate, index) => (
            <AdvocateRow key={advocate.personId} advocate={advocate} rank={index + 1} stale={staleLabel(advocate.lastActivityAt, now)} />
          ))}
        </section>
      )}
    </main>
  );
}

function AdvocateRow({ advocate, rank, stale }: { advocate: Advocate; rank: number; stale: string | null }) {
  return (
    <article className="ops-list-row" style={{ alignItems: "flex-start" }}>
      <div style={{ minWidth: 0 }}>
        <Link href={`/app/people/${advocate.personId}`} className="ops-record-name">
          {rank}. {advocate.name}
        </Link>
        <span className="ops-record-meta">
          {advocateRoleHint(advocate)}
          {stale ? ` · ${stale}` : ""}
        </span>
        <p className="ops-body" style={{ margin: "6px 0 0" }}>{advocateHeadline(advocate)}</p>
      </div>

      <div>
        <span className="ops-label">Verified outcome</span>
        <span className="ops-value">
          {advocate.studentsReached} student{advocate.studentsReached === 1 ? "" : "s"} reached
        </span>
        <span className="ops-record-meta">
          {advocate.activeInstructorsGenerated > 0 ? `${advocate.activeInstructorsGenerated} instructor${advocate.activeInstructorsGenerated === 1 ? "" : "s"} active` : null}
          {advocate.activeInstructorsGenerated > 0 && advocate.partnersGenerated > 0 ? " · " : ""}
          {advocate.partnersGenerated > 0 ? `${advocate.partnersGenerated} partner${advocate.partnersGenerated === 1 ? "" : "s"}` : null}
          {advocate.activeInstructorsGenerated === 0 && advocate.partnersGenerated === 0 ? `${advocate.totalConverted} converted` : ""}
        </span>
      </div>

      <div>
        <span className="ops-label">How they generate it</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 2 }}>
          {advocate.channels.map((channel) => {
            const meta = CHANNEL_META[channel.channel];
            return (
              <span key={channel.channel} className="ops-record-meta" style={{ display: "block" }}>
                <strong style={{ color: "var(--bow-ink)", fontWeight: 600 }}>{meta.label}:</strong>{" "}
                {channel.referred} {meta.referredNoun}
                {channel.converted > 0 ? (
                  <span style={{ color: "var(--bow-positive)" }}> → {channel.converted} {meta.convertedNoun}</span>
                ) : (
                  <span> · none converted yet</span>
                )}
              </span>
            );
          })}
        </div>
      </div>

      <Link href={`/app/people/${advocate.personId}`} className="ops-inline-link" style={{ whiteSpace: "nowrap" }}>
        Open person →
      </Link>
    </article>
  );
}
