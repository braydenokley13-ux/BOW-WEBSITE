import Link from "next/link";
import { Badge, Button } from "@/components/ds";
import { requireStaff } from "@/lib/dal";
import { getPartnerInbox, listPartners, listPartnerChoices } from "@/lib/partner-desk";
import type { PartnerRow } from "@/lib/partner-desk-shared";
import PartnerInbox from "@/components/app/partners/PartnerInbox";

export const metadata = { title: "Partners" };

const sectionHeading: React.CSSProperties = {
  margin: "0 0 10px",
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: 14,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--bow-ink)",
};

const standingTone: Record<PartnerRow["standing"], "positive" | "info" | "warning" | "neutral"> = {
  running: "positive",
  scoping: "info",
  paused: "warning",
  past: "neutral",
};

/**
 * Partners — one question, asked once: who do I need to follow up with.
 *
 * The inbox comes first because it is the answer. The list underneath is not a
 * pipeline and does not pretend to be one; it says, per relationship, where it
 * stands, what was said last, and what is next.
 *
 * Filtering is by standing only, and only because "who has nothing scheduled
 * and nothing promised" is a question a founder genuinely asks. There is no
 * search box: BOW has a handful of schools, and a search box over eight rows
 * is decoration.
 */
export default async function PartnersPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  await requireStaff();
  const { show } = await searchParams;

  const [inbox, partners, choices] = await Promise.all([
    getPartnerInbox(),
    listPartners(),
    listPartnerChoices(),
  ]);

  const filters = [
    { key: "all", label: "All", count: partners.length },
    { key: "running", label: "Running", count: partners.filter((p) => p.standing === "running").length },
    { key: "scoping", label: "Still deciding", count: partners.filter((p) => p.standing === "scoping").length },
    { key: "past", label: "Past", count: partners.filter((p) => p.standing === "past" || p.standing === "paused").length },
  ];
  const active = filters.some((f) => f.key === show) ? (show as string) : "all";
  const shown = partners.filter((partner) => {
    if (active === "all") return true;
    if (active === "past") return partner.standing === "past" || partner.standing === "paused";
    return partner.standing === active;
  });

  return (
    <div style={{ maxWidth: 1000 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-data)",
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--bow-slate)",
            }}
          >
            Partners
          </p>
          <h1
            style={{
              margin: "9px 0 0",
              fontFamily: "var(--font-interface)",
              fontWeight: 600,
              fontSize: "clamp(19px, 2.6vw, 24px)",
              lineHeight: 1.3,
              color: "var(--bow-ink)",
            }}
          >
            {inbox.length === 0
              ? "Nobody is waiting on you."
              : `${inbox.length} ${inbox.length === 1 ? "person is" : "people are"} waiting on you.`}
          </h1>
        </div>
        <Button href="/demo" variant="secondary">
          Open partner demo
        </Button>
      </div>

      <section style={{ marginTop: 28 }}>
        <h2 style={sectionHeading}>Waiting on you</h2>
        <PartnerInbox items={inbox} partners={choices} />
      </section>

      <section style={{ marginTop: 34 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap", marginBottom: 12 }}>
          <h2 style={{ ...sectionHeading, margin: 0 }}>Relationships</h2>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {filters.map((filter) => (
              <Link
                key={filter.key}
                href={filter.key === "all" ? "/app/partners" : `/app/partners?show=${filter.key}`}
                aria-current={active === filter.key ? "true" : undefined}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 10px",
                  borderRadius: "var(--radius-pill)",
                  border: `1px solid ${active === filter.key ? "var(--bow-ink)" : "var(--border-rule)"}`,
                  background: active === filter.key ? "var(--bow-ink)" : "transparent",
                  color: active === filter.key ? "var(--bow-white)" : "var(--bow-slate)",
                  fontFamily: "var(--font-data)",
                  fontSize: 10.5,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                {filter.label}
                <span style={{ opacity: 0.7 }}>{filter.count}</span>
              </Link>
            ))}
          </div>
        </div>

        {shown.length === 0 ? (
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--bow-slate)" }}>
            {partners.length === 0
              ? "No partners yet. A school that writes in through the public form can be turned into one from the inbox above."
              : "Nothing here right now."}
          </p>
        ) : (
          <div style={{ border: "1px solid var(--border-rule)", borderRadius: "var(--radius-card)", background: "var(--bow-white)" }}>
            {shown.map((partner, index) => (
              <div
                key={partner.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  padding: "14px 16px",
                  borderTop: index === 0 ? "none" : "1px solid var(--border-rule)",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                  <Link
                    href={`/app/partners/${partner.id}`}
                    style={{ fontSize: 15, fontWeight: 600, color: "var(--bow-ink)" }}
                  >
                    {partner.name}
                  </Link>
                  <span style={{ display: "block", marginTop: 3, fontSize: 13, color: "var(--bow-slate)" }}>
                    {[partner.location, partner.type].filter(Boolean).join(" · ")}
                  </span>
                  {partner.lastTouch ? (
                    <span style={{ display: "block", marginTop: 4, fontSize: 12.5, color: "var(--bow-slate)" }}>
                      Last: {partner.lastTouch}
                    </span>
                  ) : null}
                </div>

                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                  {partner.nextFollowUp ? (
                    <span style={{ fontSize: 13, color: partner.nextFollowUp.overdue ? "var(--bow-warning-text)" : "var(--bow-ink)" }}>
                      {partner.nextFollowUp.title}
                      <span style={{ display: "block", marginTop: 2, fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
                        {partner.nextFollowUp.dueOn ? `Due ${partner.nextFollowUp.dueOn}` : "No date"}
                      </span>
                    </span>
                  ) : (
                    <span style={{ fontSize: 13, color: "var(--bow-slate)" }}>Nothing planned</span>
                  )}
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center", flex: "none" }}>
                  <Badge status={standingTone[partner.standing]}>{partner.standingLabel}</Badge>
                  {partner.waiting > 0 ? <Badge status="warning">{partner.waiting} waiting</Badge> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
